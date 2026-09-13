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

const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
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
