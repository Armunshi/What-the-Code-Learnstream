# e2e seed registry

Drop a `<name>.seed.ts` file here to add fixture data on top of the base
teacher/course/module/lecture/student fixture that `global-setup.ts` already
produces. Full contract: `e2e/lib/seed-registry.ts` and
`docs/contracts/registries.md` ("e2e seeds" row).

Quick version:

```ts
// e2e/seeds/catalog.seed.ts
import type { SeedCtx } from '../lib/seed-registry.js';
import { writeSeedOutput } from '../lib/seed-registry.js';

export async function seed(ctx: SeedCtx): Promise<void> {
  const extraCourse = await ctx.api.createCourse(ctx.teacher.accessToken, { /* ... */ }, '...');
  writeSeedOutput('catalog', { extraCourseId: extraCourse._id });
}
```

A spec then reads it back with `readSeed('catalog')` from the same module.

Never edit `global-setup.ts` or `lib/seed-registry.ts` to "hook up" a new
seed — just add a file here. Seeds run alphabetically by filename, after the
base fixture.
