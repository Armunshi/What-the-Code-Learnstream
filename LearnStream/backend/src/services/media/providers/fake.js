import { env } from "../../../config/env.js";
import { getFakeAsset, removeFakeAsset } from "./fakeStore.js";

// Fake provider — no network call, no real Cloudinary account needed
// (D4 step 6: "Tests and e2e use MEDIA_PROVIDER=fake"). The browser still
// does a real chunked HTTP upload, just against our own
// routes/test/fakeMedia.routes.js instead of Cloudinary, so the frontend's
// chunkedUpload.js needs no provider-specific branch at all — it only ever
// looks at the uploadUrl/fields this (or the cloudinary provider's) sign()
// hands back.
function sign({ publicId, resourceType, isAsync }) {
  return {
    uploadUrl: `${fakeMediaBasePath()}/upload/${resourceType}`,
    fields: {
      public_id: publicId,
      eager_async: isAsync,
    },
  };
}

// routes/test/fakeMedia.routes.js mounts under E2E_TEST_ROUTES's basePath;
// kept as a function (not a constant) so it always reflects the current
// env at call time rather than whatever it was at module load.
function fakeMediaBasePath() {
  return "/__e2e__/media";
}

async function verify({ publicId }) {
  const asset = getFakeAsset(publicId);
  if (!asset) return { found: false, ready: false };
  if (!asset.ready) return { found: true, ready: false };
  return {
    found: true,
    ready: true,
    bytes: asset.bytes,
    durationSec: asset.durationSec,
    width: asset.width,
    height: asset.height,
    url: asset.url,
    hlsUrl: asset.hlsUrl,
    posterUrl: asset.posterUrl,
  };
}

async function remove({ publicId }) {
  removeFakeAsset(publicId);
}

export const fakeProvider = { name: "fake", sign, verify, remove };

// Exported purely so a defensive assertion (never reached in normal
// operation — MEDIA_PROVIDER=fake is opt-in) can confirm this module was
// only ever meant to run outside production.
export const isFakeProviderSafeHere = () => !env.isProduction;
