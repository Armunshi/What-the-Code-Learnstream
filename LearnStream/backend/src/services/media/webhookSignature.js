import crypto from "crypto";

// Cloudinary's documented notification-signature algorithm: sha1(rawBody +
// timestamp + api_secret), sent back as the X-Cld-Signature header
// alongside X-Cld-Timestamp. Deliberately provider-agnostic — it is keyed
// only on env.cloudinary.apiSecret, never on MEDIA_PROVIDER, so the exact
// same verify() call authenticates a real Cloudinary webhook in production
// and a synthetically-signed one in tests. That is also what BACKEND_AUDIT.md
// -style "never trust the client" means for this endpoint: the signature is
// the only thing standing between a random POST and a media status flip.
export function signWebhookPayload(rawBody, timestamp, apiSecret) {
  return crypto
    .createHash("sha1")
    .update(`${rawBody}${timestamp}${apiSecret}`)
    .digest("hex");
}

export function verifyWebhookSignature({ rawBody, timestamp, signature, apiSecret }) {
  if (!timestamp || !signature) return false;
  const expected = signWebhookPayload(rawBody, timestamp, apiSecret);
  const expectedBuf = Buffer.from(expected, "hex");
  const givenBuf = Buffer.from(String(signature), "hex");
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}
