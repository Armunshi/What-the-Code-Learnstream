// The "e2e seeds" registry (docs/contracts/registries.md): a lane that needs
// its own fixture data adds a file matching e2e/seeds/*.seed.ts exporting
// `async function seed(ctx: SeedCtx)`. This module is what collects and runs
// those files — a lane never edits this file or global-setup.ts to "hook up"
// its seed, it only adds a new file to e2e/seeds/.
//
// Contract for a seed file:
//   - export `async function seed(ctx: SeedCtx): Promise<void>`
//   - runs AFTER the base fixture (teacher/student/course/module/lectures)
//     that global-setup.ts already produces — ctx carries that fixture's
//     ids and authenticated tokens so a seed can build on top of it instead
//     of re-creating a teacher/course from scratch.
//   - if a spec needs to read what the seed produced, the seed writes it via
//     writeSeedOutput(name, data) and the spec reads it back via
//     readSeed(name) — name is the seed's own filename without the
//     `.seed.ts` suffix.
//   - seeds run in alphabetical order by filename, so a seed that depends on
//     another seed's output can rely on that ordering (name accordingly).
//
// Zero files in e2e/seeds/ is a valid, safe state — runSeeds() is a no-op in
// that case. As of Wave 0, no lane has an actual *.seed.ts file yet; they're
// added by later waves without ever touching this file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Credentials } from './api-client.js';
import * as api from './api-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = path.resolve(__dirname, '..');
const SEEDS_DIR = path.join(E2E_ROOT, 'seeds');
const SEEDS_OUTPUT_DIR = path.join(E2E_ROOT, '.auth/seeds');

/**
 * What global-setup.ts already has in scope by the time the base fixture is
 * done, passed through so a seed doesn't have to re-derive it. Deliberately
 * minimal — a seed that needs more (another course, a different role, a
 * fresh signup) can call the exported `api` helpers itself rather than this
 * growing a field per lane's need.
 */
export interface SeedCtx {
  /** Shared per-run suffix (e.g. Date.now().toString(36)) the base fixture
   *  used for its own emails/titles — reuse it to keep a seed's own fixture
   *  data equally unique and equally traceable to one run. */
  runId: string;
  teacher: { creds: Credentials; accessToken: string };
  student: { creds: Credentials; accessToken: string };
  /** Ids from the base fixture's course/module/two lectures. */
  course: {
    id: string;
    moduleId: string;
    lectureId: string;
    lecture2Id: string;
  };
  /** The same authenticated-request helpers global-setup.ts itself uses
   *  (signupTeacher, loginTeacher, createCourse, createModule, createLecture,
   *  createOrder, sendWebhook, ...) — see lib/api-client.ts. */
  api: typeof api;
  backendUrl: string;
}

interface SeedModule {
  seed: (ctx: SeedCtx) => Promise<void>;
}

/** A seed's own helper: writes its output where readSeed(name) will find it. */
export function writeSeedOutput(name: string, data: unknown): void {
  fs.mkdirSync(SEEDS_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SEEDS_OUTPUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

/**
 * Reads back what e2e/seeds/<name>.seed.ts wrote via writeSeedOutput(name, ...).
 * For spec files: `const fixture = readSeed('catalog')`.
 */
export function readSeed<T = unknown>(name: string): T {
  const file = path.join(SEEDS_OUTPUT_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No seed output found for "${name}" at ${file}. ` +
        `Does e2e/seeds/${name}.seed.ts exist, and does its seed() call writeSeedOutput("${name}", ...)?`
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

/**
 * Collects every e2e/seeds/*.seed.ts file and runs each one's seed(ctx), in
 * alphabetical order by filename, after the base fixture. Called once from
 * global-setup.ts. An empty or missing seeds/ directory is a no-op.
 */
export async function runSeeds(ctx: SeedCtx): Promise<void> {
  if (!fs.existsSync(SEEDS_DIR)) return;

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith('.seed.ts'))
    .sort();

  for (const file of files) {
    const name = file.slice(0, -'.seed.ts'.length);
    console.log(`[e2e setup] running seed "${name}" (e2e/seeds/${file})...`);
    const mod = (await import(pathToFileURL(path.join(SEEDS_DIR, file)).href)) as Partial<SeedModule>;
    if (typeof mod.seed !== 'function') {
      throw new Error(`e2e/seeds/${file} must export an async function "seed(ctx)" — see lib/seed-registry.ts.`);
    }
    await mod.seed(ctx);
  }
}
