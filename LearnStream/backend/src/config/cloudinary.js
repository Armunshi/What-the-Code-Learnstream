import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

// SDK configuration only. The upload/delete operations live in
// services/media.service.js — §6.1 keeps "how we are authenticated to
// Cloudinary" separate from "what we do with it".
cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
});

export { cloudinary };
