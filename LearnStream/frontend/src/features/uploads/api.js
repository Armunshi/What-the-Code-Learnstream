import { privateClient } from '@/lib/api/privateClient';

// Thin wrappers around the D4 endpoints (backend/src/routes/features/
// uploads.routes.js) — every field name here matches that route's request/
// response shape exactly, so this is the one place that shape is spelled
// out on the frontend.

export async function signUpload({ courseId, target, file }) {
  const res = await privateClient.post('/instructor/uploads/sign', {
    courseId,
    target,
    file: { name: file.name, size: file.size, mime: file.type },
  });
  return res.data.data;
}

export async function completeUpload(uploadId, publicId) {
  const res = await privateClient.post(`/instructor/uploads/${uploadId}/complete`, { publicId });
  return res.data.data;
}

export async function failUpload(uploadId, { code, message } = {}) {
  const res = await privateClient.post(`/instructor/uploads/${uploadId}/fail`, { code, message });
  return res.data.data;
}

/** Returns an array of { id, status, mp4Url, hlsUrl, posterUrl, error }. */
export async function fetchMediaStatus(courseId, ids) {
  if (ids.length === 0) return [];
  const res = await privateClient.get(`/instructor/uploads/courses/${courseId}/status`, {
    params: { ids: ids.join(',') },
  });
  return res.data.data.items;
}
