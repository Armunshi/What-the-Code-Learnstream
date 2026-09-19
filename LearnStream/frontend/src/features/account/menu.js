// User menu registry entry (docs/contracts/registries.md, stubs.md's
// UserMenu groups). Account group entries: Account settings, Payment
// methods, Subscriptions, Purchase history — available to any authenticated
// role (unlike Learning's Wishlist/My cart, which are student-only).
export default [
  {
    group: 'Account',
    items: [
      { label: 'Account settings', to: '/account/profile' },
      { label: 'Payment methods', to: '/account/payment-methods' },
      { label: 'Subscriptions', to: '/account/subscriptions' },
      { label: 'Purchase history', to: '/account/purchases' },
    ],
  },
];
