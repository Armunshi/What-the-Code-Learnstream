// Accumulates each test's network/console log into a partial file, then
// global-teardown folds every partial into one structured JSON run log.
// File-based (not an in-memory singleton) because individual tests run in
// a worker process distinct from the main process that runs global-teardown.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRONTEND_URL, BACKEND_URL } from '../playwright.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(E2E_ROOT, 'logs');
const RUN_META_PATH = path.join(E2E_ROOT, '.auth', 'run-meta.json');

export interface NetworkEntry {
  id: number;
  timestamp: string;
  method: string;
  url: string;
  requestBodySize: number | null;
  status: number | null;
  responseBodySize: number | null;
  bodySizeUnavailable: boolean;
  durationMs: number | null;
}

export interface ConsoleEntry {
  timestamp: string;
  type: string;
  text: string;
  location?: { url: string; lineNumber: number; columnNumber: number };
}

export interface PageErrorEntry {
  timestamp: string;
  type: 'pageerror';
  message: string;
  stack?: string;
}

export interface DuplicateFindings {
  duplicatePosts: Array<{ url: string; occurrences: number }>;
  rapidDuplicateGets: Array<{ url: string; deltaMs: number }>;
  backToBackOptions: Array<{ url: string; occurrences: number }>;
}

export interface TestLogEntry {
  title: string;
  status: string;
  network: NetworkEntry[];
  console: (ConsoleEntry | PageErrorEntry)[];
  duplicateFindings: DuplicateFindings;
}

interface RunMeta {
  runId: string;
  startedAt: string;
}

function partialDir(runId: string): string {
  return path.join(LOGS_DIR, `.partial-${runId}`);
}

/** Called once from global-setup.ts. */
export function initRun(): RunMeta {
  fs.mkdirSync(path.dirname(RUN_META_PATH), { recursive: true });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const meta: RunMeta = { runId, startedAt: new Date().toISOString() };
  fs.mkdirSync(partialDir(runId), { recursive: true });
  fs.writeFileSync(RUN_META_PATH, JSON.stringify(meta), 'utf-8');
  return meta;
}

function getRunMeta(): RunMeta {
  return JSON.parse(fs.readFileSync(RUN_META_PATH, 'utf-8'));
}

let writeCounter = 0;

/**
 * Called from the networkLogger fixture's teardown, once per test.
 * Filenames include a per-process monotonic counter, not just
 * Date.now()+random — tests finishing within the same millisecond (common
 * for fast assertions) previously collided often enough to silently drop
 * entries from the final run log.
 */
export function writeTestLog(entry: TestLogEntry): void {
  const { runId } = getRunMeta();
  const safeTitle = entry.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  writeCounter += 1;
  const filePath = path.join(partialDir(runId), `${String(writeCounter).padStart(5, '0')}-${safeTitle}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
}

/** Called once from global-teardown.ts. Returns the written file's path. */
export function finalizeRun(): string {
  const { runId, startedAt } = getRunMeta();
  const dir = partialDir(runId);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const tests: TestLogEntry[] = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
  );

  const totalRequests = tests.reduce((sum, t) => sum + t.network.length, 0);
  const totalErrors = tests.reduce(
    (sum, t) =>
      sum + t.console.filter((c) => c.type === 'error' || c.type === 'pageerror').length,
    0
  );
  const duplicatePostViolations = tests.reduce(
    (sum, t) => sum + t.duplicateFindings.duplicatePosts.length,
    0
  );

  const finishedAt = new Date().toISOString();
  const run = {
    runId,
    startedAt,
    finishedAt,
    environment: { frontendUrl: FRONTEND_URL, backendUrl: BACKEND_URL },
    tests,
    summary: { totalRequests, totalErrors, duplicatePostViolations },
  };

  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const outPath = path.join(LOGS_DIR, `run-${finishedAt.replace(/[:.]/g, '-')}-${runId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(run, null, 2), 'utf-8');

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(RUN_META_PATH, { force: true });

  return outPath;
}
