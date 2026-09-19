// User menu registry entry (docs/contracts/registries.md, stubs.md's
// UserMenu groups). This lane only owns the "My learning" entry within the
// Learning group — Wishlist and My cart belong to other lanes and are not
// added here. No consumer of app/menuRegistry.js exists yet (NAV/SHELL land
// SiteHeader's UserMenu in a later lane), so this shape is a first-mover
// choice: one group descriptor with a list of `{ label, to, roles }` entries.
export default [
  {
    group: "Learning",
    items: [{ label: "My learning", to: "/my-learning", roles: ["student"] }],
  },
];
