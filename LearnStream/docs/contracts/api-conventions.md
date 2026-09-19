# API conventions

Source of truth: `UI_REQS_14_09_26_IMPLEMENTATION_PLAN.md` (D2, D6–D10, §1.2,
§6, and the per-lane endpoint tables in §4). This document collects the
cross-cutting rules every lane's backend work must follow, so lanes don't
reinvent error shapes or route-mounting order independently.

## Naming and payload shape

- All request/response fields are **camelCase**.
- IDs are Mongo `ObjectId`s, serialized as hex strings.
- Prices are always **paise** (integer), never rupees or floats. `price: 0` means free.
- Durations are always **seconds** (`durationSec`, `totalDurationSec`, …), never
  minutes — the legacy `Video.duration`-shown-as-"mins" bug (plan §0.6) is what
  this rule exists to prevent.

## Error shapes

- **Validation errors:** `{ message, errors: [{ field, code }] }`.
- **Version conflicts (409):** `{ code: 'VERSION_CONFLICT', current }`, where
  `current` is the fresh document the client should reconcile against. The
  curriculum reorder endpoint uses the specific code `CURRICULUM_CONFLICT` with
  the same shape (a fresh tree instead of a bare document).
- **Duplicate email on signup (409):** `{ errors: [{ field: 'email', code: 'EMAIL_EXISTS' }] }`.
- **Free-course commerce guard (400):** `{ code: 'FREE_COURSE_ENROLL_DIRECTLY' }`
  — `createOrder` returns this instead of letting Razorpay reject a price-0 order.
- **Paid-course enroll guard (402):** plain `402 PAYMENT_REQUIRED`.
- Every lane reuses these shapes for its own new endpoints rather than inventing
  a parallel error format.

## Route mounting

- Feature routers live at `routes/features/*.routes.js` and export
  `{ basePath, priority, router }`. `loadFeatureRoutes.js` (owned by W0-B)
  auto-mounts every file in that glob, sorted by `priority` ascending.
- **Static paths must mount before dynamic catch-alls.** Concretely:
  `/courses/search`, `/courses/catalog`, `/courses/cards`, `/courses/categories`
  all mount before the legacy `/courses/:courseId` catch-all. `search.routes.js`
  explicitly declares `priority: 10` for this reason — any new router that adds
  a static sibling under an existing dynamic prefix must pick a priority lower
  than that prefix's router.
- Routes under `routes/test/*.routes.js` mount **only** when
  `E2E_TEST_ROUTES=1 && !isProduction`. Never gate a production code path behind
  this flag — it exists purely for e2e fixtures (mail outbox, fake media,
  learn-captions helpers).

## Auth middleware

- `optionalAuth` (added to `middleware/auth.js` in W0-B): no token → treated as
  a guest; an **invalid** token still 401s, so the refresh-token flow keeps
  working. Endpoints that must work for guests but personalize for logged-in
  users (curriculum, reviews, search) use this, not a bespoke guard.
- `privateClient` (frontend) always sends the Bearer token and can trigger a
  refresh. `publicClient` never sends credentials and never triggers a refresh
  or a 401 — guest-facing pages must call through `publicClient` (H-FR-3.2).
- JSON response bodies **never** include `refreshToken` (S-NFR-1.2) — it lives
  only in the httpOnly cookie.

## Body size limits

- The global JSON parser stays capped at **16 kb** (existing `app.js:44`
  behaviour) for all routes except:
  - `/instructor/**`, mounted with `express.json({ limit: '1mb' })` **before**
    the global parser, to allow curriculum/authoring payloads.
  - `/payment/webhook` and `/webhooks/cloudinary`, which use **raw-body**
    verification (signature checks need the unparsed body), not JSON parsing.

## Caching

- `cacheControl` middleware (W0-B) is the only way routes set `Cache-Control`.
  Public, cacheable GETs (catalog, categories, search) use `publicCache(60, 600)`
  style short TTLs; anything gated by `optionalAuth` that varies by identity
  (reviews) also sets `Vary: Authorization`.
- Search endpoint cache TTLs are fixed by contract (see `dto.md` for the table)
  — a lane changing a TTL is a contract change.

## Pagination

- List endpoints use `page` + `limit` query params, not cursors, matching the
  existing catalog/search pagination style. `limit` is always capped
  server-side (e.g. `limit≤48` on `/courses/catalog`, `limit=12` default on
  reviews) — never trust a client-supplied unbounded limit.
- Paginated responses include a `total` count so the frontend can render
  `ResultCount` / page controls without a second request.

## Concurrency / optimistic locking

- Authoring writes (course metadata, curriculum) are guarded by
  `editVersion` / `curriculumVersion` compare-and-increment, **never** `__v`.
  A stale version returns `409 VERSION_CONFLICT` (or `CURRICULUM_CONFLICT`)
  with the current server state, per the error-shape rule above.
- `findOneAndUpdate` with the version in the filter is the standard pattern
  (see W1-SHELL's `PATCH …/learners`) — don't read-then-write.

## Routes (D8)

**Frontend:**

| Route | Page |
|---|---|
| `/course/:courseId` | Course page |
| `/courses/search` (trailing slash accepted; `/search` redirects) | Search |
| `/learn/:courseId`, `/learn/:courseId/items/:itemId` | Player |
| `/my-learning` | Student dashboard |
| `/instructor/courses`, `/instructor/courses/new`, `/instructor/courses/:courseId/{plan,content,publish,review}/…` | Authoring |
| `/user/:username` | Public profile |
| `/account/*` | Account suite |

Note the deliberate split from the source spec (plan §0.2): `/user/:username`
is the public profile, never `/user/:id` — a route on a 24-hex username would
collide with an ObjectId-based lookup, hence `username` is validated to never
be a 24-hex string (see `domain-model.md`).

**Backend:** static paths (`/courses/search`, `/courses/catalog`,
`/courses/cards`, `/courses/categories`) mount before the legacy
`/courses/:courseId` catch-all, per the route-mounting rule above.

## Free enrollment (D10)

- `POST /courses/:courseId/enroll`: student only, course must be `PUBLISHED`
  and `price === 0`, idempotent (re-enrolling is a no-op success). Paid courses
  get `402 PAYMENT_REQUIRED`. Response: `{ redirectTo: '/learn/:courseId' }`.
- `createOrder` rejects free, unpublished, or already-enrolled courses with
  `400 FREE_COURSE_ENROLL_DIRECTLY`.
- `addToCart` rejects free courses outright — free courses never enter a cart.

## Rate limiting

Endpoints that send email, check email availability, or accept OTP attempts
must be rate-limited (`express-rate-limit`), keyed on **email + IP** where
both are available (registration resend), or IP alone (email-availability
check). See the AUTH lane for the concrete limits (30 s resend cooldown, 5
sends max, 5 failed OTP attempts before the pending record is deleted).
