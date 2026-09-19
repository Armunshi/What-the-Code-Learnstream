// In-memory "Cloudinary" for MEDIA_PROVIDER=fake (D4 step 6: "Tests and e2e
// use MEDIA_PROVIDER=fake"). Shared between providers/fake.js (which reads
// it for verify()/remove()) and routes/test/fakeMedia.routes.js (which
// writes it as chunks arrive) — kept in its own module rather than inside
// either of those so neither has to import the other.
//
// Deliberately process-local: every e2e/dev run has exactly one backend
// process (global-setup.ts spawns one), and unit tests each get their own
// fresh module registry per file (Vitest's default isolation), so there is
// no cross-run leakage to guard against.
const uploads = new Map();
const assets = new Map();

/**
 * A video/promo (async) kind is marked not-ready for a short, fixed delay
 * after its last chunk lands — long enough that the UI's Uploading ->
 * Processing transition is real and pollable (useMediaStatus's 5s poll, or
 * an e2e test's own wait), short enough that no test has to wait anywhere
 * near Cloudinary's real transcode time or the 60s reconcile threshold that
 * only applies to the real provider (config/uploadPolicy.js).
 */
const FAKE_PROCESSING_DELAY_MS = 400;

export function beginFakeUpload(uploadId, { publicId, resourceType, isAsync, totalBytes }) {
  uploads.set(uploadId, {
    publicId,
    resourceType,
    isAsync,
    totalBytes,
    receivedBytes: 0,
  });
}

export function getFakeUpload(uploadId) {
  return uploads.get(uploadId);
}

export function receiveFakeChunk(uploadId, chunkLength) {
  const entry = uploads.get(uploadId);
  if (!entry) return;
  entry.receivedBytes += chunkLength;
}

/**
 * Finalizes a chunked upload into the durable-for-this-process asset store,
 * keyed by publicId (not uploadId — verify()/remove() are called with the
 * publicId the sign step minted, same as the real provider).
 */
export function finalizeFakeAsset({ publicId, resourceType, bytes, isAsync }) {
  const durationSec = resourceType === "video" ? 42 : undefined;
  const asset = {
    resourceType,
    bytes,
    durationSec,
    width: resourceType === "video" || resourceType === "image" ? 1280 : undefined,
    height: resourceType === "video" || resourceType === "image" ? 720 : undefined,
    url: `https://fake-media.test/${publicId}.${resourceType === "video" ? "mp4" : resourceType === "image" ? "jpg" : "bin"}`,
    hlsUrl: resourceType === "video" ? `https://fake-media.test/${publicId}.m3u8` : undefined,
    posterUrl: resourceType === "video" ? `https://fake-media.test/${publicId}.jpg` : undefined,
    ready: !isAsync,
  };
  assets.set(publicId, asset);

  if (isAsync) {
    setTimeout(() => {
      const current = assets.get(publicId);
      if (current) current.ready = true;
    }, FAKE_PROCESSING_DELAY_MS).unref?.();
  }

  return asset;
}

export function getFakeAsset(publicId) {
  return assets.get(publicId);
}

export function removeFakeAsset(publicId) {
  assets.delete(publicId);
}

// Test-only escape hatch: unit tests want a deterministic "already ready"
// asset without waiting out FAKE_PROCESSING_DELAY_MS.
export function forceFakeAssetReady(publicId) {
  const asset = assets.get(publicId);
  if (asset) asset.ready = true;
}
