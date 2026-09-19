// User menu registry entry (docs/contracts/registries.md, stubs.md's
// UserMenu groups). Teachers never see Cart or Wishlist entries (stubs.md),
// so this is student-only.
export default [
  {
    group: 'Learning',
    items: [{ label: 'Wishlist', to: '/wishlist', roles: ['student'] }],
  },
];
