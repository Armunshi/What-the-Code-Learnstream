// Public API surface of the instructor-course (authoring) feature
// (docs/lanes/shell.json owns features/instructor-course/**, with several
// steps/content-types subdirectories owned by CURR/LAND/QUIZ/RES/BULK — see
// docs/lanes/*.json).
//
// Other features should only ever import from here, never reach into
// components/hooks/steps directly (plan §1.1's "a feature imports only from
// ... other features' index.js" rule) — today that's nothing, since no other
// feature needs to render authoring UI itself.
export { getStepById, getStepForReadinessKey } from './steps/registry';
