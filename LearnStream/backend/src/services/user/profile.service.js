import { z } from "zod";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../../models/user.model.js";

// Same 24-hex guard user.model.js validates at the schema level (a username
// that looked like an ObjectId would collide with /users/:id-shaped lookups)
// — checked again here so a bad username 400s with a clear field/code before
// it ever reaches Mongoose's own validator.
const HEX24 = /^[0-9a-f]{24}$/i;
const USERNAME_RE = /^[a-z0-9-]{3,30}$/;

const linkSchema = z.object({
    label: z.string().trim().max(60).optional().default(""),
    url: z
        .string()
        .trim()
        .url("Link must be a valid URL")
        .refine((value) => value.startsWith("https://"), "Links must use https"),
});

export const updateProfileSchema = z.object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    headline: z.string().trim().max(60).optional(),
    bio: z.string().trim().max(2000).optional(),
    language: z.string().trim().min(2).max(10).optional(),
    links: z.array(linkSchema).max(10).optional(),
    username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(USERNAME_RE, "Username must be 3-30 lowercase letters, numbers, or hyphens")
        .refine((value) => !HEX24.test(value), "Username cannot look like an id")
        .optional(),
    // Not in the plan's explicit field list, but backs the /account/privacy
    // tab against a field the User model already has (user.model.js's
    // `privacy.showCourses`) — no new model field, just the first endpoint
    // that writes to this one.
    privacy: z.object({ showCourses: z.boolean() }).partial().optional(),
});

// Kept local rather than reusing middleware/validate.js: that shared
// middleware's error shape is {field, message}, not the {field, code} the
// frozen error-shape contract (docs/contracts/api-conventions.md) specifies
// for validation errors — every lane's own new endpoints are supposed to
// reuse that shape, not middleware/validate.js's.
export const validateProfileBody = (req, res, next) => {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.join(".") || "(body)",
            code: issue.code,
        }));
        return next(new ApiError(400, "Invalid profile update", errors));
    }
    req.body = result.data;
    next();
};

const ME_SELECT = "-password -refreshToken";

export const getMe = async (userId) => {
    const user = await User.findById(userId).select(ME_SELECT);
    if (!user) throw new ApiError(404, "User not found");
    return user;
};

export const updateProfile = async (userId, patch) => {
    if (patch.username) {
        const existing = await User.findOne({ username: patch.username, _id: { $ne: userId } }).select("_id");
        if (existing) {
            throw new ApiError(409, "Username is already taken", [{ field: "username", code: "USERNAME_EXISTS" }]);
        }
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    Object.assign(user, patch);

    try {
        await user.save();
    } catch (error) {
        // Belt-and-braces against a race between the pre-check above and the
        // write itself — the unique index is still the real guarantee.
        if (error?.code === 11000 && error?.keyPattern?.username) {
            throw new ApiError(409, "Username is already taken", [{ field: "username", code: "USERNAME_EXISTS" }]);
        }
        throw error;
    }

    return User.findById(userId).select(ME_SELECT);
};
