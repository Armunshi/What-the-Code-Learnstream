export default {
  id: 'promotions',
  group: 'publish',
  label: 'Promotions',
  path: 'publish/promotions',
  order: 10,
  readinessKeys: [],
  lazy: () => import('./PromotionsStepPage.jsx'),
};
