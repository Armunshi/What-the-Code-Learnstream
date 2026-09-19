# Frozen DTOs and response shapes

Source of truth: `UI_REQS_14_09_26_IMPLEMENTATION_PLAN.md` §3 D3, §4 (W0-B,
W1-CAT, W1-REV, W1-SRC, W1-ACC), §6.2. These shapes are frozen after Wave 0
(`utils/dto/*` is in the Wave 0 frozen-files list) — a lane that needs a new
field stops and files an amendment; it does not add the field unilaterally.

## `CourseCardDTO` (`utils/dto/courseCard.js`) — frozen

Used everywhere a course is shown as a card: catalog, search results, "you
might like", the popover. About 300 bytes per card — small enough to fetch in
bulk for a popover with no extra round trip (H-FR-2.1).

```
{
  id, title, subtitle, thumbnailUrl, thumbnailSrcSet,
  author: { id, name, username },
  priceInPaise, isFree, currency, category, subcategory, level, language,
  rating: { avg, count },
  enrollmentCount,
  badge: 'bestseller' | 'highest_rated' | 'new' | null,
  totalDurationSec, lectureCount, hasCaptions,
  updatedAt, publishedAt,
  objectives: [≤3]
}
```

**Never** includes `description` or `enrolledStudents` — both were dropped
from the legacy `getCourseById` payload (plan §4 W0-B) as unnecessary and, in
`enrolledStudents`' case, a privacy leak (full roster to any viewer).

**Badge rules** (at most one, in priority order — thresholds configurable):
1. **Bestseller** — top 3 by `stats.enrollmentCount` within its category, and
   at least 5 enrollments.
2. **Highest Rated** — `ratingAvg ≥ 4.5` and `ratingCount ≥ 5`.
3. **New** — published within the last 30 days.

## `CoursePublicDTO` (`utils/dto/coursePublic.js`) — `GET /courses/:courseId/landing`

```
{
  ...course landing fields (title, subtitle, description, thumbnail, promoVideo),
  stats,
  instructor: { name, username, avatar, headline, bio, courseCount, totalStudents, avgRating },
  learningObjectives, requirements, targetAudience,
  promoVideo: playable for anyone when the course is PUBLISHED
}
```

## Curriculum tree (`utils/dto/curriculum.js`) — `GET /courses/:courseId/curriculum`

- `optionalAuth`; the shape is the same for guest and enrolled viewers, but a
  guest/non-entitled viewer's items carry **no `media` URLs** — only enough to
  render titles, durations, and which items are free-preview.
- This is the exact regression covered by "guest gets curriculum 200 with no
  publicId/URLs" (rewrite of regression 1.1, W0-B tests).

## Playback (`GET /courses/:courseId/items/:itemId/playback`)

Returns playable media (`hlsUrl`/`mp4Url`/captions) only for:
- An entitled viewer (owner or enrolled student), or
- Any viewer, when the item `isFreePreview` **and** the course is `PUBLISHED`.

Otherwise `403`. The course owner previewing their own course never triggers
progress writes (see `learn` contracts below).

## `GET /users/me/summary`

```
{ enrolledCount, enrolledCourseIds, cartCount, avatar }
```
Backs the `UserMenu` label ("N courses enrolled") and cart badge without a
separate query per widget.

## Reviews (W1-REV)

**`GET /courses/:courseId/reviews?page&limit=12&sort=recent|helpful`** (`optionalAuth`), item shape:

```
{ id, user: { id, name, avatar }, rating, comment, createdAt,
  helpfulCount, unhelpfulCount, userVoteStatus, isMine }
```

`Vary: Authorization`; cached privately when the request is authenticated
(`userVoteStatus`/`isMine` are viewer-specific).

**`GET /courses/:courseId/rating-summary`:**

```
{ averageRating, totalRatingsCount, totalStudentsEnrolled, ratingDistribution }
```

`ratingDistribution` buckets by `floor(rating)`; percentages use the
largest-remainder method so they always sum to exactly 100.

**Vote endpoint:** `PUT /reviews/:reviewId/vote { status }`, where `status` is
one of `HELPFUL | UNHELPFUL | NONE`. The endpoint **sets** the state — the
client computes the toggle transition, the server just persists whatever state
is sent (FR-REV-3.2). After every vote write, counts are recomputed with
`countDocuments`, never incremented in place, so they can't drift.

## Search (W1-SRC) — §6.2

| Endpoint | Response | Cache |
|---|---|---|
| `GET /courses/search/trending` | `{ queries[≤8] }` | 300 s |
| `GET /courses/search/suggest?q=` (1–60 chars) | `{ keyphrases[≤5], courses[≤3]{id, title, thumbnailUrl, authorName}, instructors[≤3]{id, username, name, avatar, headline} }` | 30 s |
| `GET /courses/search?q&cert&rating&lang&practice&duration&topic&level&subs&price&sort&page` | `{ items: CourseCardDTO[], total, page, facets, spotlight, relaxed }` | 60 s |
| `GET /courses/search/related?q=` | `{ queries[≤8] }` | 300 s |
| `GET /courses/search/fresh?q=` | `{ items[≤12] }` | 300 s |
| `POST /courses/search/events {q, resultCount, sessionId}` | 204, rate-limited | no-store |

`relaxed: true` on the main search response means the query fell back from
"every token must match" to "any token matches" because the strict match
produced zero results.

Facet counts in the search response are **disjunctive**: each facet group is
counted with every *other* active filter applied, but not its own — so the
frontend never needs to compute or fake option counts client-side.

## `useCart()` facade (frontend, not a wire DTO, but a frozen shape — see `stubs.md`)

```
useCart() → { mode: 'guest'|'server'|'disabled', items, count, isLoading, has(id), add(courseCardDto), remove(id), canPurchase }
```

`add()` takes a full `CourseCardDTO`, not just an id — the guest cart stores
enough to render itself without a fetch.
