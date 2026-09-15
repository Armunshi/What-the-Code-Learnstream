// Each feature owns its own query keys (plan §2.1).
export const courseKeys = {
  landing: (courseId) => ['course', courseId, 'landing'],
  curriculum: (courseId) => ['course', courseId, 'curriculum'],
  playback: (courseId, itemId) => ['course', courseId, 'items', itemId, 'playback'],
};
