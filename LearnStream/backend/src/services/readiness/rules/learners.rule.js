// Gates the "learners" step (C-FR-2/C-FR-9 "Intended learners and learning
// outcomes"). Its id ("learners", from the filename) matches the step
// registry entry frontend/src/features/instructor-course/steps/learners/
// declares, and each key below matches one of that step's `readinessKeys` —
// that's how the review step's "fix" links and the sidebar's per-step
// completion icon find their way back to this step without a separate
// id-mapping table (readiness/index.js's steps{} keying convention).
export default async function learnersRule(course) {
    return {
        required: [
            {
                key: "learningObjectives",
                label: "Add at least one learning objective",
                met: Array.isArray(course.learningObjectives) && course.learningObjectives.length > 0,
            },
        ],
        recommended: [
            {
                key: "requirements",
                label: 'Add course requirements, or mark "No prerequisites"',
                met:
                    course.noPrerequisites === true ||
                    (Array.isArray(course.requirements) && course.requirements.length > 0),
            },
            {
                key: "targetAudience",
                label: "Add who this course is for",
                met: Array.isArray(course.targetAudience) && course.targetAudience.length > 0,
            },
        ],
    };
}
