import { privateClient } from "@/lib/api/privateClient";

// Thin wrappers around the /learn and /users/me/learning endpoints
// (backend/src/routes/features/{learn,myLearning}.routes.js). Every call
// unwraps the shared ApiResponse envelope (`{ data }`) so callers get the
// plain DTO.

export async function getLearnTree(courseId) {
  const { data } = await privateClient.get(`/learn/${courseId}`);
  return data.data;
}

export async function markItemAccessed(courseId, itemId) {
  const { data } = await privateClient.get(`/learn/${courseId}/items/${itemId}`);
  return data.data;
}

export async function recordWatchPosition(courseId, itemId, payload) {
  const { data } = await privateClient.put(`/learn/${courseId}/items/${itemId}/position`, payload);
  return data.data;
}

export async function completeItem(courseId, itemId) {
  const { data } = await privateClient.post(`/learn/${courseId}/items/${itemId}/complete`, {});
  return data.data;
}
