// User menu registry entry (docs/contracts/registries.md, stubs.md's
// UserMenu groups: "Learning (My learning, Wishlist, My cart) ... Teachers
// never see Cart or Wishlist entries."). This lane only owns the "My cart"
// entry within the Learning group, matching the pattern my-learning/menu.js
// already established for its own single entry.
export default [
  {
    group: 'Learning',
    items: [{ label: 'My cart', to: '/cart', roles: ['student'] }],
  },
];
