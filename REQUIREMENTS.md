# LearnStream — Frontend Redesign & Auth-Fix Requirements

Date: 2026-09-10
Companion docs: `UI_AUDIT.md` (findings this document turns into requirements) · `BACKEND_AUDIT.md` (backend audit + its own B0-B6 restructuring plan)

**Scope note**: this document and its Module 4/6 plans cover the **frontend/fullstack** track only. Backend work is tracked separately in `BACKEND_AUDIT.md`, whose Modules B0-B2 outrank everything still unchecked here — including a verified unauthenticated bypass of paid course content, and a missing error-handling middleware (B2) that currently makes every server error arrive at the client as HTML, so `err.response.data.message` is always `undefined`. Frontend error-message work should wait for B2 rather than working around it.

---

## 1. Goals

1. Fix the authentication bug so a logged-in user reliably sees their own courses instead of "unauthorized".
2. Give every page a single, consistent visual language (spacing, color, typography, components) instead of three competing UI kits.
3. Make the landing page actually sell the product: working hero, course count, working "Get Started" → signup path.
4. Make the navbar and cart properly aligned using an explicit grid/flex system.
5. Add the missing pages: Sign Up (reachable), Profile, About, Services, Pricing, Contact.
6. Document the CSS/layout approach so future pages are built the same way instead of ad hoc.

---

## 2. Component library decision: Tailwind + shadcn/ui, not three kits

### The question you asked
Keep the current custom-Tailwind-everywhere approach, or standardize on one library (e.g. shadcn) on top of Tailwind?

### Recommendation: standardize on **Tailwind CSS + shadcn/ui**, drop `flowbite-react` and the unused `mdb-react-ui-kit` / `@mui/icons-material`.

Reasoning:

- **The inconsistency you're seeing is a direct symptom of using multiple kits.** `flowbite-react` ships its own spacing/radius/color defaults; `mdb-react-ui-kit` ships Bootstrap-era defaults; raw Tailwind divs follow whatever the author typed that day. None of these agree, which is why the navbar and cart look mismatched even though both are "using Tailwind."
- **shadcn/ui is not a component library you install as a dependency** — its CLI generates the component source *into your own repo* (`src/components/ui/*`), styled with Tailwind and built on unstyled Radix primitives. You own and can freely restyle every component; there's no fighting a library's own opinionated defaults the way you currently fight Flowbite's. This matches "custom components for each part" while still giving you dropdown/dialog/avatar/toast/menu primitives you don't have to build (and get correct) from scratch — accessibility (focus trap, keyboard nav, ARIA) is handled for you.
- Keep `lucide-react` as the single icon set (shadcn is built around it already) and remove `@mui/icons-material` and `mdb-react-ui-kit`, which the codebase doesn't actually use anywhere (`UI_AUDIT.md` §1).
- Page-specific content (course cards, hero section, cart line items, the login/signup forms) should stay **custom Tailwind components** built by you, on top of a shared design-token scale (see §3) — shadcn is for the small set of interactive primitives (menus, dialogs, dropdowns, avatar, toast/alert, form inputs), not for full-page layout.

### Migration plan (incremental, not a rewrite)
1. `npx shadcn@latest init` in `frontend/` — this reads `tailwind.config.js` and sets up the token/theme wiring.
2. Add components as needed: `npx shadcn@latest add dropdown-menu avatar button input dialog badge` — start with exactly what the navbar and cart need.
3. Replace `Navbar1.jsx`'s Flowbite `Navbar`/`Dropdown`/`Avatar` with the shadcn equivalents one component at a time (navbar is small — can be done in one PR).
4. Replace `login.jsx`'s Flowbite `TextInput`/`Spinner` with shadcn `Input`/a small spinner component.
5. Once nothing imports `flowbite-react`, remove it (and `mdb-react-ui-kit`, `@mui/icons-material`) from `package.json`.

---

