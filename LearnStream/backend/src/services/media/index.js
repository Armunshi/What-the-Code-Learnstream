import { env } from "../../config/env.js";
import { cloudinaryProvider } from "./providers/cloudinary.js";
import { fakeProvider } from "./providers/fake.js";

// Selects the legacy-upload-path provider by MEDIA_PROVIDER (config/env.js).
// This directory is the legacy server-side (multer) upload path only — see
// providers/cloudinary.js for why it stays minimal in Wave 0.
const providers = {
    cloudinary: cloudinaryProvider,
    fake: fakeProvider,
};

export const mediaProvider = providers[env.media.provider] ?? cloudinaryProvider;

export const uploadOnCloudinary = mediaProvider.upload;
export const uploadMultipleFilesOnCloudinary = mediaProvider.uploadMany;
export const deleteMediaFromCloudinary = mediaProvider.remove;
