export default {
  id: 'review',
  group: 'publish',
  label: 'Publish your course',
  path: 'publish/review',
  order: 100,
  readinessKeys: [],
  lazy: () => import('./ReviewStepPage.jsx'),
};
