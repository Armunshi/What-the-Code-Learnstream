import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chunkedUpload, readInflightUpload } from './chunkedUpload';

const SIGNED = {
  uploadUrl: 'https://fake.test/upload/video',
  fields: { public_id: 'course/promo/abc', eager_async: true },
  chunkSizeBytes: 10,
  publicId: 'course/promo/abc',
};

function makeFile(byteLength, name = 'video.mp4', lastModified = 1700000000000) {
  return new File([new Uint8Array(byteLength)], name, { type: 'video/mp4', lastModified });
}

function contentRangeHeader(call) {
  return call[1].headers['Content-Range'];
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 200 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete window.__E2E_FORCE_UPLOAD_FAILURE__;
});

describe('chunkedUpload — chunk ranges', () => {
  it('splits a file into chunkSizeBytes pieces with correct Content-Range headers', async () => {
    const file = makeFile(25);
    const progress = [];

    await chunkedUpload({
      file,
      courseId: 'course1',
      target: { kind: 'course-promo' },
      signed: SIGNED,
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(contentRangeHeader(fetch.mock.calls[0])).toBe('bytes 0-9/25');
    expect(contentRangeHeader(fetch.mock.calls[1])).toBe('bytes 10-19/25');
    expect(contentRangeHeader(fetch.mock.calls[2])).toBe('bytes 20-24/25');
    expect(progress.at(-1)).toBe(1);
  });

  it('sends the same X-Unique-Upload-Id header on every chunk of one upload', async () => {
    const file = makeFile(21);

    await chunkedUpload({
      file,
      courseId: 'course1',
      target: { kind: 'course-promo' },
      signed: SIGNED,
    });

    const ids = fetch.mock.calls.map((call) => call[1].headers['X-Unique-Upload-Id']);
    expect(new Set(ids).size).toBe(1);
  });

  it('sends one chunk for a file smaller than chunkSizeBytes', async () => {
    const file = makeFile(4);

    await chunkedUpload({ file, courseId: 'course1', target: { kind: 'course-promo' }, signed: SIGNED });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(contentRangeHeader(fetch.mock.calls[0])).toBe('bytes 0-3/4');
  });

  it('clears the localStorage resume record once every chunk lands', async () => {
    const file = makeFile(15);

    await chunkedUpload({ file, courseId: 'course1', target: { kind: 'item-video', itemId: 'item1' }, signed: SIGNED });

    expect(readInflightUpload({ courseId: 'course1', kind: 'item-video', itemId: 'item1' })).toBeNull();
  });
});

describe('chunkedUpload — retry', () => {
  it('retries a failing chunk and succeeds once a retry lands', async () => {
    vi.useFakeTimers();
    let calls = 0;
    fetch.mockImplementation(async () => {
      calls += 1;
      if (calls < 3) return new Response(null, { status: 500 });
      return new Response(null, { status: 200 });
    });

    const file = makeFile(5);
    const uploadPromise = chunkedUpload({ file, courseId: 'course1', target: { kind: 'course-promo' }, signed: SIGNED });

    await vi.runAllTimersAsync();
    await uploadPromise;

    expect(calls).toBe(3);
  });

  it('gives up after exhausting its retries and throws', async () => {
    vi.useFakeTimers();
    fetch.mockImplementation(async () => new Response(null, { status: 500 }));

    const file = makeFile(5);
    const uploadPromise = chunkedUpload({ file, courseId: 'course1', target: { kind: 'course-promo' }, signed: SIGNED });
    const assertion = expect(uploadPromise).rejects.toThrow();

    await vi.runAllTimersAsync();
    await assertion;

    // 1 initial attempt + 3 retries, per config/uploadPolicy.js's CHUNK_MAX_RETRIES.
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('aborts immediately without retrying when the signal is already aborted', async () => {
    const file = makeFile(5);
    const controller = new AbortController();
    controller.abort();

    await expect(
      chunkedUpload({ file, courseId: 'course1', target: { kind: 'course-promo' }, signed: SIGNED, signal: controller.signal })
    ).rejects.toThrow();

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('chunkedUpload — resume via fingerprint', () => {
  it('resumes from the last persisted byte offset for the same file and publicId', async () => {
    const file = makeFile(30);
    localStorage.setItem(
      'upl:inflight:course1:course-promo:',
      JSON.stringify({
        fingerprint: `${file.name}:${file.size}:${file.lastModified}`,
        publicId: SIGNED.publicId,
        uniqueUploadId: 'resume-id-123',
        receivedBytes: 20,
        totalBytes: 30,
        fileName: file.name,
      })
    );

    await chunkedUpload({ file, courseId: 'course1', target: { kind: 'course-promo' }, signed: SIGNED });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(contentRangeHeader(fetch.mock.calls[0])).toBe('bytes 20-29/30');
    expect(fetch.mock.calls[0][1].headers['X-Unique-Upload-Id']).toBe('resume-id-123');
  });

  it('starts from scratch when the file does not match the stored fingerprint', async () => {
    localStorage.setItem(
      'upl:inflight:course1:course-promo:',
      JSON.stringify({
        fingerprint: 'a-different-file.mp4:999:123',
        publicId: SIGNED.publicId,
        uniqueUploadId: 'stale-id',
        receivedBytes: 20,
        totalBytes: 999,
        fileName: 'a-different-file.mp4',
      })
    );

    const file = makeFile(15);
    await chunkedUpload({ file, courseId: 'course1', target: { kind: 'course-promo' }, signed: SIGNED });

    expect(contentRangeHeader(fetch.mock.calls[0])).toBe('bytes 0-9/15');
  });
});
