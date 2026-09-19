import { privateClient } from '@/lib/api/privateClient';

// These three endpoints are `optionalAuth` (docs/contracts/api-conventions.md):
// they work for a guest and personalize for a logged-in viewer (an
// enrolled/owning viewer's curriculum carries real media, a draft course's
// landing is visible to its owner). privateClient degrades correctly for a
// guest too — with no token in tokenStore it attaches no Authorization
// header at all, so a guest request looks identical to one made through
// publicClient, while still picking up a logged-in viewer's identity when
// there is one.

export async function fetchCourseLanding(courseId) {
  const { data } = await privateClient.get(`/courses/${courseId}/landing`);
  return data.data;
}

export async function fetchCurriculum(courseId) {
  const { data } = await privateClient.get(`/courses/${courseId}/curriculum`);
  return data.data;
}

export async function fetchItemPlayback(courseId, itemId) {
  const { data } = await privateClient.get(`/courses/${courseId}/items/${itemId}/playback`);
  return data.data;
}
