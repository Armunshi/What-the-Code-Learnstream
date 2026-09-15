// Registry collector for the user menu (docs/contracts/registries.md).
// Lanes add a `features/<feature>/menu.js` file exporting a default array of
// menu group/entry descriptors; this file collects them via
// `import.meta.glob` and is never edited again to "hook up" a feature — per
// the registry rule, editing this file to add a feature is itself the
// mistake the registry pattern exists to prevent.
const menuModules = import.meta.glob('../features/*/menu.js', { eager: true });

export const menuGroups = Object.values(menuModules)
  .map((mod) => mod.default)
  .filter(Boolean)
  .flat();

export default menuGroups;
