export default {
  id: 'learners',
  group: 'plan',
  label: 'Intended learners',
  path: 'plan/learners',
  order: 10,
  readinessKeys: ['learningObjectives', 'requirements', 'targetAudience'],
  lazy: () => import('./LearnersStepPage.jsx'),
};
