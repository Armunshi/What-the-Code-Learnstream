// Frontend mirror of backend/src/config/search.js's filter-group constants
// (plan §6.3's table) plus their display labels. Necessarily a separate,
// hand-kept-in-sync copy rather than a shared import — the frontend can't
// import backend/src code across the Vite/Node boundary — so any change to
// the backend's option keys (RATING_OPTIONS, DURATION_BUCKET_KEYS, ...) must
// be mirrored here too.

export const RATING_OPTIONS = [
  { value: '4.5', label: '4.5 & up' },
  { value: '4.0', label: '4.0 & up' },
  { value: '3.5', label: '3.5 & up' },
  { value: '3.0', label: '3.0 & up' },
];

export const DURATION_OPTIONS = [
  { value: '0-1', label: '0-1 Hour' },
  { value: '1-3', label: '1-3 Hours' },
  { value: '3-6', label: '3-6 Hours' },
  { value: '6-17', label: '6-17 Hours' },
  { value: '17+', label: '17+ Hours' },
];

// "beginner, intermediate, all (advanced)" (plan §6.3) — see
// backend/src/config/search.js's levelFilterToModelLevels for why "all"
// covers both the model's 'all' and 'advanced' course.level values.
export const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'all', label: 'All Levels' },
];

export const PRICE_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];

// coding_exercises/role_plays are reserved — the frontend hides them unless
// the backend facet reports a non-zero count for one (plan §6.3), which is
// why every practice option is listed here rather than just the two live
// ones: AllFiltersPanel/QuickFilterBar filter this list by facet count, not
// by a hardcoded "live" subset.
export const PRACTICE_OPTIONS = [
  { value: 'quizzes', label: 'Quizzes', reserved: false },
  { value: 'practice_tests', label: 'Practice Tests', reserved: false },
  { value: 'coding_exercises', label: 'Coding Exercises', reserved: true },
  { value: 'role_plays', label: 'Role Plays', reserved: true },
];

export const SORT_OPTIONS = [
  { value: 'relevant', label: 'Most Relevant' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'most_reviewed', label: 'Most Reviewed' },
  { value: 'newest', label: 'Newest' },
];

export const SORT_VALUES = SORT_OPTIONS.map((o) => o.value);
export const RATING_VALUES = RATING_OPTIONS.map((o) => o.value);
export const DURATION_VALUES = DURATION_OPTIONS.map((o) => o.value);
export const LEVEL_VALUES = LEVEL_OPTIONS.map((o) => o.value);
export const PRICE_VALUES = PRICE_OPTIONS.map((o) => o.value);
export const PRACTICE_VALUES = PRACTICE_OPTIONS.map((o) => o.value);

const labelLookup = (options) => Object.fromEntries(options.map((o) => [o.value, o.label]));

export const RATING_LABELS = labelLookup(RATING_OPTIONS);
export const DURATION_LABELS = labelLookup(DURATION_OPTIONS);
export const LEVEL_LABELS = labelLookup(LEVEL_OPTIONS);
export const PRICE_LABELS = labelLookup(PRICE_OPTIONS);
export const PRACTICE_LABELS = labelLookup(PRACTICE_OPTIONS);

// Small mirror of backend/src/config/languages.js — only the label lookup a
// lang/subs checkbox needs. A code missing here (an obscure BCP-47 tag no
// seeded course uses) still renders, just as its raw uppercased code.
const LANGUAGE_LABELS_BY_CODE = {
  en: 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  'pt-BR': 'Portuguese (Brazil)',
  zh: 'Chinese',
  'zh-CN': 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
  it: 'Italian',
  nl: 'Dutch',
  tr: 'Turkish',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
};

export const languageLabel = (code) => LANGUAGE_LABELS_BY_CODE[code] ?? String(code).toUpperCase();

/** "web-development" -> "Web development" — topics only carry a slug on the
 * wire (GET /courses/categories' subcategory.topics), no separate label. */
export const topicLabel = (slug) => {
  const words = String(slug).replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
