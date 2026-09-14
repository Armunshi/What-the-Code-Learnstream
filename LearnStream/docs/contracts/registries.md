# Glob registries

Source of truth: `UI_REQS_14_09_26_IMPLEMENTATION_PLAN.md` D11, §1.1, §1.2.

A registry is a directory that gets **auto-collected** by a `import.meta.glob`
(frontend) or an explicit directory scan (backend) — lanes add a new file to
the directory and never edit the file that does the collecting. This is the
mechanism that lets ten Wave 1 lanes run as ten parallel worktrees without
touching each other's lines in a shared router/menu/registry file.

**Rule:** if you find yourself editing `router.jsx`, `menuRegistry.js`,
`loadFeatureRoutes.js`, or any file in the table below to "hook up" your
feature, stop — you're supposed to be adding a file to a directory instead.
Editing one of these collector files is a Wave 0 frozen-file change and needs
an amendment.

## Frontend registries

| Registry | Location | Collected by | Entry shape |
|---|---|---|---|
| Feature routes | `features/*/routes.jsx` | `app/router.jsx` via `import.meta.glob` | React Router route objects |
| User menu | `features/*/menu.js` | `app/menuRegistry.js` | menu group/entry descriptors (see `UserMenu` groups in `stubs.md`) |
| Authoring steps | `features/instructor-course/steps/*/step.jsx` | authoring shell (SHELL) | `{ id, group: 'plan'\|'create'\|'publish', label, path, order, lazy, readinessKeys }` |
| Content types | `features/instructor-course/content-types/*/index.jsx` | authoring shell (SHELL) | `{ type, label, icon, Editor, createDefaults, available }` |
| Item editor panels | `features/instructor-course/item-editor-panels/*` | curriculum builder (CURR) | one panel component per content type |
| Curriculum toolbar actions | `features/instructor-course/steps/curriculum/toolbar-actions/*` | curriculum builder (CURR) | one toolbar action per file (e.g. bulk-upload) |
| Player renderers | `features/learn/renderers/*` | learn player (LEARN) | one renderer component per `CurriculumItems` `type` |

## Backend registries

| Registry | Location | Collected by | Entry shape |
|---|---|---|---|
| Feature routes | `routes/features/*.routes.js` | `routes/loadFeatureRoutes.js` | `{ basePath, priority, router }`, mounted sorted by `priority` |
| Readiness rules | `services/readiness/rules/*.rule.js` | `services/readiness/index.js` | a rule function contributing to `{percent, required[], recommended[]}` — see `services/readiness/rules/base.rule.js` for the signature |
| e2e seeds | `e2e/seeds/*.seed.ts` | `e2e/global-setup.ts` | exports `seed(ctx)`, runs after the base seed, writes `.auth/seeds/<name>.json` |

## Ownership manifests (`docs/lanes/<lane>.json`)

Every lane in `docs/lanes/` has:

```
{
  "owns": [ <globs the lane may create or edit> ],
  "appends": [ <specific new files the lane adds to a registry directory> ]
}
```

`e2e/scripts/check-lane-ownership.mjs <lane>` (owned by W0-C) diffs a lane's
branch against its integration base and fails if any changed file falls
outside `owns` ∪ `appends`. This runs as part of every lane's definition of
done (plan §10.4).

**"Owns" vs "appends":** `owns` is existing files/directories the lane may
freely edit (including files handed to it in the Wave 0 handoff table).
`appends` is specifically registry-directory entries or seed files the lane
adds — these are new files, never edits to an existing shared file, even
though the parent directory (e.g. `e2e/seeds/`) is shared across lanes.

## Frozen stubs vs registries — not the same mechanism

Registries let lanes **add new files**. Frozen stubs (see `stubs.md`) are the
opposite: a small, fixed set of **existing** cross-lane components created in
Wave 0 with a frozen signature, where exactly one named lane later replaces
the body (not the signature). Don't confuse "add a renderer to
`learn/renderers/*`" (a registry) with "replace the body of `CourseCard`" (a
stub) — the first is open to any lane that owns a content type, the second is
owned by exactly the lane named in `stubs.md`.
