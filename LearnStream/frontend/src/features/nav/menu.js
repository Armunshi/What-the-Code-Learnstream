// User menu registry entry (docs/contracts/registries.md, stubs.md's
// UserMenu groups). This lane appends only the Session group — per
// docs/lanes/nav.json, every other group's entries (Learning, Communication,
// Account, Roles) belong to the lanes that own the features behind them
// (my-learning/menu.js already contributes "My learning"; ACC and COM own
// the rest, per their own manifests).
//
// `action: 'logout'` is an entry shape UserMenu.jsx (this lane) also owns:
// unlike a `{ label, to, roles }` link, it has no route to navigate to, so
// UserMenu resolves it by calling its own useLogout() hook instead of
// rendering a Link.
export default [
  {
    group: 'Session',
    items: [{ label: 'Log out', action: 'logout', roles: ['student', 'teacher'] }],
  },
];
