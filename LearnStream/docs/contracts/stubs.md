# Frozen stubs and component contracts

Source of truth: `UI_REQS_14_09_26_IMPLEMENTATION_PLAN.md` D11, §5, §1.1
(`VideoPlayer`), §2.3 (`useCart`). W0-A creates every stub below with a
placeholder body and the exact signature listed here. The named owning lane
replaces only the **body** in Wave 1/2 — the signature is frozen after Wave 0,
same as the models and DTOs. A lane that needs to change a stub's signature
stops and files an amendment.

## Stub ownership table (D11)

| Stub | Owning lane | Replaces body in |
|---|---|---|
| `PurchaseCta({course, variant})` | COM | Wave 1 |
| `CartButton`, `useCart` | COM | Wave 1 |
| `CourseRatingHeaderMetric({courseId, stats})` | REV | Wave 1 |
| `CourseReviewsSection({courseId})` | REV | Wave 1 |
| `HomeSocialProof` | REV | Wave 1 |
| `GlobalSearch({variant})` | SRC | Wave 1 |
| `WishlistButton` | ACC | Wave 1 |
| `PublicProfilePage` | ACC | Wave 1 |
| `PreviewBanner` | PREV | Wave 2 |
| `CourseCard`, `CourseGrid` | CAT | Wave 1 |

Every other lane **consumes** these by their frozen signature and must not
reach into their implementation. E.g. NAV renders `<GlobalSearch variant="inline"/>`
and `<CartButton/>` inside `SiteHeader` without knowing how SRC/COM implement them.

## `useCart()` (COM)

```
useCart() → { mode: 'guest'|'server'|'disabled', items, count, isLoading, has(id), add(courseCardDto), remove(id), canPurchase }
```

- `mode` is `'guest'` (localStorage cart), `'server'` (student, TanStack Query
  + optimistic mutations), or `'disabled'` (teacher — no cart at all).
- `add()` takes a full `CourseCardDTO`, so the guest cart can render itself
  with no extra fetch.

## `PurchaseCta({course, variant})` (COM)

State machine keyed on viewer role and course state:

| Viewer / course | Button |
|---|---|
| Owner | Edit course |
| Enrolled | Go to course |
| Free course | Enroll now — guest gets a login prompt with `next=/course/:id?enroll=1`, auto-enrolled after login |
| Paid course | Add to cart / Buy now |
| Teacher (not the owner) | Disabled |

`variant` at minimum supports `"default"` (course page) and `"popover"`
(inside `CoursePopover`, below).

## `CourseRatingHeaderMetric({courseId, stats})` / `CourseReviewsSection({courseId})` / `HomeSocialProof` (REV)

- `CourseRatingHeaderMetric` renders the compact header form, e.g.
  `4.7 ★ (3,779 ratings) 56,145 students` (FR-REV-1.1).
- `CourseReviewsSection` renders the full section: header, `RatingDistribution`,
  `ReviewGrid`, `HelpfulVote`, "Show more reviews", and `ReviewForm`.
- `HomeSocialProof` wraps `TestimonialCarousel`, `StatsStrip`, `TrustBar` for
  the homepage.

## `GlobalSearch({variant})` (SRC)

- `variant="inline"` — the `SiteHeader` placement (`md`+ width). `variant="dialog"`
  — the icon-triggered dialog below `md`.
- Behavior (frozen regardless of which lane eventually touches the body):
  empty focus shows a Trending list; at 1+ characters, 200 ms debounce, shows
  grouped Search suggestions / Courses (≤3) / Instructors, aborting the
  in-flight request on each keystroke. Enter navigates to `/courses/search?q=`.
  The `/` key focuses it from anywhere `SiteHeader` is mounted.

## `WishlistButton` / `PublicProfilePage` (ACC)

- `WishlistButton` is used both standalone (course page) and inside
  `CoursePopover` — same component, no popover-specific variant needed since
  it's icon-only.
- `PublicProfilePage` renders at `/user/:username`.

## `PreviewBanner` (PREV, replaces body in Wave 2)

Renders "Preview — not published · Back to editing" when a course is viewed
via `?preview=guest` or `/learn/:id?preview=1`. Mounted inside `RootLayout`
(or the relevant page shell) by whichever lane's page detects the preview
query param — the banner itself has no props beyond what it reads from the URL.

