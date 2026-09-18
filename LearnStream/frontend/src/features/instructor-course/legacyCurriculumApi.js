import { privateClient } from '@/lib/api/privateClient';

// Wraps backend/src/routes/CourseRoutes/{modules,lectures,assignments}.routes.js
// — a different, older backend surface than this feature's own api.js (which
// wraps the newer /instructor/courses W1-SHELL routes). Curriculum authoring
// (adding sections, lectures, assignments) was never rebuilt against the new
// surface; these endpoints are still the only place it works. Every write
// here is mirrored into the new CurriculumItems collection in real time by
// services/curriculum/sync.js, so nothing here needs new backend work — the
// new /learn, /courses/:id/curriculum, and /users/me/learning read paths see
// it immediately.

export async function listModules(courseId) {
  const res = await privateClient.get(`/courses/${courseId}/modules`);
  return res.data.data;
}

export async function createModule(courseId, { title, description }) {
  const res = await privateClient.post(`/courses/${courseId}/modules`, { title, description });
  return res.data.data;
}

export async function deleteModule(courseId, moduleId) {
  await privateClient.delete(`/courses/${courseId}/modules/${moduleId}`);
}

export async function addLecture(courseId, moduleId, { title, videoFile }) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('videourl', videoFile);
  const res = await privateClient.post(`/courses/${courseId}/modules/${moduleId}/lectures`, formData);
  return res.data.data;
}

export async function deleteLecture(courseId, moduleId, lectureId) {
  await privateClient.delete(`/courses/${courseId}/modules/${moduleId}/lectures/${lectureId}`);
}

// Plumbing only — nothing reads or processes this yet; it's there so a
// future lecture-level RAG chatbot has somewhere to pull its source
// documents from.
export async function uploadLectureTranscript(courseId, moduleId, lectureId, file) {
  const formData = new FormData();
  formData.append('transcript', file);
  const res = await privateClient.post(
    `/courses/${courseId}/modules/${moduleId}/lectures/${lectureId}/transcript`,
    formData
  );
  return res.data.data;
}

export async function addAssignment(courseId, moduleId, { title, deadline, files }) {
  const formData = new FormData();
  formData.append('title', title);
  if (deadline) formData.append('deadline', deadline);
  files.forEach((file) => formData.append('assignmentFiles', file));
  const res = await privateClient.post(`/courses/${courseId}/modules/${moduleId}/assignments`, formData);
  return res.data.data;
}

export async function deleteAssignment(courseId, moduleId, assignmentId) {
  await privateClient.delete(`/courses/${courseId}/modules/${moduleId}/assignments/${assignmentId}`);
}
