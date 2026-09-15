import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR = path.join(__dirname, "rules");

/**
 * Explicit directory scan of `readiness/rules/*.rule.js` (docs/contracts/
 * registries.md "Backend registries") — lanes add a new rule file here and
 * never edit this collector. Sorted for deterministic ordering (matters for
 * `steps{}`'s insertion order, and makes rule output reproducible in tests).
 */
async function loadRules() {
    const files = fs
        .readdirSync(RULES_DIR)
        .filter((file) => file.endsWith(".rule.js"))
        .sort();

    const rules = [];
    for (const file of files) {
        const mod = await import(pathToFileURL(path.join(RULES_DIR, file)).href);
        const run = mod.default;
        if (typeof run !== "function") {
            throw new Error(`${file} must default-export a rule function: (course) => { required, recommended }`);
        }
        // The rule id (filename minus ".rule.js") doubles as its key in the
        // `steps{}` output — by convention, a rule that gates one authoring
        // step (learners.rule.js, and later curriculum.rule.js, landing.rule.js,
        // …) uses that step's own id, so the frontend can key
        // `readiness.steps[stepId]` straight off the step registry without a
        // separate id-mapping table. base.rule.js is the exception: it's a
        // cross-cutting template/reference rule, not tied to any one step.
        rules.push({ id: file.replace(/\.rule\.js$/, ""), run });
    }
    return rules;
}

/**
 * Aggregates every registered rule into `{percent, required[], recommended[],
 * steps{}}` (plan W1-SHELL `GET …/readiness`). `percent` is required-items-met
 * over required-items-total — recommended items never affect it. A course
 * with no required items anywhere (impossible today, but the registry starts
 * from just base+learners) reports 100%, not NaN.
 *
 * Rule signature: `async (course) => ({ required: [{key, label, met}],
 * recommended: [{key, label, met}] })` — see rules/base.rule.js.
 */
export async function computeReadiness(course) {
    const rules = await loadRules();

    const steps = {};
    const required = [];
    const recommended = [];

    for (const { id, run } of rules) {
        const result = (await run(course)) || {};
        const stepRequired = result.required ?? [];
        const stepRecommended = result.recommended ?? [];

        required.push(...stepRequired);
        recommended.push(...stepRecommended);
        steps[id] = {
            required: stepRequired,
            recommended: stepRecommended,
            // A step with no required items of its own (or one whose rule
            // hasn't landed yet) is never a publish blocker, so it counts as
            // complete rather than permanently "incomplete".
            complete: stepRequired.every((item) => item.met),
        };
    }

    const metCount = required.filter((item) => item.met).length;
    const percent = required.length === 0 ? 100 : Math.round((metCount / required.length) * 100);

    return { percent, required, recommended, steps };
}
