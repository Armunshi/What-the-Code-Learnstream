// Collector for the authoring-steps registry (docs/contracts/registries.md
// "Authoring steps"): `steps/*/step.jsx` files are auto-collected via
// `import.meta.glob` and this file is never edited to "hook up" a new step —
// a lane adds `steps/<id>/step.jsx` and it appears here automatically.
//
// Each `step.jsx` default-exports:
//   {
//     id, group: 'plan' | 'create' | 'publish', label,
//     path,             // relative to /instructor/courses/:courseId, e.g. 'plan/learners'
//     order,            // sort key within its group
//     readinessKeys,    // readiness rule keys (backend readiness/rules/*.rule.js) this step addresses
//     lazy,             // () => import('./SomePage.jsx') — a React Router v7 `lazy` route loader
//   }
const stepModules = import.meta.glob('./*/step.jsx', { eager: true });

const GROUP_ORDER = ['plan', 'create', 'publish'];

export const stepRegistry = Object.values(stepModules)
  .map((mod) => mod.default)
  .filter(Boolean)
  .sort((a, b) => {
    const groupDiff = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    if (groupDiff !== 0) return groupDiff;
    return (a.order ?? 0) - (b.order ?? 0);
  });

export const GROUP_LABELS = { plan: 'Plan', create: 'Create', publish: 'Publish' };

export function getStepsByGroup() {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    steps: stepRegistry.filter((step) => step.group === group),
  })).filter((entry) => entry.steps.length > 0);
}

export function getStepById(stepId) {
  return stepRegistry.find((step) => step.id === stepId) ?? null;
}

/** The first step's `path` — where `/instructor/courses/:courseId` (no sub-path) redirects to. */
export function getFirstStepPath() {
  return stepRegistry[0]?.path ?? '';
}

/**
 * The step (if any) whose `readinessKeys` covers a given failing readiness
 * item's `key` — used by the review step and sidebar to turn a failing
 * readiness item into a "fix" link.
 */
export function getStepForReadinessKey(key) {
  return stepRegistry.find((step) => step.readinessKeys?.includes(key)) ?? null;
}

export default stepRegistry;
