export default {
  id: 'test-video',
  group: 'create',
  label: 'Film & edit',
  path: 'content/test-video',
  order: 10,
  readinessKeys: [],
  lazy: () => import('./TestVideoStepPage.jsx'),
};
