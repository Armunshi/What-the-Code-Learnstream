// Cloudinary provider for the LEGACY server-side upload path (multer writes
// to a temp file, this uploads it, media.service.js has the actual
// Cloudinary SDK calls). This file is deliberately a thin re-export, not a
// second implementation — see services/media.service.js for the real
// upload/destroy logic and its BACKEND_AUDIT.md history.
//
// The NEW direct-to-Cloudinary pipeline (browser uploads straight to
// Cloudinary, server only issues a signature and receives a webhook) is a
// later lane's job (UPL, Wave 1+) and will replace the body of this whole
// services/media/ directory per the Wave 0 handoff — this file exists now
// only so module/lecture/assignment services have one place to import "the
// media provider" from, instead of reaching into media.service.js directly.
import {
    uploadOnCloudinary,
    uploadMultipleFilesOnCloudinary,
    deleteMediaFromCloudinary,
} from "../../media.service.js";

export const cloudinaryProvider = {
    name: "cloudinary",
    upload: uploadOnCloudinary,
    uploadMany: uploadMultipleFilesOnCloudinary,
    remove: deleteMediaFromCloudinary,
};
