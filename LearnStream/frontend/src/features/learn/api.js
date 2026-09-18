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

// The assignment item type's own material/submission endpoints live under
// /courses, not /learn (backend/src/routes/CourseRoutes/assignments.routes.js)
// — pre-dating the /learn tree, but still the only place this data lives.
// An assignment CurriculumItem's `id` is the same _id as the underlying
// Assignment document (services/curriculum/sync.js preserves it on purpose),
// so `itemId` here is exactly the `assignmentId` these routes expect.
export async function getAssignmentDetail(courseId, assignmentId) {
  const { data } = await privateClient.get(`/courses/${courseId}/assignments/${assignmentId}`);
  return data.data;
}

export async function submitAssignmentFiles(courseId, assignmentId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("submissionFiles", file));
  const { data } = await privateClient.post(
    `/courses/${courseId}/assignments/${assignmentId}/upload`,
    formData
  );
  return data.data;
}
