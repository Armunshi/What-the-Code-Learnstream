import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// Three transports, picked once at module load (not per-send — the choice
// depends only on env, which doesn't change mid-process):
//   - SMTP_URL set: a real transport, used in production and in any dev
//     setup that wants real emails.
//   - dev without SMTP_URL: nodemailer's own jsonTransport, which never
//     touches the network and instead hands the composed message back as
//     JSON — logged to the console so a developer can read the OTP without
//     configuring SMTP.
//   - production without SMTP_URL: no transport at all. sendMail below
//     throws a 503 rather than silently pretending to send.
function createTransport() {
  if (env.smtpUrl) {
    return nodemailer.createTransport(env.smtpUrl);
  }
  if (!env.isProduction) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return null;
}

const transport = createTransport();

// e2e-only in-memory outbox (docs/contracts/api-conventions.md — gated
// behind E2E_MAIL_OUTBOX=1, never a production code path). routes/test/
// outbox.routes.js reads this; nothing else does. A plain array is fine —
// it lives only for the lifetime of one e2e backend process.
const outbox = [];

export function getOutboxMessages(email) {
  const normalized = email.trim().toLowerCase();
  return outbox.filter((message) => message.to === normalized);
}

export function clearOutbox() {
  outbox.length = 0;
}

/**
 * Sends one email. Throws a 503 ApiError in production with no SMTP_URL
 * configured, rather than silently dropping the message — a signup OTP
 * that never arrives needs to fail loudly, not look like a slow inbox.
 */
export async function sendMail({ to, subject, text, html, outboxMeta }) {
  if (!transport) {
    throw new ApiError(503, "Mail is not configured on this server (SMTP_URL is unset)");
  }

  const normalizedTo = to.trim().toLowerCase();
  // MAIL_FROM isn't part of config/env.js (that file is Wave 0's, frozen —
  // see docs/contracts/registries.md). Read directly rather than adding a
  // key there; a from-address has a safe, working default either way.
  const from = process.env.MAIL_FROM?.trim() || "LearnStream <no-reply@learnstream.test>";
  const info = await transport.sendMail({
    from,
    to: normalizedTo,
    subject,
    text,
    html,
  });

  if (!env.smtpUrl) {
    // jsonTransport's `message` is the JSON-encoded envelope it would have
    // sent — printing it is what lets a developer read an OTP without SMTP.
    console.log(`[mail] ${subject} -> ${normalizedTo}\n${info.message}`);
  }

  if (env.e2eMailOutbox && !env.isProduction) {
    // outboxMeta (e.g. { code }) is never part of the real email, only of
    // the e2e-only outbox record — it's how the Playwright harness reads an
    // OTP back structurally instead of regex-parsing prose out of `text`.
    outbox.push({ to: normalizedTo, subject, text, html, sentAt: new Date().toISOString(), ...outboxMeta });
  }

  return info;
}

export async function sendOtpMail({ to, code, purpose = "verify your email" }) {
  const subject = "Your LearnStream verification code";
  const text = `Your LearnStream code to ${purpose} is ${code}. It expires in 15 minutes.`;
  const html = `<p>Your LearnStream code to ${purpose} is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`;
  return sendMail({ to, subject, text, html, outboxMeta: { code } });
}
