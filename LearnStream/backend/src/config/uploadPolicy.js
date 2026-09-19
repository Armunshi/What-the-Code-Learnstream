// Upload policy (D4, docs/contracts/domain-model.md) — the one place that
// answers "what is this upload kind, what may it contain, and is it
// processed synchronously or does it need Cloudinary's async eager
// transcode". Every other upload module (sign/complete handlers, the
// frontend's chunked uploader) reads from this table instead of repeating
// per-kind mime/size rules inline.
//
// `resourceType` is Cloudinary's own vocabulary (video | image | raw) and
// decides which Admin API call verifies the asset and which delivery URLs
// make sense. `async: true` means the kind goes through eager_async
// transcoding (PROCESSING until a webhook or the reconcile poll confirms
// READY); everything else is confirmed synchronously off the Admin API
// response during /complete.
const MB = 1024 * 1024;

export const UPLOAD_KINDS = Object.freeze([
  "item-video",
  "item-caption",
  "item-resource",
  "assignment-file",
  "course-thumbnail",
  "course-promo",
]);

// §0.14's bug list: the legacy multer allowlist had the invalid MIME
// `video/mkv` (the real one is `video/x-matroska`) and was missing
// `video/quicktime` and `video/webm`. D4's line item — "Policy: video
// accepts mp4, quicktime, webm and x-matroska" — is this table's fix.
const VIDEO_MIME_TYPES = Object.freeze([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

export const UPLOAD_POLICY = Object.freeze({
  "item-video": {
    resourceType: "video",
    mimeTypes: VIDEO_MIME_TYPES,
    maxBytes: 2 * 1024 * MB,
    async: true,
  },
  "course-promo": {
    resourceType: "video",
    mimeTypes: VIDEO_MIME_TYPES,
    maxBytes: 2 * 1024 * MB,
    async: true,
  },
  "item-caption": {
    resourceType: "raw",
    mimeTypes: Object.freeze(["text/vtt", "text/plain", "application/x-subrip"]),
    maxBytes: 2 * MB,
    async: false,
  },
  "item-resource": {
    resourceType: "raw",
    mimeTypes: Object.freeze([
      "application/pdf",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "image/jpeg",
      "image/png",
    ]),
    maxBytes: 50 * MB,
    async: false,
  },
  "assignment-file": {
    resourceType: "raw",
    mimeTypes: Object.freeze([
      "application/pdf",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
    ]),
    maxBytes: 50 * MB,
    async: false,
  },
  "course-thumbnail": {
    resourceType: "image",
    mimeTypes: Object.freeze(["image/jpeg", "image/png", "image/webp"]),
    maxBytes: 5 * MB,
    async: false,
  },
});

export const policyFor = (kind) => UPLOAD_POLICY[kind];

// D4: "The browser sends 20 MB chunks ... retrying each chunk 3x with
// backoff." One shared constant so the sign response, the frontend chunker,
// and the fake-provider test route all agree on the same chunk size.
export const CHUNK_SIZE_BYTES = 20 * MB;
export const CHUNK_MAX_RETRIES = 3;
export const CHUNK_RETRY_BASE_DELAY_MS = 500;

// D4: "GET .../media-status ... with lazy reconcile for items stuck in
// PROCESSING for over 60 s." Real Cloudinary Admin API calls cost quota, so
// production only reconciles a genuinely stuck item; the fake provider's
// verify() is a free in-memory lookup, so it reconciles on every poll (see
// services/media/index.js's reconcileDue()) — that's also what makes
// webhook-less localhost dev/e2e runs resolve to READY at all (plan §9.16).
export const RECONCILE_STUCK_AFTER_MS = 60_000;
