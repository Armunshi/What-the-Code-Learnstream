// Content-Range chunked upload engine (D4: "The browser sends 20 MB chunks
// ... retrying each chunk 3x with backoff"). No React here on purpose —
// uploadQueueStore.js is the only caller, and keeping the transfer logic
// framework-free makes it independently testable (see __tests__/).
const MAX_CHUNK_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

function randomUploadId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // jsdom/older browsers: good enough for a per-upload correlation id, which
  // is all X-Unique-Upload-Id is ever used for.
  return `upl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fingerprintFor(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function inflightKey(courseId, kind, itemId) {
  return `upl:inflight:${courseId}:${kind}:${itemId ?? ''}`;
}

function readInflight(courseId, kind, itemId) {
  try {
    const raw = localStorage.getItem(inflightKey(courseId, kind, itemId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeInflight(courseId, kind, itemId, record) {
  try {
    localStorage.setItem(inflightKey(courseId, kind, itemId), JSON.stringify(record));
  } catch {
    // Resume is a convenience, not a correctness requirement — a full
    // localStorage or a private-mode browser just means no resume.
  }
}

export function clearInflightUpload({ courseId, kind, itemId }) {
  try {
    localStorage.removeItem(inflightKey(courseId, kind, itemId));
  } catch {
    // See writeInflight.
  }
}

/**
 * A record left by an upload that never reached /complete — MediaUploadField
 * reads this on mount to show "Upload interrupted" (D4's field-state list)
 * instead of silently going back to Idle. Only meaningful for the exact
 * file it was started with — fingerprint-matched by the caller, not here.
 */
export function readInflightUpload({ courseId, kind, itemId }) {
  return readInflight(courseId, kind, itemId);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test-only escape hatch (D4's harness e2e test: "a forced chunk failure
 * succeeds on Retry"). Only ever checked when the harness build flag is on
 * — see routes.jsx — so this can never affect a production bundle's
 * behavior even if the global were somehow set.
 */
function isForcedFailureActive() {
  return import.meta.env.VITE_E2E_HARNESS === '1' && typeof window !== 'undefined' && window.__E2E_FORCE_UPLOAD_FAILURE__;
}

async function uploadOneChunk({ uploadUrl, fields, uploadId, chunk, start, end, total, signal }) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }

    if (isForcedFailureActive()) {
      lastError = new Error('Forced chunk failure (e2e harness)');
    } else {
      try {
        const body = new FormData();
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined && value !== null) body.append(key, String(value));
        }
        body.append('file', chunk);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body,
          signal,
          headers: {
            'X-Unique-Upload-Id': uploadId,
            'Content-Range': `bytes ${start}-${end}/${total}`,
          },
        });
        if (!response.ok) {
          throw new Error(`Chunk upload failed with status ${response.status}`);
        }
        return;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        lastError = error;
      }
    }

    if (attempt < MAX_CHUNK_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError ?? new Error('Chunk upload failed');
}

/**
 * Uploads `file` directly to the provider `signed.uploadUrl` (Cloudinary or,
 * under MEDIA_PROVIDER=fake, routes/test/fakeMedia.routes.js), in
 * `signed.chunkSizeBytes` pieces. `courseId`/`target` identify the upload
 * for the localStorage resume record — NOT sent to the server, which only
 * ever sees `uploadId`/`fields` from the sign() response.
 *
 * Resume: if a previous, incomplete attempt for the exact same file (same
 * name/size/lastModified) left a record for this same course+target, this
 * picks up from its last confirmed byte offset using the SAME
 * X-Unique-Upload-Id rather than starting over — both Cloudinary's real
 * chunked-upload protocol and fakeMedia.routes.js key an in-progress upload
 * by that header. This only helps within the SAME backend process (a
 * frontend-only reload); if the backend itself restarted, the resume
 * attempt 404s/400s like any other stale upload and the caller's retry
 * logic surfaces it as a normal failure — re-signing from scratch is the
 * recovery, same as any other failed upload.
 */
export async function chunkedUpload({ file, courseId, target, signed, onProgress, signal }) {
  const { kind, itemId } = target;
  const total = file.size;
  const fingerprint = fingerprintFor(file);

  const existing = readInflight(courseId, kind, itemId);
  const resuming = existing && existing.fingerprint === fingerprint && existing.publicId === signed.publicId;

  const uniqueUploadId = resuming ? existing.uniqueUploadId : randomUploadId();
  let start = resuming ? existing.receivedBytes : 0;

  const persist = (receivedBytes) =>
    writeInflight(courseId, kind, itemId, {
      fingerprint,
      publicId: signed.publicId,
      uniqueUploadId,
      receivedBytes,
      totalBytes: total,
      fileName: file.name,
    });

  persist(start);
  onProgress?.(start / total);

  while (start < total) {
    const end = Math.min(start + signed.chunkSizeBytes, total) - 1;
    const chunk = file.slice(start, end + 1);
    await uploadOneChunk({
      uploadUrl: signed.uploadUrl,
      fields: signed.fields,
      uploadId: uniqueUploadId,
      chunk,
      start,
      end,
      total,
      signal,
    });
    start = end + 1;
    persist(start);
    onProgress?.(start / total);
  }

  clearInflightUpload({ courseId, kind, itemId });
}
