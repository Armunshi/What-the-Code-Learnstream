import { privateClient } from '@/lib/api/privateClient';

// Thin wrappers over the W1-SHELL backend endpoints (backend/src/routes/
// features/{instructorCourses,instructorLearners,readiness}.routes.js).
// Every call here needs a logged-in teacher, hence privateClient throughout
// — there is no guest-facing authoring endpoint.

export async function listInstructorCourses() {
  const res = await privateClient.get('/instructor/courses');
  return res.data.data.items;
}

export async function createInstructorCourse(title) {
  const res = await privateClient.post('/instructor/courses', { title });
  return res.data.data.course;
}

export async function getInstructorCourse(courseId) {
  const res = await privateClient.get(`/instructor/courses/${courseId}`);
  return res.data.data.course;
}

export async function deleteInstructorCourse(courseId) {
  await privateClient.delete(`/instructor/courses/${courseId}`);
}

export async function getCourseReadiness(courseId) {
  const res = await privateClient.get(`/instructor/courses/${courseId}/readiness`);
  return res.data.data;
}

// Publish/unpublish never conflict on editVersion (docs/lanes/shell.json —
// only the learners PATCH is version-guarded), but publish can still fail
// with 422 when required readiness rules aren't met — surfaced by throwing,
// same as any other error, so callers use the normal mutation onError path
// rather than a bespoke return shape.
export async function publishCourse(courseId) {
  const res = await privateClient.post(`/instructor/courses/${courseId}/publish`);
  return res.data.data.course;
}

export async function unpublishCourse(courseId) {
  const res = await privateClient.post(`/instructor/courses/${courseId}/unpublish`);
  return res.data.data.course;
}

// The one guarded write in this lane (D2/D3 optimistic locking). A 409 is
// NOT thrown as an error here — it's the expected "someone/something else
// saved first" outcome useAutosave's state machine treats as a first-class
// state (`conflict`), not a failure to report through react-query's onError.
export async function updateCourseLearners(courseId, payload) {
  try {
    const res = await privateClient.patch(`/instructor/courses/${courseId}/learners`, payload);
    return { conflict: false, course: res.data.data.course };
  } catch (err) {
    if (err?.response?.status === 409) {
      return { conflict: true, current: err.response.data.current };
    }
    throw err;
  }
}

// Same editVersion-guarded shape as updateCourseLearners above — see
// instructorPricing.routes.js.
export async function updateCoursePricing(courseId, payload) {
  try {
    const res = await privateClient.patch(`/instructor/courses/${courseId}/pricing`, payload);
    return { conflict: false, course: res.data.data.course };
  } catch (err) {
    if (err?.response?.status === 409) {
      return { conflict: true, current: err.response.data.current };
    }
    throw err;
  }
}
