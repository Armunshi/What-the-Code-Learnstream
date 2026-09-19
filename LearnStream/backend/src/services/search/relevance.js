import { SCORE } from "../../config/search.js";
import { normalizeQuery, tokenize, wordPrefixRegExp } from "./text.js";

/**
 * D6's relevance score, computed in JS over the (already text-matched)
 * candidate set — never in the aggregation, so the weights above are the
 * only place ranking logic lives.
 *
 * `candidate` needs: title, subtitle, description, topics[], categoryLabel,
 * authorName — all plain strings/arrays (a $facet "items" projection, not a
 * live Mongoose document).
 */
export function scoreCandidate(candidate, query) {
  const normalizedQuery = normalizeQuery(query);
  const tokens = tokenize(query);
  if (!normalizedQuery || tokens.length === 0) return 0;

  const title = (candidate.title ?? "").toLowerCase();
  const subtitle = (candidate.subtitle ?? "").toLowerCase();
  const description = (candidate.description ?? "").toLowerCase();
  const topics = (candidate.topics ?? []).map((t) => String(t).toLowerCase());
  const categoryLabel = (candidate.categoryLabel ?? "").toLowerCase();
  const authorName = (candidate.authorName ?? "").toLowerCase();

  let score = 0;

  // Title: exact phrase, else prefix, else per-token word-prefix — mutually
  // exclusive tiers (each is a strictly narrower case than the one before,
  // so only the highest tier that applies scores), but ARE additive with
  // every other field's bonus below. A query that merely appears *inside*
  // the title (not as its start) falls through to the per-token tier below,
  // which still rewards it — just not as strongly as starting with it.
  if (title === normalizedQuery) {
    score += SCORE.TITLE_EXACT_PHRASE;
  } else if (title.startsWith(normalizedQuery)) {
    score += SCORE.TITLE_PREFIX;
  } else {
    for (const token of tokens) {
      if (wordPrefixRegExp(token).test(title)) score += SCORE.TITLE_WORD_PREFIX_PER_TOKEN;
    }
  }

  // Subtitle / topics / category / author / description: a flat per-field
  // bonus if ANY token matches that field at all (D6 lists these as flat
  // amounts, not "per token" like the title's word-prefix case).
  if (tokens.some((t) => wordPrefixRegExp(t).test(subtitle))) score += SCORE.SUBTITLE_MATCH;
  if (topics.some((topic) => tokens.some((t) => wordPrefixRegExp(t).test(topic)))) score += SCORE.TOPICS_MATCH;
  if (tokens.some((t) => wordPrefixRegExp(t).test(categoryLabel))) score += SCORE.CATEGORY_LABEL_MATCH;
  if (tokens.some((t) => wordPrefixRegExp(t).test(authorName))) score += SCORE.AUTHOR_MATCH;
  if (tokens.some((t) => wordPrefixRegExp(t).test(description))) score += SCORE.DESCRIPTION_MATCH;

  return score;
}

/** D6's tie-break: score desc, then ratingCount desc, then enrollmentCount desc. */
export function compareByRelevance(a, b) {
  if (b._score !== a._score) return b._score - a._score;
  const ratingDiff = (b.stats?.ratingCount ?? 0) - (a.stats?.ratingCount ?? 0);
  if (ratingDiff !== 0) return ratingDiff;
  return (b.stats?.enrollmentCount ?? 0) - (a.stats?.enrollmentCount ?? 0);
}
