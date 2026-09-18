export default {
  id: 'pricing',
  group: 'plan',
  label: 'Pricing',
  path: 'plan/pricing',
  order: 20,
  readinessKeys: [],
  lazy: () => import('./PricingStepPage.jsx'),
};
