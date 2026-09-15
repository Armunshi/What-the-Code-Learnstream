import { env } from "../../config/env.js";
import { cloudinaryProvider } from "./providers/cloudinary.js";
import { fakeProvider } from "./providers/fake.js";

// Selects the direct-to-Cloudinary pipeline's provider by MEDIA_PROVIDER
// (config/env.js) — D4, docs/contracts/domain-model.md. Wave 0 left this
// directory as a deliberately thin placeholder for the OLD multer-based
// path (see git history); the Wave 0 handoff table gave this lane full
// ownership of services/media/** to build the real thing, and nothing else
// in the codebase imports from here (the legacy module/lecture/assignment
// services call services/media.service.js directly), so this is a clean
// rewrite rather than a change to a depended-upon surface.
const providers = {
  cloudinary: cloudinaryProvider,
  fake: fakeProvider,
};

export const mediaProvider = providers[env.media.provider] ?? cloudinaryProvider;

if (env.media.provider === "fake" && env.isProduction) {
  // Same "warn, don't refuse to boot" posture config/env.js takes for the
  // tutorial-default secrets — this is exactly the deploy misconfiguration
  // D4's test rule (step 6) exists to keep out of production, but the
  // consequence (fake, unplayable media URLs) isn't severe enough to crash
  // the process over.
  console.warn("[media] MEDIA_PROVIDER=fake in production — uploads will not reach a real Cloudinary account.");
}

export { UPLOAD_KINDS, UPLOAD_POLICY, policyFor, CHUNK_SIZE_BYTES } from "../../config/uploadPolicy.js";
