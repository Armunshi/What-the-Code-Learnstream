import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = path.join(__dirname, "features");
const TEST_ROUTES_DIR = path.join(__dirname, "test");

/**
 * Loads every `*.routes.js` file directly under `dir`, each expected to
 * export `{ basePath, priority, router }` (as its default export, or as
 * named exports — either is accepted so a file can do
 * `export default { basePath, priority, router }` or
 * `export const basePath = ...; export const router = ...`).
 */
async function loadRouteModules(dir) {
    if (!fs.existsSync(dir)) return [];

    const files = fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".routes.js"))
        .sort();

    const entries = [];
    for (const file of files) {
        const mod = await import(pathToFileURL(path.join(dir, file)).href);
        const { basePath, priority, router } = mod.default ?? mod;
        if (!basePath || !router) {
            throw new Error(`${path.relative(process.cwd(), dir)}/${file} must export { basePath, priority, router }`);
        }
        entries.push({ file, basePath, priority: priority ?? 100, router });
    }

    // Ascending priority — a lower number mounts first. This is what lets a
    // static sibling (e.g. /courses/categories) declare a lower priority
    // than a dynamic catch-all under the same prefix and reliably win.
    entries.sort((a, b) => a.priority - b.priority);
    return entries;
}

/**
 * Auto-mounts every routes/features/*.routes.js file (docs/contracts/
 * registries.md "Backend registries") onto `app`. This is the collector —
 * lanes add a NEW file to routes/features/ to add an endpoint; nobody edits
 * this file to "hook up" a route (registries.md's central rule: editing a
 * collector file is a frozen-file change).
 */
export async function mountFeatureRoutes(app) {
    const entries = await loadRouteModules(FEATURES_DIR);
    for (const { basePath, router, file, priority } of entries) {
        app.use(basePath, router);
        console.log(`[routes] mounted features/${file} at ${basePath} (priority ${priority})`);
    }
    return entries;
}

/**
 * Mounts routes/test/*.routes.js — e2e-only scaffolding (mail outbox, fake
 * media, learn-captions helpers). Callers must gate this themselves on
 * `E2E_TEST_ROUTES=1 && !isProduction` (docs/contracts/api-conventions.md);
 * this function does not re-check that condition so a production code path
 * is never accidentally hidden behind — or exposed through — this flag.
 */
export async function mountTestRoutes(app) {
    const entries = await loadRouteModules(TEST_ROUTES_DIR);
    for (const { basePath, router, file, priority } of entries) {
        app.use(basePath, router);
        console.log(`[routes] mounted test/${file} at ${basePath} (priority ${priority})`);
    }
    return entries;
}
