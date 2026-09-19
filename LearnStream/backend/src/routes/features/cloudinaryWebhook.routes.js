import { Router } from "express";
import { env } from "../../config/env.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { verifyWebhookSignature } from "../../services/media/webhookSignature.js";
import { finalizeReadyByPublicId } from "../../services/media/uploadTargets.js";

// D4 step 4: Cloudinary calls this once the eager sp_auto/m3u8 transcode it
// was asked for at sign-time finishes. app.js already gives this exact path
// express.raw() ahead of the JSON parser (RAW_BODY_PATHS), specifically so
// req.rawBody holds the exact bytes Cloudinary signed — re-serialising
// req.body would change key order/whitespace and break every signature
// check, which is why this handler reads req.rawBody rather than
// JSON.stringify(req.body).
const router = Router();

router.post("/", asyncHandler(async (req, res) => {
  const timestamp = req.header("X-Cld-Timestamp");
  const signature = req.header("X-Cld-Signature");

  const valid = verifyWebhookSignature({
    rawBody: req.rawBody.toString("utf8"),
    timestamp,
    signature,
    apiSecret: env.cloudinary.apiSecret,
  });

  // 401, not 400: an unsigned or mis-signed call is not "malformed input",
  // it is a request this endpoint has no reason to trust came from
  // Cloudinary at all.
  if (!valid) {
    return res.status(401).json(new ApiResponse(401, null, "Invalid webhook signature"));
  }

  const payload = req.body ?? {};
  const publicId = payload.public_id;

  // Cloudinary's eager array carries the transcoded HLS asset; the base
  // secure_url is the untouched original upload (D4's "eager sp_auto/m3u8"),
  // so hlsUrl always comes from eager[0], never from the top-level url.
  const eager = Array.isArray(payload.eager) ? payload.eager[0] : undefined;

  if (publicId) {
    // finalizeReadyByPublicId is idempotent (see its own docstring) — a
    // duplicate notification for the same public_id is a safe no-op, which
    // is exactly what lets this handler skip any dedup bookkeeping of its
    // own and just always call it.
    await finalizeReadyByPublicId(publicId, {
      bytes: payload.bytes,
      durationSec: payload.duration,
      width: payload.width,
      height: payload.height,
      url: payload.secure_url,
      hlsUrl: eager?.secure_url,
      posterUrl: payload.secure_url ? `${payload.secure_url.replace(/\.[^./]+$/, "")}.jpg` : undefined,
    });
  }

  // Cloudinary only cares that this returns 2xx; it does not read the body.
  return res.status(200).json(new ApiResponse(200, null, "Webhook received"));
}));

export default { basePath: "/webhooks/cloudinary", priority: 100, router };
