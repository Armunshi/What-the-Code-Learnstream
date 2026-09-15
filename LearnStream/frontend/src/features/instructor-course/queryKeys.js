// Query keys for the instructor-course (authoring) feature — each feature
// owns its own keys file (plan §2.1) rather than sharing one central keys
// module across lanes.
export const instructorCourseKeys = {
  all: ['instructor-courses'],
  lists: () => [...instructorCourseKeys.all, 'list'],
  detail: (courseId) => [...instructorCourseKeys.all, 'detail', courseId],
  readiness: (courseId) => [...instructorCourseKeys.all, 'readiness', courseId],
};

export default instructorCourseKeys;
