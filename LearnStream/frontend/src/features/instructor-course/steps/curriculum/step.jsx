export default {
  id: 'curriculum',
  group: 'create',
  label: 'Curriculum',
  path: 'content/curriculum',
  order: 5,
  readinessKeys: [],
  lazy: () => import('./CurriculumStepPage.jsx'),
};
