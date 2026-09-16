// Rule-based Hot and Fresh (§6.4, FR-SRC-4.2): matching courses published
// within the last 60 days, newest first, falling back to the top search
// result's subcategory when the freshness window alone doesn't fill the
// carousel.
import { Courses } from "../../models/course.model.js";
import { COURSE_STATUS } from "../../config/courseLifecycle.js";
import { toCourseCardDTOs } from "../../utils/dto/courseCard.js";
import { FRESH_LIMIT, FRESH_WINDOW_DAYS } from "../../config/search.js";
import { rankedCandidates } from "./rank.js";

export async function getFreshCourses(q) {
  const since = new Date(Date.now() - FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { scored } = await rankedCandidates(q, {});

  const fresh = scored
    .filter((c) => c.publishedAt && new Date(c.publishedAt) >= since)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, FRESH_LIMIT);

  const seenIds = new Set(fresh.map((c) => String(c._id)));

  if (fresh.length < FRESH_LIMIT && q) {
    const topSubcategory = scored[0]?.subcategory;
    if (topSubcategory) {
      const fillCourses = await Courses.find({
        status: COURSE_STATUS.PUBLISHED,
        subcategory: topSubcategory,
        _id: { $nin: [...seenIds] },
      })
        .sort({ publishedAt: -1 })
        .limit(FRESH_LIMIT - fresh.length)
        .populate("author", "name username");

      const items = toCourseCardDTOs(fillCourses);
      return [...hydrateCards(fresh), ...items].slice(0, FRESH_LIMIT);
    }
  }

  return hydrateCards(fresh);
}

/** `fresh` candidates come from rankedCandidates' lean $facet projection
 * (already has an `author` populated by name via engine.mongo.js's
 * $lookup), not a live Mongoose document — courseCard.js's DTO mapper only
 * needs {_id, ...fields, author:{_id,name,username}}, so this reshapes
 * rather than re-querying. */
function hydrateCards(candidates) {
  return toCourseCardDTOs(
    candidates.map((c) => ({
      ...c,
      author: { _id: c.authorId, name: c.authorName, username: c.authorUsername },
    }))
  );
}
