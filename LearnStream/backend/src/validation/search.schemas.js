import { z } from "zod";
import {
  DURATION_BUCKET_KEYS,
  LEVEL_FILTER_OPTIONS,
  PRACTICE_TYPES,
  PRICE_OPTIONS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  SUGGEST_MAX_CHARS,
  SUGGEST_MIN_CHARS,
} from "../config/search.js";
import { LANGUAGE_CODES } from "../config/languages.js";
import { TOPIC_SLUGS } from "../config/taxonomy.js";

// Every checkbox filter group (lang/practice/topic/subs/price) arrives as
// either `?g=a&g=b` (Express/qs parses this as an array already) or a single
// `?g=a`; the comma-split handles a client that instead sends `?g=a,b`, so
// either wire shape works.
const arrayParam = (allowedValues) =>
  z.preprocess((val) => {
    if (val === undefined) return undefined;
    const arr = Array.isArray(val) ? val : [val];
    return [...new Set(arr.flatMap((v) => String(v).split(",")).map((v) => v.trim()).filter(Boolean))];
  }, z.array(z.enum(allowedValues)).optional());

// "?cert=true" / "?cert=1" -> true; anything else (including "?cert=false")
// -> false. z.coerce.boolean() would turn the string "false" into `true`
// (any non-empty string is JS-truthy), which is exactly wrong for a
// query-string boolean switch.
const boolParam = z.preprocess((val) => val === "true" || val === "1", z.boolean()).optional();

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  cert: boolParam,
  rating: z.enum(RATING_OPTIONS).optional(),
  lang: arrayParam(LANGUAGE_CODES),
  practice: arrayParam(PRACTICE_TYPES),
  duration: z.enum(DURATION_BUCKET_KEYS).optional(),
  topic: arrayParam(TOPIC_SLUGS),
  level: arrayParam(LEVEL_FILTER_OPTIONS),
  subs: arrayParam(LANGUAGE_CODES),
  price: arrayParam(PRICE_OPTIONS),
  sort: z.enum(SORT_OPTIONS).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(SUGGEST_MIN_CHARS).max(SUGGEST_MAX_CHARS),
});

export const relatedQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
});

export const freshQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
});

export const searchEventSchema = z.object({
  q: z.string().trim().min(1).max(200),
  resultCount: z.coerce.number().int().min(0),
  sessionId: z.string().trim().min(1).max(100),
});
