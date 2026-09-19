import dotenv from "dotenv";

// The one and only dotenv.config() in the backend. It used to be called four
// times (app.js, index.js, cloudinary.js, UserStudent.controller.js) and worked
// only because import hoisting happened to run app.js's copy first — a load
// order no one had chosen and nothing enforced (BACKEND_AUDIT.md §4.6).
//
// dotenv does not overwrite variables already present in process.env, so a real
// environment (Render, or the e2e suite's spawn) still wins over the .env file.
dotenv.config();

const problems = [];

/** Reads a variable that the server cannot run without. */
function required(name, { description }) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    problems.push(`${name} is missing — ${description}`);
    return "";
  }
  return value.trim();
}

/** Reads a variable that has a safe fallback. */
function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function port(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    problems.push(`${name} must be an integer between 1 and 65535, got "${raw}"`);
    return fallback;
  }
  return parsed;
}

function originList(name) {
  // app.js used to do process.env.CORS_ORIGIN.split(",") at import. Unset, that
  // is a TypeError thrown from a module body — a stack trace about `split` of
  // undefined, which says nothing about the actual problem (§4.6).
  const raw = required(name, {
    description: "comma-separated list of allowed browser origins, e.g. http://localhost:2000",
  });
  const origins = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (raw && origins.length === 0) {
    problems.push(`${name} is set but contains no usable origin`);
  }
  return origins;
}

const nodeEnv = optional("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

// The one shared definition of the auth cookie flags (BACKEND_AUDIT.md
// §3.12) — previously hardcoded to the production values (secure: true,
// sameSite: "none") regardless of NODE_ENV. Production needs those, plus
// `partitioned`, because the Vercel frontend and Render backend are
// different sites, making these cookies cross-site by construction and
// exactly the kind Chrome blocks or drops without CHIPS (see
// UserAuth/auth.controller.js for the full history). Locally, frontend and
// backend differ only by port, which browsers treat as the same site, so
// `secure: true` would needlessly require HTTPS on localhost and
// `sameSite: "none"` needlessly relax a same-site cookie.
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  ...(isProduction ? { partitioned: true } : {}),
  maxAge: 24 * 60 * 60 * 1000, // 1 day
};

