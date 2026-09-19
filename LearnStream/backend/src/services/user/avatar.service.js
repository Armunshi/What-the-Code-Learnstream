import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { cloudinary } from "../../config/cloudinary.js";
import { deleteMediaFromCloudinary } from "../media.service.js";
import { User } from "../../models/user.model.js";
import { ApiError } from "../../utils/ApiError.js";

// Its own multer instance rather than middleware/multer.middleware.js's
// shared `upload` (20 MB, images/audio/video/PDF) — an avatar needs a much
// narrower policy (5 MB, jpeg/png only), and this lane owns
// services/user/** rather than the shared middleware file.
const TEMP_DIR = path.resolve("tmp_uploads");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, "");
        cb(null, `avatar-${crypto.randomUUID()}${ext}`);
    },
});

const AVATAR_MIME_TYPES = ["image/jpeg", "image/png"];
const FIVE_MB = 5 * 1024 * 1024;

export const uploadAvatar = multer({
    storage,
    limits: { fileSize: FIVE_MB },
    fileFilter: (req, file, cb) => {
        if (AVATAR_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
        // ApiError, not a bare Error: errorHandler.middleware.js only maps a
        // bare Error to 400 for mongoose/MulterError instances — anything
        // else falls through to 500, which a wrong-mimetype upload isn't.
        cb(new ApiError(400, "Avatar must be a JPEG or PNG image"));
    },
});

export const setAvatar = async (userId, localFilePath) => {
    let uploadResult;
    try {
        uploadResult = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "image",
            // Applied as an incoming transformation, so the stored asset (and
            // the secure_url returned below) is already the 256x256
            // face-cropped square — not just a delivery-time URL param.
            transformation: [{ width: 256, height: 256, crop: "fill", gravity: "face" }],
        });
    } finally {
        if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
    }

    const user = await User.findById(userId);
    const previousPublicId = user.avatarPublicId;

    user.avatar = uploadResult.secure_url;
    user.avatarPublicId = uploadResult.public_id;
    await user.save({ validateBeforeSave: false });

    // Best-effort cleanup, after the new avatar is already saved: a failed
    // delete of the old asset must not fail this request (mirrors
    // media.service.js's own non-throwing style for destroy()).
    if (previousPublicId) {
        deleteMediaFromCloudinary(previousPublicId, "image").catch((error) => {
            console.error(`Failed to delete previous avatar ${previousPublicId}:`, error.message);
        });
    }

    return { avatar: user.avatar };
};
