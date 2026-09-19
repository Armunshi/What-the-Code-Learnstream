export default {
  id: 'messages',
  group: 'publish',
  label: 'Course messages',
  path: 'publish/messages',
  order: 20,
  readinessKeys: [],
  lazy: () => import('./MessagesStepPage.jsx'),
};