const config = {
  nodeEnv,
  isProduction,
  cookieOptions,
  port: port("PORT", 8000),
  mongodbUri: required("MONGODB_URI", {
    description: "MongoDB connection string, without the database name",
  }),
  corsOrigins: originList("CORS_ORIGIN"),
  accessToken: {
    secret: required("ACCESS_TOKEN_SECRET", { description: "signs short-lived access tokens" }),
    expiry: required("ACCESS_TOKEN_EXPIRY", { description: "e.g. 1d" }),
  },
  refreshToken: {
    secret: required("REFRESH_TOKEN_SECRET", { description: "signs long-lived refresh tokens" }),
    expiry: required("REFRESH_TOKEN_EXPIRY", { description: "e.g. 10d" }),
  },
  cloudinary: {
    cloudName: required("CLOUDINARY_CLOUD_NAME", { description: "Cloudinary account name" }),
    apiKey: required("CLOUDINARY_API_KEY", { description: "Cloudinary API key" }),
    apiSecret: required("CLOUDINARY_API_SECRET", { description: "Cloudinary API secret" }),
  },
  razorpay: {
    keyId: required("RAZORPAY_KEY_ID", { description: "Razorpay key id" }),
    keySecret: required("RAZORPAY_KEY_SECRET", { description: "Razorpay key secret" }),
    // Deliberately optional. B4 made POST /payment/webhook refuse every call
    // with a clear message while this is unset, rather than silently accepting
    // unverifiable payloads (§2.8). Promoting it to required here would stop
    // the whole server from booting over a feature that is not yet registered
    // in the Razorpay dashboard — a much worse failure than the one it guards.
    webhookSecret: optional("RAZORPAY_WEBHOOK_SECRET", null),
  },
  // Everything below is new in W0-B: keys that Wave 1 lanes (UPL, AUTH, e2e
  // fixtures) will need, added now so no later lane has to touch this frozen
  // file. All have dev-safe fallbacks — none of them can stop the server from
  // booting, because the features that read them either aren't wired up yet
  // (media/mail) or are purely test scaffolding (E2E_*).
  media: {
    // 'fake' lets local dev and CI run the media pipeline without a real
    // Cloudinary account — services/media/providers/fake.js is the
    // implementation this selects.
    provider: optional("MEDIA_PROVIDER", "cloudinary"),
    // Where Cloudinary calls back after an async upload/transcode finishes.
    // Optional: the direct-to-Cloudinary pipeline that needs this is a later
    // (UPL) lane's job, not Wave 0's.
    notificationUrl: optional("CLOUDINARY_NOTIFICATION_URL", ""),
    uploadFolder: optional("CLOUDINARY_UPLOAD_FOLDER", "learnstream"),
  },
  // AUTH (Wave 1) sends verification/OTP mail through this. Left unset in dev
  // — nodemailer is only imported by AUTH's own code, so an empty SMTP_URL
  // here is inert until that lane wires a transport up to it.
  smtpUrl: optional("SMTP_URL", ""),
  // Signs OTP payloads for the (also Wave 1) email/phone verification flow.
  // Deliberately `optional`, not `required`: promoting it now would stop
  // Wave 0's server from booting over a secret only a not-yet-written feature
  // reads, the same reasoning as `razorpay.webhookSecret` above. AUTH's own
  // lane is responsible for requiring a non-default value before it ships.
  otpSecret: optional("OTP_SECRET", "dev-only-otp-secret-change-me"),
  // Embedding + generation providers for the RAG chat assistant — Hugging
  // Face's hosted Inference API, called through the official
  // @huggingface/inference SDK (config/huggingface.js), not a self-hosted
  // model. apiToken/embeddingModel are optional for the same reason as
  // qdrant below; chatModel now backs a real route (lectures ".../ask").
  huggingFace: {
    // A fine-grained token with "Make calls to Inference Providers"
    // permission (huggingface.co/settings/tokens) — every request 401s
    // without one, even against the free tier.
    apiToken: optional("HF_API_TOKEN", ""),
    // BAAI/bge-base-en-v1.5: MIT-licensed, confirmed "warm" (ready, no cold
    // start) on HF's free hf-inference provider as of this writing, 768-dim
    // output. Swapping models means also updating QDRANT_EMBEDDING_DIM to
    // match — the two are not derived from each other on purpose, so a
    // model change can't silently desync an already-populated collection.
    embeddingModel: optional("HF_EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5"),
    // Qwen/Qwen2.5-7B-Instruct: Apache-2.0 (ungated — no license click-through
    // needed before the API will serve it, unlike the Llama family), and
    // confirmed "warm" on hf-inference as of this writing. Generates the
    // chat assistant's answers from the transcript chunks search.js retrieves.
    chatModel: optional("HF_CHAT_MODEL", "Qwen/Qwen2.5-7B-Instruct"),
  },
  // Vector store for the lecture-transcript RAG chat assistant (Phase 1 of
  // the AI feature plan — nothing reads these yet, this just gives the
  // Qdrant client and init script somewhere to read config from). Optional
  // for the same reason smtpUrl/razorpay.webhookSecret are: promoting these
  // to `required` would stop the whole server from booting over a feature
  // that isn't wired into any route yet.
  qdrant: {
    url: optional("QDRANT_URL", "http://localhost:6333"),
    // Blank for the local Docker Compose instance (docker-compose.yml sets
    // no API key either) — required once Qdrant is reachable off localhost.
    apiKey: optional("QDRANT_API_KEY", ""),
    collection: optional("QDRANT_COLLECTION", "lecture_transcript_chunks"),
    // Must match the output size of `huggingFace.embeddingModel` above —
    // 768 is BAAI/bge-base-en-v1.5's. Update both together if the model
    // ever changes.
    embeddingDim: (() => {
      const parsed = Number(optional("QDRANT_EMBEDDING_DIM", "768"));
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 768;
    })(),
  },
  // e2e-only scaffolding, gated by isProduction below wherever it's read
  // (see app.js's routes/test/* mount and the mail-outbox helper AUTH adds) —
  // "falsy by default" is what keeps these out of every real deployment.
  e2eMailOutbox: optional("E2E_MAIL_OUTBOX", "") === "1",
  e2eTestRoutes: optional("E2E_TEST_ROUTES", "") === "1",
};

if (problems.length > 0) {
  // One error listing everything wrong, not the first problem only: setting up
  // a fresh clone should take one pass, not one restart per missing variable.
  throw new Error(
    `Invalid backend environment — ${problems.length} problem(s) found:\n` +
      problems.map((problem) => `  • ${problem}`).join("\n") +
      `\n\nSet these in ${process.cwd()}/.env (see .env.example) or in the host's environment, then start again.`
  );
}

// §1.4 wrote access tokens to the logs for the lifetime of the deployment, so
// these two values are treated as compromised wherever they still hold the
// tutorial defaults this project was scaffolded from. A warning, not a throw:
// refusing to boot would take production down for a rotation that is the
// operator's call to schedule (tracked as B0).
for (const [name, value] of [
  ["ACCESS_TOKEN_SECRET", config.accessToken.secret],
  ["REFRESH_TOKEN_SECRET", config.refreshToken.secret],
]) {
  if (value === "chai-aur-code" || value === "chai-aur-backend") {
    console.warn(`[config] ${name} is still the public tutorial default — rotate it.`);
  }
}

export const env = Object.freeze(config);