## `CourseCard({course, priority=false, showPopover=true})` / `CourseGrid` (CAT)

**`CourseCard`:**
- `<article data-testid="course-card">` with one `Link` to `/course/:id`,
  containing `CourseThumb` (`aspect-video`, `object-cover`, fixed
  width/height, lazy unless `priority`, `srcSet` per H-NFR-2.2), title
  (`line-clamp-2`), author, `RatingStars`, `Price`, and `Badge`.
- A separate sr-only "Quick view" button, visible on `focus-visible`, which
  opens `CoursePopover`.
- All data for the card **and its popover** comes from one `CourseCardDTO` —
  no second fetch on hover (see `dto.md`).

**`CoursePopover`** (built alongside `CourseCard`, reused unchanged on the
search results grid per FR-SRC-2.3):
- A **controlled shadcn `Popover`**, not `HoverCard` — it contains
  Add to Cart, so it must be keyboard-reachable.
- Opens via `useHoverIntent` (mouse only, 150 ms delay, ≤75 ms animation, so
  visible within 200 ms total per H-FR-2.1); closes 150 ms after the pointer
  leaves both card and popover. `CoursePopoverGroup` keeps only one open at a
  time; re-hovering another card within 300 ms skips the open delay.
- Placement: `side="right" align="start" collisionPadding={16}`, in a portal.
- Touch devices get no popover — a tap just navigates.
- Keyboard: the sr-only Quick view button opens it; Esc closes it and returns
  focus; `role="dialog"`, `aria-labelledby` = the course title.
- Content (`data-testid="course-popover"`), in order: badge; rating line
  (`4.6 ★ (1,234 ratings)`, "No ratings yet" at zero); a stats line
  (`Updated Sep 2026 · 12.5 total hours · 42 lectures · Beginner`); a "What
  you'll learn" checklist; `<PurchaseCta variant="popover"/>` and
  `<WishlistButton/>`.

## `SiteHeader` (`components/layout/SiteHeader/index.jsx`) — created as a stub by W0-A, body replaced by NAV

`SiteHeader` itself takes **no props** — every part reads its own hooks.
Composition (frozen):

```
<header role="banner" class="sticky top-0 z-40 h-16 border-b bg-background">
  <SkipToContent/>
  <MobileNavSheet/>                                        below lg — Sheet side="left"
  <Logo/>
  <ExploreMenu/>                                            lg+ — NavigationMenu
  <GlobalSearch variant="inline" class="flex-1 min-w-0"/>   md+; below md: icon -> Dialog(variant="dialog")
  <TeachLink/>                                              lg+ — guest/student -> /teach; teacher -> "Instructor dashboard"
  <CartButton/>                                             hidden when useCart().mode === 'disabled'
  {status === 'unknown' ? <Skeleton class="w-[160px]"/> : status === 'guest' ? <AuthCtas/> : <UserMenu/>}
</header>
```

- `CartButton`: `aria-label="Cart, N items"`, `data-testid="cart-count"`, hover
  preview on fine-pointer devices.
- `UserMenu`: avatar trigger (`meSummary.avatar` or initials); label shows
  name, email, "N courses enrolled"; groups come from the **user menu
  registry** (`registries.md`) — Learning (My learning, Wishlist, My cart),
  Communication (Notifications, Messages → coming soon), Account (Account
  settings, Payment methods, Subscriptions, Purchase history), Roles (Teach on
  LearnStream / Instructor dashboard), Session (Log out). Teachers never see
  Cart or Wishlist entries.
- Responsive breakpoints: below `md` shows only logo, search icon, cart,
  hamburger; `md`–`lg` shrinks search and moves Explore/Teach into the sheet;
  `lg`+ shows everything. All targets ≥40px, visible focus rings, nothing
  hidden without an alternative path.

## `VideoPlayer` (`components/media/VideoPlayer.jsx`) — created by W0-A, consumed by every lane that plays media

```
<VideoPlayer
  src={{ hlsUrl, mp4Url }}
  poster
  tracks={[]}
  playbackRate
  startAt
  onTimeUpdate
  onEnded
  onPlay
  onPause
  onRateChange
  videoRef
/>
```

Native `<video>` plus a lazily-imported `hls.js`, used unmodified by the
course-page trailer dialog (CAT), the learn player (LEARN), and course preview
(PREV). Any lane needing new player behavior adds it as a prop, via amendment
— it does not fork the component.