## 3. Design tokens (so "consistent" is actually enforced, not just asked for)

Add to `tailwind.config.js` under `theme.extend`, and use these everywhere instead of arbitrary values:

```js
theme: {
  extend: {
    colors: {
      brand: {
        DEFAULT: '#7ED757',   // the green already used in the logo (Navbar1.jsx:52)
        dark: '#588157',      // already used in Home.jsx hero button
      },
    },
    maxWidth: {
      container: '1280px',    // == max-w-screen-xl, used as ONE standard everywhere
    },
    spacing: {
      // Tailwind's default 4px scale is already sufficient — the fix is discipline,
      // not new tokens: always use the scale (gap-4, gap-6, gap-8...), never px-[13px].
    },
  },
},
```

Rule going forward: **every page wraps its content in the same `max-w-container mx-auto px-4 md:px-8` shell** — this alone fixes the "cart stretches edge to edge while everything else is capped" issue in `UI_AUDIT.md` §3.3.

---

## 4. Layout system: Tailwind's grid/flex as the Bootstrap `row`/`col-md-4` equivalent

Bootstrap's `row` + `col-md-4` is a 12-column grid with responsive column spans. Tailwind has two ways to do the same thing; use **CSS Grid** for anything that's a genuine multi-column layout (course grid, footer columns, login page's two panels), and **Flexbox** for one-dimensional alignment (navbar contents, a row of buttons, a cart line item).

### 4.1 Grid (the direct `row`/`col-md-4` equivalent)
Bootstrap:
```html
<div class="row">
  <div class="col-12 col-md-4">...</div>
  <div class="col-12 col-md-4">...</div>
  <div class="col-12 col-md-4">...</div>
</div>
```
Tailwind equivalent:
```jsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <div>...</div>
  <div>...</div>
  <div>...</div>
</div>
```
For uneven spans (Bootstrap's `col-md-8` + `col-md-4`):
```jsx
<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
  <div className="md:col-span-8">...</div>
  <div className="md:col-span-4">...</div>
</div>
```
Use this pattern for: the course card grid (currently whatever `CourseComp.jsx` does — standardize it to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`), the footer's link columns (`Footer.jsx:18` already correctly uses `grid grid-cols-2 sm:grid-cols-3` — keep this pattern, it's the right one), and the login page's two side-by-side panels (`login.jsx:64` already correctly uses `grid grid-cols-1 md:grid-cols-2` — also correct, keep as the reference example).

### 4.2 Flex (for alignment within a row, not multi-column layout)
```jsx
<div className="flex items-center justify-between gap-4">
```
`items-center` = vertical centering, `justify-between`/`justify-center`/`gap-*` = horizontal distribution. This is what's **missing** in the navbar (`UI_AUDIT.md` §3.1) and should be added explicitly rather than left to each component's own margin.

### 4.3 Navbar fix, concretely
```jsx
<nav className="max-w-container mx-auto px-4 md:px-8 flex items-center justify-between py-3">
  <Link to="/" className="font-league font-bold text-xl">
    <span className="text-brand">Learn</span>Stream
  </Link>

  <div className="hidden md:flex items-center gap-6">
    <Link to="/">Home</Link>
    <Link to="/about">About</Link>
    <Link to="/services">Services</Link>
    <Link to="/pricing">Pricing</Link>
    <Link to="/contact">Contact</Link>
  </div>

  <div className="flex items-center gap-4">
    {auth?.accessToken ? (
      <>
        <Link to="/cart" className="relative p-2">
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </Link>
        {/* avatar dropdown */}
      </>
    ) : (
      <>
        <Link to="/login" className="text-sm font-medium">Log in</Link>
        <Link to="/signup/student" className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">
          Sign up
        </Link>
      </>
    )}
  </div>
</nav>
```
Note the use of `Link` from `react-router-dom` throughout instead of raw `href` — this fixes `UI_AUDIT.md` §2.5 (full page reloads) at the same time as fixing alignment.

### 4.4 Cart line-item fix, concretely
Replace the loose `flex gap-4 items-center` row with an explicit grid so the thumbnail/text/price columns never wrap unevenly:
```jsx
<div className="grid grid-cols-[96px_1fr_auto] gap-4 items-center border-b pb-4">
  <img className="w-24 h-24 object-cover rounded-lg" ... />
  <div>{/* title + category */}</div>
  <div className="text-right">{/* price + remove */}</div>
</div>
```

---

## 5. Landing page requirements

- **Hero section**
  - Confirm `HeroImg.png` (or its replacement) is actually present under `frontend/public/assets/` so `bg-[url('/assets/HeroImg.png')]` resolves in the production build.
  - Replace fixed `height: "90vh"` with `min-h-[600px] h-[90vh]` so short viewports don't crop content.
  - Fix the typo'd `sm:text-17xl` → intended scale, e.g. `text-4xl sm:text-6xl`.
  - "Get Started" → `/login` (already correct) must stay reachable independent of the navbar fix in §4.3.
  - "Learn More" must go to a real anchor/section (e.g. the courses list below, `#courses`) instead of `href="#"`.
- **Course count stat**: add a stat row/badge near the hero or directly above the course grid, e.g. "500+ courses across 8 categories". Data source: reuse `GET /courses/getallCourses` (already exists, `backend/src/routes/CourseRoutes/courses.routes.js:31`) and take `.length` of the result — no new backend work required for a first pass. If the course catalog grows large enough that fetching the full list just to count it becomes wasteful, add a lightweight `GET /courses/count` endpoint that returns `{ count }` via `Model.countDocuments()` instead.
- Apply the grid pattern from §4.1 to the course card list for consistent responsive columns.
- **Category bar and course grid restyle (confirmed still needed by manual testing, `UI_AUDIT.md` §10.3)**: `CategoryBar.jsx` has no active-state indicator for the selected category — add one (e.g. a filled background/underline on the currently-selected pill). `CourseComp.jsx` needs its hardcoded 5-star rating block removed (§6.1) alongside the grid restyle, since both live in the same component.

---

## 6. Auth / JWT fixes

1. **Fix `StudentPage.jsx:49-53`** — move `Authorization` inside the `headers` object (the concrete bug behind "shows unauthorised after signing in", detailed in `UI_AUDIT.md` §2.1). This is a one-line fix and should ship first, independent of everything else in this doc.
2. Remove the stray `import { asyncHandler } from "../../../backend/src/utils/asyncHandler"` from `StudentPage.jsx` (unused, and reaches into the backend source tree from frontend code).
3. **Enable the axios response interceptor** (`frontend/src/api/axios.js` — currently commented out): on a `401`, call `fetchNewAccessToken()` once, retry the original request with the new token, and only log the user out if the refresh itself fails. This removes the need for every single page to hand-roll its own 401 handling and fixes silent session drops from access-token expiry.
4. Audit cross-site cookie reliance: since `sameSite: "none"` cookies are unreliable in some production browser configurations, keep the **in-memory access token + Authorization header** as the primary auth path for API calls (already the intended design), and treat the refresh cookie as best-effort — the interceptor from item 3 is what actually keeps sessions alive, not the cookie.
5. Standardize: every authenticated request must attach `Authorization: Bearer ${token}` **inside** `headers`. Consider a small shared axios instance/hook (e.g. `useAuthedAxios()`) that injects this automatically, so this class of bug (a header silently placed in the wrong spot) can't recur on any future page.

---

## 7. Learning experience & teacher-review fixes

Findings behind this section are documented in `UI_AUDIT.md` §6. Two of these are more than cosmetic and should be treated as bugs, not polish:

### 7.1 Security fix (ship this with the auth fix in §6, not later)
`getAssignmentById` (`backend/src/controllers/Courses/Assignment.controller.js:158-172`) currently returns the full assignment document — including **every student's** `uploadedAssignments` — to any logged-in student who requests it, because `.select('-module_id -assignmentUrls')` doesn't exclude that field. Fix:
```js
const assignment = await Assignments.findById(assignmentId).select('-module_id -assignmentUrls');
const own = assignment.uploadedAssignments.filter(u => u.studentId.toString() === req.student._id.toString());
// return `own` in place of the full uploadedAssignments array
```
A separate teacher-only endpoint (`getStudentsAndUploadedAssignments`, already `verifyJWT`-gated) is the correct place to see all students' submissions — students should never receive that array.

### 7.2 Real lecture-completion tracking (replace "click = complete")
Today `handleSelectLecture` marks a lecture complete on click, before playback starts (`frontend/src/Pages/LectureAssig.jsx:56-67`), and `ReactPlayer` has no progress handler at all. To implement an actual 90%-watched threshold:
1. Add `onProgress={(state) => ...}` to the `<ReactPlayer>` in `LectureAssig.jsx` (fires ~every 1s with `{ played, playedSeconds, loaded, loadedSeconds }`).
2. Track the maximum `played` fraction reached per lecture in component state (so seeking backward doesn't lower it).
3. When `played >= 0.9` for the first time, fire the existing `POST /courses/:courseId/lectures/:lectureId/complete` call (reuse as-is — no backend change needed for this part).
4. Remove the premature "mark complete on click" call from `handleSelectLecture`.
5. Fold assignment completion into `progressPercentage` server-side (`backend/src/controllers/Courses/Course.controller.js:292`) — e.g. weight lectures and assignments by count so a course isn't "100%" from videos alone: `((completedLectureCount + completedAssignmentCount) / (totalLectures + totalAssignments)) * 100`.
6. Tie `markAssignmentCompleted` to an actual submission existing (`Assignment.controller.js:242-277` should check `progress`/`Assignments.uploadedAssignments` for a `studentId` match before allowing "complete") instead of trusting an unconditional client click.

### 7.3 Teacher grading/feedback (currently doesn't exist)
Add a `status` (`pending`/`reviewed`), `grade`, and `feedback` field to the `uploadedAssignments` subdocument in the `Assignments` model, a `PATCH /courses/:courseId/assignments/:assignmentId/submissions/:studentId` endpoint (teacher-only, `verifyJWT`), and a small form in `UploadedAssignment.jsx` so a teacher can actually respond to a submission instead of only viewing/downloading it.

### 7.4 Smaller fixes to batch in
- Replace `CourseComp.jsx`'s hardcoded 5-star rating block (lines 27-70) with either a real rating (once reviews exist) or remove the stars entirely until they're backed by real data — showing a fake perfect score is misleading.
- Fix the dead "Add lecture-assignment" button in `ViewtheModules.jsx` — `let owner_id` (line 26) is never assigned; replace the check at line 174 with the existing `ownerId` state variable, which is correctly set.
- Add the missing `Authorization: Bearer` header to `components/LectureAssignment.jsx`'s two upload POSTs (lines 49-53, 63-67) — currently relies only on the cross-site cookie, same class of bug as §6.
- Add `Authorization` headers to `ViewStudentModule.jsx`'s `courseProgressDetails` call (currently cookie-only) for the same reason.
- Give `YourWork.jsx`'s upload a real progress indicator and fix its post-upload refetch to call the existing `getAssignmentById` endpoint (§7.1's corrected, student-scoped version) instead of the non-existent `/submissions` route.

---

## 8. Payment, signup, and IDOR fixes (P0/P1)

Findings behind this section are in `UI_AUDIT.md` §7-§8. These are the highest-priority items in the whole document — a broken signup path, tamperable payments, a systemic authorization hole, and a plaintext-password log all outrank any visual/layout work.

### 8.1 Payment amount validation (P0)
In `backend/src/controllers/Payment.controller.js`'s `createOrder`, replace the client-supplied `amount` with a server-computed one:
```js
const courses = await Courses.find({ _id: { $in: course_ids } }).select('price');
const amount = courses.reduce((sum, c) => sum + c.price, 0) * 100; // paise
```
Drop `amount` from the accepted request body entirely once this is in place.

### 8.2 Teacher signup fix (P0)
In `UserTeacher.controller.js`'s `registerUser`, call the already-defined `generateAccessAndRefreshTokens(userTeacher._id)` (mirrors `UserStudent.controller.js`'s working equivalent) before setting cookies, and replace the undefined `LoggedInUserTeacher` reference with the already-fetched `createdTeacher`. This is a same-file, few-line fix — no schema or route changes needed.

### 8.3 Ownership checks on module/lecture/assignment mutation (P0)
Add a shared check (small helper or inline) to every mutating handler in `Modules.controller.js`, `Lecture.controller.js`, and `Assignment.controller.js`:
```js
const course = await Courses.findById(course_id);
if (!course) throw new ApiError(404, "Course not found");
if (course.author.toString() !== req.teacher._id.toString()) {
  throw new ApiError(403, "Not authorized to modify this course");
}
```
Apply to: `addModule`, `updateModule`, `deleteModule`, `addLectureToModule`, `addAssignmentToModule` (`Modules.controller.js`), `updateLecture`, `deleteLecture` (`Lecture.controller.js`), `deleteAssignment` (`Assignment.controller.js`, `createAssignment` already receives `course_id`/`moduleId` from a route gated only by `verifyJWT` — same check applies there too).

### 8.4 Stop logging plaintext passwords (P0)
Delete `console.log(req.body)` at `UserStudent.controller.js:50` and `:139` outright — do not replace with a redacted version, just remove.

### 8.5 Payment/checkout reliability (P1)
- Move enrollment into `verifyPayment` itself (`Payment.controller.js:82-97`) so a successful signature check enrolls the student in the same request, instead of depending on a second frontend call (`displayRazorpay.js:20-39`) that can silently fail.
- Add a "clear purchased items from cart" step (bulk removal or a dedicated endpoint) triggered by that same successful verification.
- Add a loading/disabled state to the checkout button (`Cart.jsx`) and `BuyCourseButton` (`Payment.jsx`) for the duration of the Razorpay flow.
- Move the Razorpay key out of `displayRazorpay.js:90` into `VITE_RAZORPAY_KEY_ID`; replace the hardcoded prefill email/phone (lines 100-103) with the logged-in user's real info from `AuthContext`.
- Delete `components/Checkout.jsx` (dead, throws `ReferenceError` if rendered).

### 8.6 Signup/auth backend hardening (P1)
- Add server-side password strength validation to both `registerUserStudent` and `registerUser` (reuse the intent of the existing client-side `PWD_REGEX` from `components/Signup.jsx:9`, enforced server-side too).
- Fix `components/Signup.jsx:88-97`'s dead success-message branch (navigation currently happens before the success state can render) and add a submit-button loading/disabled state to prevent duplicate signups.
- Fix the broken `/terms` link (`Signup.jsx:210`) once §9's static pages exist, or point it at a real anchor in the interim.

### 8.7 Content and polish cleanup (P2)
- Replace the live Udemy testimonials (`testimonials.jsx:6-35`) and Udemy links (`udemycomponent.jsx:19,29,39`) with real LearnStream content — do not ship competitor branding/links in production.
- Fix `udemycomponent.jsx`'s feature selector so choosing a feature actually swaps the displayed image (currently hardcoded to one static path).
- Fix `BackgroundWrapper.jsx:8`'s stray closing paren in the `url(...)` CSS value (relevant only if the Login-students/teacher pages are kept rather than deleted — see §10).
- Add backdrop-click-to-close and an `aria-label` to `PDFPreviewModal.jsx`'s close button (match the pattern already used in `Pages/Modal.jsx`); add a `sandbox` attribute to its `<iframe>`.
- Add an active-category indicator to `CategoryBar.jsx`.
- Fix `Courseupdatation.jsx`: use the already-fetched `ownerId` as an actual guard, add `Authorization` headers to its three POST calls, surface per-item failures instead of a blanket "success" message, and replace the `array.length + 1` id scheme (which collides after deletions) with a stable id generator.

---

## 9. New pages

| Route | Purpose | Notes |
|---|---|---|
| `/about` | Company/product story | Static content page |
| `/services` | What LearnStream offers (for students vs. teachers) | Static content page |
| `/pricing` | Pricing tiers if applicable, or "free for students" messaging | Static content page |
| `/contact` | Contact form or contact details | Can be a simple `mailto:` + form stub initially |
| `/student/:user_id/profile` | Student profile: name, email, enrolled courses summary, edit basic info | Requires a `GET /user/student/:id` read endpoint if one doesn't already return this |
| `/teacher/:user_id/profile` | Teacher profile: name, email, published courses summary, edit basic info | Same as above for teacher model |

All six must be registered in `frontend/src/main.jsx`'s router and linked from the navbar/footer — a link that doesn't correspond to a registered route (current state of About/Services/Pricing/Contact) must never ship.

---

## 10. Cleanup (do alongside, not after)

- Delete `frontend/src/App.jsx` (dead, broken imports — not the real entry point; `main.jsx` is).
- **`components/Signup.jsx` must NOT be deleted** — it's the live form behind `/signup/student` and `/signup/teacher` (corrected in `UI_AUDIT.md` §2.7 after manual testing caught this). `components/Checkout.jsx` is already deleted (dead, broken — see §8.5).
- Delete `Pages/LoginCommon.jsx`, `Pages/Login-students.jsx`, `Pages/Login-teacher.jsx`, and — once those three are gone — `components/login-form.jsx` (only ever imported by `Login-students.jsx`/`Login-teacher.jsx`), plus their route entries in `main.jsx:29-30`. Confirmed unreachable from any UI path; `Pages/login.jsx` is the live combined login page (§8.6 in `UI_AUDIT.md`).
- Remove `mdb-react-ui-kit` and `@mui/icons-material` from `frontend/package.json` once §2's migration is complete and nothing references them.

---

## 11. Suggested delivery order

1. **P0 — ship together first**: fix `StudentPage.jsx`'s auth-header bug (§6.1–6.2), the assignment-leak (§7.1 in `UI_AUDIT.md` §6.4), teacher signup's `ReferenceError` (§8.2), the module/lecture/assignment ownership checks (§8.3), the plaintext-password logging (§8.4), and server-side payment amount validation (§8.1). None of these are cosmetic — they're either broken-by-default or actively exploitable.
2. Navbar rebuild with Login/Sign Up links + grid/flex alignment (§4.3) — unblocks discoverability of signup.
3. Hero section fix (§5) + course count stat.
4. Payment/checkout reliability: atomic enrollment, cart clearing, double-submit protection, remove hardcoded Razorpay key (§8.5).
5. shadcn/ui migration for navbar + login/signup forms (§2).
6. Cart layout fix (§4.4).
7. New pages: About, Services, Pricing, Contact, Profile (§9).
8. Real lecture-completion tracking + assignment-completion gating (§7.2), teacher grading (§7.3).
9. Signup/auth hardening + content/polish cleanup (§8.6, §8.7).
10. Axios interceptor + remaining smaller fixes + dead-code/dependency cleanup (§6.3, §7.4, §10).

---

## 12. Module 4 plan: design system consolidation & layout standardization

This is Module 4 in the full module sequence (0 docs → 1 P0 security → 2 payment → 3 nav/auth/landing → **4 design system** → 5 learning experience → 6 teacher workflow → 7 new pages → 8 content cleanup → 9 dead code). Consolidates what was previously only referenced in passing (§2, §11 item 5, and `UI_AUDIT.md` §10.3/§10.4).

### 12.1 shadcn/ui migration — done except dependency removal

**Pin the CLI version.** `npx shadcn@latest init` no longer matches this plan: "latest" resolved to v4.21.0, which is Tailwind-v4-first (`@theme inline`/`@utility` CSS) and broke the build instantly on this Tailwind v3.4.17 project (`border-border` class does not exist) — reverted before anything else was touched. **`npx shadcn@2.10.0`** is the last major version with the classic Tailwind-v3 flow used below; use that pin for any future `add` commands, not `@latest`. That version's init also wrote `hsl(var(--x))` in `tailwind.config.js` against `oklch(...)` CSS variable values — `hsl(oklch(...))` is invalid CSS and silently killed every color utility with no build error. Fixed by using `var(--x)` directly in the config; re-check this if `shadcn add` ever rewrites that file.

1. [x] `npx shadcn@2.10.0 init` (New York style, neutral base) in `frontend/` — added `components.json`, `src/lib/utils.js`, updated `tailwind.config.js`/`src/index.css`. Also added `jsconfig.json` and a Vite `resolve.alias` for `@/*` (neither existed before and both are required for the CLI's import alias).
2. [x] Added primitives: `npx shadcn@2.10.0 add dropdown-menu avatar button input dialog badge` → `src/components/ui/*`. Dependencies added: `@radix-ui/react-{avatar,dialog,dropdown-menu,slot}`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`.
3. [x] `Navbar1.jsx`: Flowbite `Dropdown`/`Avatar` → shadcn `DropdownMenu`/`Avatar`; hardcoded hex colors → `brand`/`brand-dark` tokens (fixed a real bug in the process — the signup button's hover was a stray unrelated blue, not the brand green used everywhere else).
4. [x] `login.jsx`: Flowbite `TextInput`/`Spinner` → shadcn `Input`/`Button` + a `lucide-react` `Loader2` spinner (reuses the icon set already used elsewhere instead of a separate spinner component).
5. [x] Cart line items relaid out per §4.4 (below), plus wrapped in `max-w-container` per §3's shell rule.
6. [x] Category bar + course catalog grid restyle (`CategoryBar.jsx`, `CourseComp.jsx`) — pulled forward per `UI_AUDIT.md` §10.3; hardcoded 5-star rating block removed (§6.1); `CategoryBar` now receives and highlights `selectedCategory` (previously tracked by `GeneralCourses` but never passed down, so no active-category indicator was even possible — `UI_AUDIT.md` §8.10). Also fixed a `no-undef` bug found while touching `CourseComp.jsx`: `course?.author?.name || getAuthorName` referenced an undefined variable as a fallback.
7. [ ] Teacher creation-modal primitives (see §13.3) — swap `Pages/Modal.jsx` and `components/FileDropzone.jsx` (built Tailwind-only in Module 6) onto shadcn `Dialog`/`Progress` — not done yet, next up.
8. [ ] **Deferred to Module 9 on purpose**: don't remove `flowbite-react`/`mdb-react-ui-kit`/`@mui/icons-material` from `package.json` yet — `flowbite-react` is still imported elsewhere (`Cart.jsx`'s `Card`, `LectureAssig.jsx`, etc.) that this pass didn't touch.

**Verification:** `npx vite build` passes clean. **Not yet verified visually** — no connected browser this session, so navbar/cart/course-grid/login rendering has only been confirmed to compile, not seen.

Module 4 does not itself cover teacher-dashboard layout or the creation-modal upload UX — that work is scoped to Module 6 (§13), even though both converge on the same shadcn primitives (item 7 above).

---

## 13. Module 6 plan: teacher workflow fixes

Module 6 in the sequence above (P2, after Module 5's learning-experience work). Pre-existing scope plus what manual testing round 2 (teacher workflow) newly surfaced, both tracked together since they touch the same files.

### 13.1 Pre-existing scope (not yet started)
- Fix the dead "Add lecture-assignment" button in `ViewtheModules.jsx:174` — it checks the never-assigned local `owner_id` instead of the correctly-set `ownerId` state variable already used elsewhere in the same file.
- De-duplicate the "who owns this course" fetch, currently called independently in both `ViewtheModules` and every `ModuleDropdown` instance it renders — lift it to the parent and pass `ownerId` down as a prop.
- Add a minimal grading/feedback mechanism (§7.3): `status`/`grade`/`feedback` fields on the `uploadedAssignments` subdocument, a teacher-only `PATCH` endpoint, and a small form in `UploadedAssignment.jsx`.
- Move `ViewtheModules.jsx`'s `CustomLogo`/`AssignmentIcon` imports out of `public/` into `src/` (or replace with `lucide-react` icons already used elsewhere) so they resolve correctly in a production Vite build.
- Make `deletelecture`'s cleanup (`ViewtheModules.jsx:261`) consistent with `deleteAssignment` right next to it — update local state instead of a full `window.location.reload()`.

### 13.2 `Courseupdatation.jsx` fixes — partially done (manual testing round 2)
- [x] Surface per-item upload failures instead of always showing "success" — each lecture/assignment now tracks its own `idle/uploading/done/error` state via a new `FileDropzone` component; a failure aborts submit and shows a dismissible error banner instead of a false success message.
- [x] Fix the `array.length + 1` ID-collision bug — now `Math.max(existingIds) + 1`, unique across deletions.
- [ ] Use the already-fetched `ownerId` as an actual permission guard (still fetched but unused).
- [ ] Add `Authorization` headers to its three POST calls (still cookie-only).
- [ ] Navigate or refresh the module list after a successful submission (currently the teacher has to close the modal and reload manually).

### 13.3 Teacher dashboard layout & creation-modal UX — done (manual testing round 2, newly identified)
Full detail in `UI_AUDIT.md` §10.5. Not previously in this plan at all. Shipped using the existing Tailwind/flowbite-react stack — no new dependencies, so it didn't need to wait on Module 4's shadcn bootstrap:
- `TeachersPage.jsx`: primary "Create Course" CTA moved to a header-level position above the fold, plus a CTA in a new empty state for teachers with zero courses.
- `TeachersPage.jsx` + `components/GeneralCourses.jsx`: the cross-teacher "Top Courses" section — previously the same full category-bar+grid component used on `StudentPage.jsx` — is now a visually demoted, category-bar-free 3-course teaser with a link out to the full catalog. `GeneralCourses` gained opt-in `showCategoryBar`/`limit` props for this (backward-compatible; `Home.jsx`/`StudentPage.jsx` are unaffected).
- `Pages/Modal.jsx`: fixed a real close-button mispositioning bug (missing `position: relative` on the modal box, so the button was anchored to the viewport corner via the `fixed inset-0` backdrop instead of the modal card) and added proper title/header support.
- `components/GeneralCourses.jsx`: fixed a dead `errRef.current.focus()` call (`errRef` was never defined or passed by any of its three callers) that threw and swallowed the real fetch-error message.
- New `components/FileDropzone.jsx` (drag-and-drop, filename/size, per-file upload progress and status) used by `Courseupdatation.jsx` and `components/LectureAssignment.jsx` in place of bare `<input type="file">` — goes beyond §13.2's original "surface per-item failures" ask.

**Carried into Module 4 §12.1 step 7 for when the shadcn bootstrap happens:** swap the inline Tailwind buttons on the teacher dashboard, and `Modal`/`FileDropzone`/form inputs in the two creation forms, onto shadcn `Button`/`Dialog`/`Input`/`Progress` primitives — the current versions are already structured (consistent spacing, real status states) so this should be a drop-in swap, not a rewrite.
