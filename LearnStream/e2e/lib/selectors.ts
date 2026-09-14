// Barrel re-export of ./selectors/{auth,course,learn}.ts, kept so existing
// `from '../lib/selectors.js'` imports across spec files don't need to
// change. Split by what each selector actually selects: login/signup ->
// auth.ts, course-list/catalog/course-detail-page -> course.ts,
// learn/player-page -> learn.ts.
//
// Lanes should add NEW selector helpers only in their own
// e2e/lib/api/<lane>.ts, not by editing these three files further — see
// docs/contracts/registries.md and docs/lanes/<lane>.json for what each
// lane owns. These three files are the Wave 0 baseline, not a registry lanes
// keep appending to.
export * from './selectors/auth.js';
export * from './selectors/course.js';
export * from './selectors/learn.js';
