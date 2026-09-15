import fs from "fs/promises";
import crypto from "crypto";

// Fake provider — no network call, no real Cloudinary account needed. Used
// when MEDIA_PROVIDER=fake (config/env.js), which e2e/dev environments that
// don't want to burn real Cloudinary quota can set. Deliberately minimal —
// see providers/cloudinary.js's header for why this whole directory is
// intentionally thin in Wave 0.
const fakeUploadResult = (localFilePath) => ({
    secure_url: `https://fake-media.test/${crypto.randomUUID()}`,
    public_id: `fake_${crypto.randomUUID()}`,
    resource_type: "video",
    duration: 0,
});

const upload = async (localFilePath) => {
    if (!localFilePath) return null;
    const result = fakeUploadResult(localFilePath);
    try {
        await fs.unlink(localFilePath);
    } catch {
        // Already gone — fine, matches uploadOnCloudinary's own tolerance.
    }
    return result;
};

const uploadMany = async (filePaths) => {
    const results = await Promise.all(filePaths.map((path) => upload(path)));
    return results.filter(Boolean);
};

const remove = async () => ({ result: "ok" });

export const fakeProvider = { name: "fake", upload, uploadMany, remove };
