import { cloudinary } from "../config/cloudinary.js";

// Builds a Cloudinary delivery URL from a publicId, reusing the SDK instance
// config/cloudinary.js already configures (cloud name/key/secret) rather than
// hand-building the URL string — cloudinary.url() knows the account's cloud
// name and versioning conventions so callers don't have to.
export const cloudinaryUrl = (publicId, { resourceType = "video", format, transformation } = {}) => {
    if (!publicId) return null;
    return cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        ...(format ? { format } : {}),
        ...(transformation ? { transformation } : {}),
    });
};

export const cloudinaryThumbnailUrl = (publicId, { width = 480 } = {}) =>
    cloudinaryUrl(publicId, {
        resourceType: "video",
        format: "jpg",
        transformation: [{ width, crop: "fill" }],
    });
