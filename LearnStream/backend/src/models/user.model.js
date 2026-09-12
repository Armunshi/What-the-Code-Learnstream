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
const userSchema = new Schema({
    name: {
        type: String,
        required: true,
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
    coverImage: {
        type: String, // cloudinary url
        required: false,
    },
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
