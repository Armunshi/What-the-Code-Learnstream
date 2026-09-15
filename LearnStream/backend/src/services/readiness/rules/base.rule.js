// Reference implementation of the readiness rule signature (docs/contracts/
// registries.md: "see services/readiness/rules/base.rule.js for the
// signature"). Every future rule file (curriculum.rule.js, landing.rule.js,
// pricing.rule.js, accessibility.rule.js, …) is a default-exported function
// shaped exactly like this one.
//
// Its own check is deliberately trivial — course.title is required at the
// Mongoose schema level, so this is always met for any document that exists
// at all. It exists so the registry has at least one universally-available
// rule (readiness/index.js would otherwise divide by zero on an empty
// required[] before any other lane lands its own rule) and so a new lane can
// copy this file's shape rather than guess it.
//
// `course` is the full Mongoose course document (readiness/index.js passes
// it straight through — a rule never fetches its own copy).
export default async function baseRule(course) {
    return {
        required: [
            {
                key: "title",
                label: "Add a course title",
                met: Boolean(course.title && course.title.trim().length > 0),
            },
        ],
        recommended: [],
    };
}
