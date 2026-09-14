import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export const ROLES = Object.freeze({ STUDENT: "student", TEACHER: "teacher" });

const MIN_PASSWORD_LENGTH = 8;

// One model replaces userstudentmodel.js and userteachermodel.js, which were
// ~90% identical — same fields, same pre-save hook, same three methods
// (BACKEND_AUDIT.md §5.4). Role used to be inferred from *which collection
// held the _id*, which is why there were three auth middlewares and why
// verifyJWTCombined had to try both collections in turn. It is now a field,
// and it is in the token.
//
// Deliberately a plain `role` field rather than a Mongoose discriminator.
// §6.2 suggested a discriminator, but that keeps deriving role from something
// implicit — `__t` instead of the collection name — which is the same shape of
// problem §5.4 describes. An explicit field is what the guards read and what
// the JWT carries, so there is exactly one answer to "what is this user".
// A 24-character hex string is what an ObjectId looks like — /user/:id and
// /user/:username share one route family (docs/contracts/api-conventions.md
// D8), so a username that happened to be 24 hex characters would be
// ambiguous with an id at lookup time. Rejected at the schema level so it
// can never be created in the first place, not just avoided by convention.
const HEX24 = /^[0-9a-f]{24}$/i;

const linkSchema = new Schema(
    { label: { type: String }, url: { type: String } },
    { _id: false }
);

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    // Split name fields (user.model.js additions, docs/contracts/domain-model.md).
    // `name` stays as the single field every existing document, token and
    // query already uses; these are additive and kept in sync with it by the
    // pre-save hook below rather than replacing it outright.
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    username: {
        type: String,
        trim: true,
        // sparse: most existing accounts have no username until they set one
        // (or until migrate-w0-users-split-names.js's follow-up, if any lane
        // chooses to backfill it) — a plain unique index would reject every
        // document past the first with username: undefined.
        unique: true,
        sparse: true,
        validate: {
            validator: (value) => value === undefined || value === null || !HEX24.test(value),
            message: "username cannot be a 24-character hex string — it would collide with an ObjectId in /user/:id routing",
        },
    },
    email: {
        type: String,
        required: true,
        unique: true,
        // Without these, A@b.com and a@b.com were two different accounts
        // despite the unique index (§4.5).
        lowercase: true,
        trim: true,
    },
    emailVerifiedAt: { type: Date },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: Object.values(ROLES),
        index: true,
    },
    avatar: {
        type: String, // cloudinary url
        required: false,
    },
    avatarPublicId: { type: String },
    coverImage: {
        type: String, // cloudinary url
        required: false,
    },
    headline: { type: String },
    bio: { type: String },
    links: { type: [linkSchema], default: [] },
    language: { type: String, default: "en" },
    phone: { type: String },
    phoneVerifiedAt: { type: Date },
    interests: { type: [String], default: [] },
    // Free-form onboarding progress/answers — shape intentionally loose here;
    // the lane that builds onboarding (Wave 1) owns what goes inside it.
    onboarding: { type: Schema.Types.Mixed, default: () => ({}) },
    privacy: {
        showCourses: { type: Boolean, default: true },
    },
    wishlist: [
        {
            type: Schema.Types.ObjectId,
            ref: "Courses",
        },
    ],
    // Enrolled courses for a student, authored courses for a teacher. One
    // field with two meanings is not lovely, but it is what every existing
    // document and every existing query already uses; renaming it is a
    // separate change from unifying the models.
    Courses: [
        {
            type: Schema.Types.ObjectId,
            ref: "Courses",
        },
    ],
    refreshToken: {
        type: String,
    },
}, { timestamps: true });

// Roles remain student | teacher only — multi-role accounts and an admin
// role are Deferred (docs/contracts/domain-model.md).
userSchema.pre("save", function (next) {
    if (this.isModified("firstName") || this.isModified("lastName")) {
        const derived = [this.firstName, this.lastName].filter(Boolean).join(" ").trim();
        if (derived) this.name = derived;
    }
    next();
});

// Length has to be checked here, before hashing, not with schema `minlength`.
// bcrypt output is always 60 characters, so a minlength on the stored value
// would pass for every password including a one-character one — which is why
// §4.5's "no password length constraint" cannot be fixed by a schema option.
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    if (typeof this.password !== "string" || this.password.length < MIN_PASSWORD_LENGTH) {
        // ApiError, not a bare Error: the error handler maps a bare one to 500,
        // and a password that is too short is the caller's mistake, not ours.
        return next(new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`));
    }

    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name,
            // The claim that removes the need to guess. Every auth middleware
            // used to determine role by looking the _id up in one collection
            // and then the other (§5.4).
            role: this.role,
        },
        env.accessToken.secret,
        { expiresIn: env.accessToken.expiry }
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { _id: this._id },
        env.refreshToken.secret,
        { expiresIn: env.refreshToken.expiry }
    );
};

export const User = mongoose.model("User", userSchema);
