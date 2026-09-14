// D2 — course lifecycle (docs/contracts/domain-model.md).
//
// The full `status` enum already has five values because the deferred
// review/moderation feature (C-FR-19) needs them later, but only DRAFT and
// PUBLISHED are wired up in Wave 0. READY_FOR_REVIEW/UNDER_REVIEW/ARCHIVED
// exist on the enum so course.model.js never needs a schema migration to add
// them, but no transition below leads to or from them — that is a deliberate
// gap, not an oversight, until the review feature lands.
export const COURSE_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  UNDER_REVIEW: "UNDER_REVIEW",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
});

export const COURSE_STATUS_VALUES = Object.values(COURSE_STATUS);

// Adjacency list of allowed transitions. Only DRAFT <-> PUBLISHED for now.
const ALLOWED_TRANSITIONS = Object.freeze({
  [COURSE_STATUS.DRAFT]: [COURSE_STATUS.PUBLISHED],
  [COURSE_STATUS.PUBLISHED]: [COURSE_STATUS.DRAFT],
  [COURSE_STATUS.READY_FOR_REVIEW]: [],
  [COURSE_STATUS.UNDER_REVIEW]: [],
  [COURSE_STATUS.ARCHIVED]: [],
});

/** Whether `from -> to` is a currently-allowed lifecycle transition. */
export const canTransition = (from, to) => Boolean(ALLOWED_TRANSITIONS[from]?.includes(to));

/** The statuses `from` may currently move to. */
export const allowedTransitionsFrom = (from) => ALLOWED_TRANSITIONS[from] ?? [];
