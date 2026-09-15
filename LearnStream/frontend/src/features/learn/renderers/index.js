// Player renderers registry (docs/contracts/registries.md: "Player
// renderers" row, hosted by this lane). Each `renderers/*.jsx` file
// default-exports `{ type, Component }`; a lane that owns a content type
// not listed here (e.g. quiz) adds its own file to this directory later
// without editing this collector.
const modules = import.meta.glob("./*.jsx", { eager: true });

const renderersByType = Object.values(modules).reduce((acc, mod) => {
  const entry = mod.default;
  if (entry?.type && entry?.Component) acc[entry.type] = entry.Component;
  return acc;
}, {});

export function getRenderer(type) {
  return renderersByType[type] ?? null;
}

export default renderersByType;
