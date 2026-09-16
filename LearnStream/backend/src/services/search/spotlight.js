// Rule-based "AI Overview" card (§6.4, FR-SRC-2.2). The swap point for an
// LLM version later — everything here is templated from ranking signals
// already computed by relevance.js, never generated text, so the "AI
// Overview" label (kept per product decision, risk #17) never implies
// analysis that didn't happen.
import { TAXONOMY, findCategory } from "../../config/taxonomy.js";
import { SPOTLIGHT_MIN_MARGIN, SPOTLIGHT_MIN_SCORE } from "../../config/search.js";
import { normalizeQuery, tokenize } from "./text.js";

const LEVEL_WORDS = Object.freeze({
  beginner: ["beginner", "beginners", "basics", "intro", "introduction", "fundamentals"],
  intermediate: ["intermediate"],
  advanced: ["advanced", "expert", "mastery"],
});

function matchedLevelWord(tokens) {
  for (const [level, words] of Object.entries(LEVEL_WORDS)) {
    if (tokens.some((t) => words.includes(t))) return level;
  }
  return null;
}

function matchedTaxonomyLabel(query) {
  const normalized = normalizeQuery(query);
  for (const category of TAXONOMY) {
    if (normalized === category.label.toLowerCase() || normalized === category.slug) return category.label;
    for (const sub of category.subcategories) {
      if (normalized === sub.label.toLowerCase() || normalized === sub.slug) return sub.label;
      if (sub.topics.some((topic) => topic.replace(/-/g, " ") === normalized || topic === normalized)) {
        return sub.label;
      }
    }
  }
  return null;
}

function buildIntent(query, topCandidate) {
  const tokens = tokenize(query);
  const taxonomyLabel = matchedTaxonomyLabel(query);
  if (taxonomyLabel) {
    return `This topic is best learned start to finish — here is our top pick for ${taxonomyLabel}`;
  }

  const level = matchedLevelWord(tokens);
  if (level) {
    const phrase = level === "beginner" ? "just getting started" : level === "advanced" ? "going deeper" : "building on the basics";
    return `Perfect for ${phrase} — here is our top pick for "${query.trim()}"`;
  }

  const categoryLabel = findCategory(topCandidate.category)?.label ?? topCandidate.categoryLabel;
  return categoryLabel
    ? `Here is our top pick for "${query.trim()}" in ${categoryLabel}`
    : `Here is our top pick for "${query.trim()}"`;
}

/**
 * `scored` is the already-scored, already-sorted (best first) candidate
 * list from index.js. Returns `null` when there's no query, no candidates,
 * the top result doesn't clear the absolute floor, or it doesn't lead the
 * runner-up by the required margin (§6.4).
 */
export function computeSpotlight(scored, query) {
  if (!normalizeQuery(query) || scored.length === 0) return null;

  const [top, second] = scored;
  if (top._score < SPOTLIGHT_MIN_SCORE) return null;
  if (second && top._score - second._score < SPOTLIGHT_MIN_MARGIN) return null;

  return {
    title: "AI Overview",
    intent: buildIntent(query, top),
    course: top._card,
  };
}
