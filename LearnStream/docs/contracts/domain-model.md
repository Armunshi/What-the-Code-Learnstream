# Domain model contracts (D1–D3)

Source of truth: `UI_REQS_14_09_26_IMPLEMENTATION_PLAN.md` §3 D1–D3. This document
exists so every Wave 0+ worktree can read the shared model without checking out
the whole plan. If this document and the plan ever disagree, the plan wins —
file an amendment.

Frozen after Wave 0. A change to any field, index, or discriminator listed here
is a contract change: it stops the lane, goes in the PR description, and lands
as a `w<N>.0-amendment` commit on the integration branch.

## D1 — Curriculum model

### `Sections`

- Bound to the **existing** `modules` collection: `mongoose.model('Sections', schema, 'modules')`.
- Fields: `{ course, title ≤80, learningObjective ≤200, description, order: int }`.
- Index: `{ course: 1, order: 1 }`.
- `module.model.js` becomes a re-export shim until W4.
- The API and UI say **"section"** everywhere (C-UI-4) — never "module".

### `CurriculumItems`

One new collection, using Mongoose discriminators on `type`.

**Base fields:** `{ course, section, type, title ≤80, description, order: int, isFreePreview, durationSec, resources: [ResourceSchema], editVersion }`

**Discriminators:**

| `type` | Extra fields |
|---|---|
| `video` | `{ media: MediaSchema }` |
| `article` | `{ body: markdown ≤50k, readingTimeSec }` |
| `assignment` | `{ assignment: ref Assignments }` — existing collection and submissions stay as-is |
| `quiz` | `{ quiz: ref Quizzes, quizKind: 'quiz' \| 'practice_test' }` |
| `resource` | `{ file: ResourceSchema }` |
| `video-slides` | schema reserved, **Deferred** — do not implement |

**Indexes:** `{ section: 1, order: 1 }` and `{ course: 1, type: 1 }`.

### Ordering (C-NFR-4)

- Every section and item has an explicit, dense `order`.
- Reorder, and move-between-sections, is **one full-tree `PUT`**, guarded by
  `course.curriculumVersion` (compare-and-increment), applied with `bulkWrite`.
- Re-applying the same payload gives the same result (idempotent), matching the
  existing no-transaction design in `services/bulk-module.service.js`.

### `MediaSchema` (`models/schemas/media.schema.js`)

| Group | Fields |
|---|---|
| Source | `provider: 'cloudinary' \| 'fake'`, `publicId` |
| Status | `status: NONE \| UPLOADING \| PROCESSING \| READY \| FAILED`, `statusChangedAt`, `error { code, message }` |
| File metadata | `durationSec`, `bytes`, `width`, `height` |
| Delivery | `mp4Url`, `hlsUrl`, `posterUrl` |
| Captions | `captions: [{ _id, lang, label, url, publicId, isDefault }]`, `transcriptText` |

`media.status` is persisted on the item, so it survives a page refresh.

### Migration: `scripts/migrate-w0-curriculum-v2.js`

- Idempotent, supports `--dry-run`, writes a marker document so re-runs are safe.
- Order comes from array position in `course.modules[]` and `module.lectures[]`.
- Each lecture becomes a `video` item; each assignment becomes an `assignment`
  item, appended after the lectures in the same section.
- **Original `_id`s are preserved** — `Progress.completedLectures.lectureId` and
  the e2e fixture ids stay valid across the migration.

### Legacy endpoints (adapters, until W4)

`/modules`, `/lectures`, `/modules/bulk` and `/assignments` are reimplemented as
adapters over the new model, returning the **same response shapes** as today.
This is what keeps the old authoring pages and `e2e/global-setup.ts` working
until the lanes that replace them (CURR in Wave 2) land. W4 deletes the adapters.

## D2 — Course lifecycle (C-FR-17)

- `status` enum: `DRAFT | READY_FOR_REVIEW | UNDER_REVIEW | PUBLISHED | ARCHIVED`.
- `config/courseLifecycle.js` allows only the transition `DRAFT ↔ PUBLISHED` for
  now. `READY_FOR_REVIEW`, `UNDER_REVIEW` and `ARCHIVED` are reserved for the
  deferred review/moderation feature (C-FR-19) — do not wire transitions into
  them yet.
- **Migration:** existing courses become `PUBLISHED` with `publishedAt = createdAt`.
  New courses start as `DRAFT`.
- `visibleCourseFilter(viewer)`:
  - Public catalog, search, and the course page show `PUBLISHED` courses only.
  - The owner sees their own drafts.
  - Enrolled students keep access to a course even after the owner unpublishes it.

## D3 — Course metadata (one schema change, all in Wave 0)

**Fields:**

| Group | Fields |
|---|---|
| Landing page | `title ≤60`, `subtitle ≤120`, `description`, `thumbnail`, `thumbnailPublicId`, `thumbnailAlt`, `promoVideo: MediaSchema` |
| Classification | `category`, `subcategory`, `topics [≤10 slugs]`, `level: beginner\|intermediate\|advanced\|all`, `language` (BCP-47), `isCertificationPrep` |
| Learner info | `learningObjectives [≤10 × 160]`, `requirements [≤10]`, `noPrerequisites`, `targetAudience [≤10]` |
| Pricing | `price` (paise; `0` = free), `currency: 'INR'`, `pricingConfirmedAt` |
| Lifecycle and search | `status`, `publishedAt`, `editVersion`, `curriculumVersion`, `searchText` (normalized, denormalized) |
| `stats` | `{ totalDurationSec, lectureCount, articleCount, quizCount, resourceCount, captionLanguages[], practiceTypes[], ratingAvg, ratingCount, ratingDistribution{1..5}, enrollmentCount }` |

**Rules:**

- Each stats writer `$set`s only its own dotted paths under `stats.*` — never
  the whole `stats` object, so concurrent writers (enrollment, reviews, media
  processing) never clobber each other.
- **`editVersion` is bumped only by authoring writes.** Stats and enrollment
  writes must never bump it, or they'd cause spurious 409 autosave conflicts
  (C-NFR-5) for an instructor mid-edit. Do **not** reuse Mongoose's `__v` for
  this — it increments on every save.
- Course title uniqueness is **per author**, not global.
- **Indexes:** `{ status, publishedAt }`, `{ status, category, subcategory }`,
  `{ status, 'stats.ratingAvg' }`, `{ author, status }`.

## Related migrations (W0-B)

All four run once, in Wave 0, and are the only migrations allowed outside an
amendment:

- `migrate-w0-curriculum-v2.js` — D1, above.
- `migrate-w0-course-status-metadata.js` — D2 status backfill + D3 taxonomy slugs.
- `migrate-w0-users-split-names.js` — see `user.model.js` additions below.
- `backfill-w0-course-stats.js` — populates `stats` from existing data.

## `user.model.js` additions (all landed in Wave 0, so no later lane edits it)

`firstName`, `lastName`, `username` (sparse unique, **never** a 24-hex string —
that would collide with an ObjectId in `/user/:id` routing), `emailVerifiedAt`,
`avatar`, `avatarPublicId`, `headline`, `bio`, `links`, `language`, `phone`,
`phoneVerifiedAt`, `interests[]`, `onboarding{}`, `privacy{showCourses}`,
`wishlist[]`. The existing `name` field stays, derived in a pre-save hook from
`firstName`/`lastName`.

Roles remain `student | teacher` only — multi-role accounts and an admin role
are **Deferred**.
