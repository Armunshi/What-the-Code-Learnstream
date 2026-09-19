import crypto from "crypto";
import { cloudinary } from "../../../config/cloudinary.js";
import { env } from "../../../config/env.js";
import { ApiError } from "../../../utils/ApiError.js";

// The NEW direct-to-Cloudinary pipeline (D4, docs/contracts/domain-model.md):
// the browser uploads straight to Cloudinary using params this module signs;
// the server never sees the file bytes and only ever confirms what actually
// landed through the Admin API. This replaces the placeholder body Wave 0
// left here — see git history / BACKEND_AUDIT.md for the old multer-based
// path this superseded (services/media.service.js, still used by the legacy
// module/lecture/assignment services until CURR rewrites them in Wave 2).
//
// Signing is done by hand (Cloudinary's documented algorithm — sort every
// param except file/cloud_name/resource_type/api_key/signature by key, join
// as "key=value&...", append the api_secret, sha1 hex) rather than via
// `cloudinary.utils.api_sign_request`. Both produce an identical signature;
// this codebase's test double for the `cloudinary` package (tests/setup.js,
// owned by W0-C) only mocks `uploader.upload/destroy`, so signing can't
// depend on `cloudinary.utils` existing in a test process — and unit tests
// run against the fake provider anyway (D4 step 6), so this function is only
// ever exercised for real in production, where the real SDK's `utils` object
// does exist and this hand-rolled version needs no dependency on it either.
function signParams(params, apiSecret) {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(`${toSign}${apiSecret}`)
    .digest("hex");
}

const uploadUrlFor = (resourceType) =>
  `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/${resourceType}/upload`;

/**
 * Builds the signed params the browser needs to chunk-upload directly to
 * Cloudinary. `async` (from uploadPolicy.js) is what requests the eager
 * sp_auto/m3u8 transcode + its own webhook notification (D4 step 1); a
 * synchronous kind (image/raw) signs a plain upload with no eager transform.
 */
function sign({ publicId, resourceType, folder, isAsync }) {
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    public_id: publicId,
    folder,
    timestamp,
    ...(isAsync
      ? {
          eager: "sp_auto/m3u8",
          eager_async: true,
          ...(env.media.notificationUrl ? { eager_notification_url: env.media.notificationUrl } : {}),
        }
      : {}),
  };
  const signature = signParams(params, env.cloudinary.apiSecret);

  return {
    uploadUrl: uploadUrlFor(resourceType),
    fields: {
      ...params,
      api_key: env.cloudinary.apiKey,
      signature,
    },
  };
}

/**
 * Admin API confirmation — D4 step 3's "the server verifies the asset
 * through the Admin API (it never trusts the client)". Real network call;
 * only reached when MEDIA_PROVIDER=cloudinary, which unit tests never
 * select (D4 step 6) specifically so this never needs mocking there.
 */
async function verify({ publicId, resourceType }) {
  try {
    const resource = await cloudinary.api.resource(publicId, { resource_type: resourceType });
    return {
      found: true,
      ready: true,
      bytes: resource.bytes,
      durationSec: resource.duration,
      width: resource.width,
      height: resource.height,
      url: resource.secure_url,
      posterUrl: resourceType === "video" ? resource.secure_url?.replace(/\.[^.]+$/, ".jpg") : undefined,
      hlsUrl: undefined, // populated by the eager/webhook path, not the base resource lookup
    };
  } catch (error) {
    if (error?.http_code === 404 || error?.error?.http_code === 404) {
      return { found: false, ready: false };
    }
    throw new ApiError(502, "Could not verify the upload with the media provider");
  }
}

async function remove({ publicId, resourceType }) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export const cloudinaryProvider = { name: "cloudinary", sign, verify, remove };
