# LearnStream — UI/UX & Frontend Architecture Audit

Date: 2026-09-10
Scope: `LearnStream/frontend` (React 18 + Vite + Tailwind), cross-checked against `LearnStream/backend` for the auth-related bugs.

This audit is based on reading the actual source, not just the deployed site. Every finding below cites the file and line it was found in.

---

## 1. Component library situation — why the UI feels inconsistent

`frontend/package.json` currently pulls in **three separate UI kits at once**, plus one icon set:

| Package | Used for | Status |
|---|---|---|
| `flowbite-react` (^0.10.2) | Navbar, Dropdown, Avatar, TextInput, Spinner | Actively used (`Navbar1.jsx`, `login.jsx`) |
| `mdb-react-ui-kit` (^9.0.0) | — | In `package.json`, not found used in any current page |
| `@mui/icons-material` (^7.1.2) | — | In `package.json`, not found used in any current page |
| `lucide-react` (^0.474.0) | Cart/shopping icons | Actively used (`Navbar1.jsx`) |
| Hand-rolled Tailwind divs | Cart, Home, Footer, course cards | Actively used |

Three design languages (Flowbite's rounded/blue defaults, MDB's Bootstrap-like defaults, and raw Tailwind) fighting for the same page is the direct cause of the alignment/spacing inconsistency you're seeing in the navbar and cart — each component brings its own default padding, font-weight, and breakpoint behavior, and nothing enforces a shared spacing/type scale across them.

**Recommendation:** consolidate on **one** system instead of hand-building every component from scratch. See `REQUIREMENTS.md` §2 for the specific recommendation and migration plan.

---

## 2. Confirmed functional bugs (not just visual)

### 2.1 "Shows unauthorised after signing in" — root cause found

`frontend/src/Pages/StudentPage.jsx:49-53` (the page that renders a logged-in student's own dashboard / courses at `/student/:user_id`):

```js
const response = await axios.get(`courses/student/${user_id}`, {
  headers: { 'Content-Type': 'application/json' },
  Authorization: `Bearer ${auth?.accessToken}`,   // ❌ sibling of `headers`, not inside it
  withCredentials: true,
})
```

`Authorization` is written as a **top-level key of the axios config object**, not inside `headers`. Axios ignores unrecognized top-level keys, so the bearer token is never actually sent. The request falls back entirely to the `studentAccessToken` cookie.

That cookie is set as `sameSite: "none"; secure: true` (`backend/src/controllers/UserAuth/UserStudent.controller.js:14-16`) because frontend and backend are deployed on **different domains** (Vercel-style frontend + Render-style backend). Cross-site cookies with `SameSite=None` are exactly the kind of cookie that Chrome/Safari increasingly block or partition by default in production, even though they work fine on `localhost` where both apps share an origin during dev. So in production you get a double failure: the bearer token is silently dropped by the bug above, *and* the cookie fallback is unreliable cross-site → the backend's `verifyJWTStudent` middleware (`backend/src/middleware/authstudent.middleware.js:8`) finds no usable token and returns `401 Unauthorized` — even though the user is genuinely logged in.

This single bug explains the exact symptom described: login succeeds, but the student's own courses page reports unauthorized.

Compare with every other page that attaches this header correctly, e.g. `Cart.jsx:15-19`, `EnrollButton.jsx:14-17`, `AddToCartBtn.jsx:16-19` — all of these put `Authorization` correctly inside `headers`. `StudentPage.jsx` is the one outlier.

Also in the same file: `StudentPage.jsx:7` imports directly from `../../../backend/src/utils/asyncHandler` — a **backend source file imported into frontend code**. This is dead/unused in that file but will break a production bundle if Vite ever tries to resolve it strictly, and is a sign the file was copy-pasted from a backend controller during development and never cleaned up.

### 2.2 No visible signup entry point in the UI

`frontend/src/components/Navbar1.jsx:93-101` — the navbar's only links are `Home`, `About`, `Services`, `Pricing`, `Contact`. There is **no Login or Sign Up link anywhere in the navbar**, logged in or out.

The *only* path into `/login` (and from there to `/signup/student` / `/signup/teacher`, which do exist and do work — see `Pages/login.jsx:72,121`) is the "Get Started" button in the hero section (`Pages/Home.jsx:36-41`). If that hero section fails to render properly (see §2.3), there is no way for a new visitor to find signup at all — which matches what you're seeing on the deployed site.

### 2.3 Hero section is fragile

`Pages/Home.jsx:22-24`:
```jsx
<section className="relative bg-[url('/assets/HeroImg.png')] bg-cover bg-center bg-no-repeat"
  style={{ height: "90vh", width: "100%" }}>
```
- The background image is referenced by absolute public path `/assets/HeroImg.png`. If that file isn't actually present in `frontend/public/assets/`, or the deployed build doesn't include it, the section renders as a plain black-gradient box with no image — visually broken but structurally still there (which matches "hero image section is not made properly").
- Fixed `height: "90vh"` combined with `bg-cover` means on very short/very tall viewports content can be cropped or leave large empty space; there's no `min-height` fallback.
- The "Learn More" CTA (`Home.jsx:43-48`) is `href="#"` — a dead link.
- Text uses a typo'd Tailwind class `sm:text-17xl` (`Home.jsx:28`) — not a real Tailwind size, so it silently does nothing and the heading never scales up on larger screens the way it was clearly intended to.

### 2.4 Broken/dead navbar and footer routes

None of `/about`, `/services`, `/pricing`, `/contact` exist as routes in `frontend/src/main.jsx:24-46` → clicking any of them from the navbar 404s. `Footer.jsx:28` also links to `/about`, same problem.

### 2.5 Navbar re-renders on full page reload for some links

`Navbar1.jsx` uses Flowbite's `Navbar.Link` with plain `href="/about"` etc. (not React Router `Link`/`NavLink`). On a React Router app this forces a full browser navigation/reload instead of client-side routing — breaks the SPA experience and will briefly flash a blank page each time (and would defeat in-memory auth state, since `auth` lives only in React context — see §2.6).

### 2.6 Auth token is memory-only; refresh depends on a cookie that may be blocked

`AuthProvider.jsx:8,18` stores `auth` in a plain `useState` with no persistence. On every hard reload it calls `fetchNewAccessToken()` (`api/auth.js:6`), which depends entirely on the `studentRefreshToken`/`teacherRefreshToken` cross-site cookie. If that cookie is blocked/partitioned (same class of issue as §2.1), the user appears logged out on every refresh even though they logged in seconds ago — and any full navigation (§2.5) triggers exactly this reload.

There is also no axios response interceptor to catch a `401` and transparently retry with a refreshed token (`api/axios.js:11-28` — the interceptor code is present but **entirely commented out**). Every page currently does its own manual try/catch around 401s instead.

### 2.7 Dead code left in the repo

- `frontend/src/App.jsx` is **not the real entry point** (`main.jsx` is — it builds its own router directly with `createBrowserRouter`) and is broken on its own terms: it uses `<Router>`, `<Routes>`, `<Route>` without importing any of them from `react-router-dom`, and imports from paths that don't exist (`./flowbite-componets/Navbar1`, `'/pages/Student '` with a trailing space). Safe to delete.
- `components/login-form.jsx` and `components/Signup.jsx` are not imported by any route in `main.jsx` (the live routes use `Pages/Login-students.jsx`, `Pages/Login-teacher.jsx`, `Pages/Signup-students.jsx`, `Pages/Signup-Teacher.jsx`, `Pages/login.jsx` instead). Confirm and delete to stop the duplicate/competing login UI from causing confusion during future edits.
- `mdb-react-ui-kit` and `@mui/icons-material` in `package.json` — no current usage found; remove unless something depends on them.

---

## 3. Layout/alignment problems

### 3.1 Navbar (`Navbar1.jsx`)
- Cart icon (`ShoppingCart` from lucide, `Navbar1.jsx:81-85`) is rendered as a bare clickable icon with no button wrapper, no padding/hit-area, no hover state, and no item-count badge — it sits inline next to the avatar dropdown with inconsistent vertical alignment because the two come from different component systems (Flowbite `Avatar`/`Dropdown` vs. a raw `lucide-react` icon).
- The `<div className="flex md:order-2">` wrapping the dropdown + cart has no `items-center` or `gap`, so vertical centering and spacing between the avatar and cart icon is left to accident rather than being explicit.

### 3.2 Cart page (`Pages/Cart.jsx`)
- Overall two-column layout (`flex flex-col md:flex-row gap-6`, `Cart.jsx:60`) is reasonable, but individual line items (`Cart.jsx:68-89`) don't set a fixed image-column width against the text column reliably across breakpoints — on narrow-but-not-mobile widths the thumbnail, title block, and price/remove block can wrap unevenly since only the outer row is `flex`, not a defined grid with fixed track sizes.
- No loading state and no empty-cart illustration — just a text line — and no quantity concept (fine for a course cart, but "Order Summary" duplicates totals already shown at the bottom of the item list with no visual hierarchy distinguishing the two).

### 3.3 General
- Spacing scale is inconsistent across pages — some use Tailwind's default scale (`gap-4`, `gap-6`), Flowbite components bring their own internal padding that doesn't match, and there is no shared `container`/max-width convention (`Home.jsx` uses `max-w-screen-xl`, `Footer.jsx` also uses `max-w-screen-xl`, `Cart.jsx` uses raw `px-4 md:px-12` with no max-width at all — so cart content stretches edge-to-edge on wide screens while everything else is capped).

---

## 4. Missing pages (as requested)

| Page | Current state |
|---|---|
| Sign up | Exists (`/signup/student`, `/signup/teacher`) but unreachable from navbar — see §2.2 |
| Profile | Does not exist at all — no route, no component |
| About | Linked from navbar/footer, route doesn't exist → 404 |
| Services | Linked from navbar, route doesn't exist → 404 |
| Pricing | Linked from navbar, route doesn't exist → 404 |
| Contact | Linked from navbar, route doesn't exist → 404 |

## 5. Missing landing-page content

- No total course count / "N+ courses" style stat anywhere on the landing page. `GeneralCourses.jsx:26` already fetches a `courses` array per-category — the count is derivable client-side today, but a proper landing-page-wide total (across all categories) needs either the existing `/courses/getallCourses` endpoint or a dedicated lightweight count endpoint (see `REQUIREMENTS.md` §5).

---

## 6. Course detail page, video player, progress tracking, and teacher review flow

Reviewed against the actual code: `components/CourseComp.jsx`, `Pages/ViewStudentModule.jsx`, `Pages/LectureAssig.jsx`, `components/YourWork.jsx`, `Pages/UploadedAssignment.jsx`, `Pages/ViewtheModules.jsx`, `components/LectureAssignment.jsx`, and the backend controllers `Lecture.controller.js`, `Assignment.controller.js`, `Course.controller.js`.

### 6.1 Course detail page ("lorem ipsum" / fake-looking content)
- **Star ratings are hardcoded**, not real data: `CourseComp.jsx:27-70` renders exactly 5 gold stars and a `5.0` badge for **every course, unconditionally** — there is no `Review`/`Rating` model anywhere in the backend. Every course looks like a perfect 5-star course because the number is literally hardcoded, not because reviews were seeded.
- Whatever description text you're seeing on a course detail page (`ViewStudentModule.jsx:203`, `<p>{course.description}</p>`) is rendered as-is from whatever was typed into the free-text `Textarea` on course creation (`MakeaCourse.jsx:109-117`) — if it reads as lorem ipsum in production, that's seed/test data sitting in the database, not a rendering bug. Worth auditing existing course documents and adding a min-length / placeholder-text check on the create-course form so this can't happen again.
- No syllabus/"what you'll learn" summary before purchase — a buyer has to expand every module accordion row individually to see what's inside a course.

### 6.2 Lecture video player & layout (`Pages/LectureAssig.jsx`)
- Once you click into a module, its lecture/assignment grouping is lost — `LectureAssig.jsx` receives one module's `lectures` and `assignments` as two flat arrays via router `state` and renders them as two flat lists titled just "Lectures and Assignments" (lines 88-133), with no module heading, numbering, or total-duration summary.
- No auto-selection of the first/next incomplete lecture — the video panel shows an empty "Select a lecture to play..." placeholder on first load (line 149-151).
- `ReactPlayer` (lines 140-147) only sets `url`, `controls`, `width`, `height` — no `onProgress`, `onEnded`, `onError`, or `light` (poster thumbnail) prop. No resume-from-last-position, no visible error state if a Cloudinary URL is bad, no thumbnail before pressing play.
- Assignment attachments are labeled generically "Assignment 1", "Assignment 2" (line 162) by array index instead of each file's actual filename — unhelpful once a module has more than one attachment.

### 6.3 "90%-completion" check does not exist — completion is really "was opened once"
This is the most significant functional gap, and it's the literal answer to "how does the course/video completion check itself on 90%":
- A lecture is marked complete the instant its card is **clicked** (`LectureAssig.jsx:48-67`, the POST to `/complete` fires in `handleSelectLecture`, before any video plays), not based on how much of the video was watched.
- `ReactPlayer` has no `onProgress` handler wired up anywhere in the component, so the frontend never even measures watch percentage in the first place — there is no 90% (or any %) threshold implemented. The checkbox next to each lecture (line 101-108) reflects "was opened," not "was watched."
- Server-side, `Course.controller.js:292` computes `progressPercentage` purely from `completedLectureCount / totalLectures` — `totalAssignments`/`completedAssignmentsCount` are fetched and returned to the frontend (`ViewStudentModule.jsx:158-161`) but never folded into the percentage, so a student can show 100% course progress after opening every video once, having submitted zero assignments.
- `YourWork.jsx:65-81` (`markAsDone`) lets a student mark an **assignment** complete with one click, with no server-side check that they ever actually uploaded a submission first (`markAssignmentCompleted` in `Assignment.controller.js:242-277` doesn't verify `uploadedAssignments` contains an entry for that student).

### 6.4 Assignment upload — a real security/privacy bug, plus UX gaps
- **Security bug**: `getAssignmentById` (`Assignment.controller.js:158-172`, `GET /courses/:courseId/assignments/:assignmentId`, guarded only by `verifyJWTStudent` — i.e. any logged-in student) selects the assignment with `.select('-module_id -assignmentUrls')`. It does **not** exclude `uploadedAssignments`, so the response contains **every student's submitted file URLs** for that assignment, not just the requester's own. `YourWork.jsx:14-19` calls this exact endpoint to populate "Your Work" — meaning the data underlying that screen already includes classmates' submissions; any student who inspects the network response (or a future UI change that displays more of it) can see and open other students' submitted files. This needs a backend fix: filter `uploadedAssignments` down to the requesting student's own entries (`req.student._id`) before responding.
- `YourWork.jsx:56` refetches from `GET /courses/${courseId}/assignments/${assignmentId}/submissions` right after a successful upload — **this route doesn't exist** in `assignments.routes.js`. The request 404s and is silently swallowed, so the "Uploaded Assignments" list never actually refreshes after upload; the student has to manually reload the page to see their own file appear.
- No upload progress indicator — `handleUpload` (`YourWork.jsx:35-62`) just awaits the whole POST with no percentage/progress bar, then a plain `alert()`.
- No deadline enforcement in the UI: the backend already computes `submittedOnTime` (`Assignment.controller.js:129`), but nothing in `YourWork.jsx` ever disables the upload button or shows "late"/"on time" once the deadline has passed.

### 6.5 Teacher review flow
- The teacher's submission-review page (`Pages/UploadedAssignment.jsx`) is view/download only — `handleDownload` (lines 11-19) opens every submitted file in its own new browser tab, which triggers popup-blocker warnings once a student submits more than 2-3 files, instead of a zip download or inline preview.
- **There is no grading or feedback mechanism anywhere** — the `uploadedAssignments` subdocument (backend model) has no `grade`, `feedback`, or `status` field, and no UI exists to set one. A teacher can look at a submission but has no way to respond to it (approve, request resubmission, leave a comment, assign a grade).
- **Confirmed dead button**: in `Pages/ViewtheModules.jsx`, the inner `ModuleDropdown` component declares `let owner_id` (line 26) but never assigns to it — only `setOwnerId(...)` (state) is ever called. The "Add lecture-assignment" button's visibility check at line 174 is `user_id==owner_id`, comparing against a variable that is `undefined` forever. **This button never renders for anyone, including the real course owner.** (Content can still be added via the separate `/teacher/:user_id/makecourse` flow, but this in-page entry point is silently broken.)
- The same "who owns this course" check (`GET /courses/:id/getTeacher`) is independently fetched twice on the same page — once in `ViewtheModules` itself (lines 197-212) and once again, verbatim, inside every `ModuleDropdown` instance it renders (lines 27-42) — duplicated code and a duplicated network call per module on the page.
- `ViewtheModules.jsx:9-10` imports React components (`CustomLogo`, `AssignmentIcon`) directly from the `public/` folder (`../../public/assets/lectureLogo`, `../../public/assets/assignmentsvg`). Vite's `public/` directory serves files as static assets, not as importable modules — this is unsupported and likely why these icons don't render reliably.
- `deletelecture` (`ViewtheModules.jsx:261`) does a full `window.location.reload()` after deleting, while the near-identical `deleteAssignment` right next to it correctly updates local state with no reload — inconsistent behavior between two copies of essentially the same action.
- The lecture/assignment upload form used by teachers (`components/LectureAssignment.jsx`) sends its POST requests with only `Content-Type: multipart/form-data` and **no `Authorization` header at all** (lines 49-53, 63-67) — it relies entirely on the same fragile cross-site cookie described in §2.1/§2.6. It also uploads every lecture video and every assignment file **sequentially, one `await` at a time in a `for` loop** (lines 44-69), with no per-file progress indicator — for a module with several videos this is a long silent wait ending in a single `alert()`, and a failure partway through leaves the already-uploaded files orphaned with no rollback or retry.

---

## 7. Summary of everything to correct

1. Fix the `Authorization` header placement bug in `StudentPage.jsx` (§2.1) — highest priority, this is the actual "unauthorized" bug.
2. **Security fix**: stop `getAssignmentById` from leaking every student's submitted assignment files to any other logged-in student (§6.4) — this should ship alongside item 1, it's a data-privacy bug, not a cosmetic one.
3. Decide on and migrate to a single component system (§1, detailed in `REQUIREMENTS.md` §2).
4. Add Login/Sign Up (and Cart, when logged in) as persistent, always-reachable navbar links; fix navbar links to use React Router `Link`, not raw `href`.
5. Fix/rebuild the hero section: verify the image asset actually ships in the build, replace the invalid `sm:text-17xl` class, add a responsive `min-height` instead of a fixed `90vh`, fix the dead "Learn More" link.
6. Build real pages for About, Services, Pricing, Contact (or remove the links until they exist) — and add Profile.
7. Re-lay-out the navbar and cart with an explicit grid/flex system (Tailwind's grid utilities, detailed in `REQUIREMENTS.md` §4) instead of ad hoc flex wrapping.
8. Add a course-count stat to the landing page.
9. Un-comment and wire up the axios response interceptor for automatic token refresh on 401 (§2.6), so a stale access token doesn't strand the user mid-session.
10. Replace hardcoded 5-star ratings with either a real review system or no rating UI at all (§6.1).
11. Build real watch-percentage tracking for lecture completion (§6.3) — currently "completed" only means "clicked once," not "watched 90%."
12. Fix the dead "Add lecture-assignment" button in `ViewtheModules.jsx` (§6.5) and add a teacher grading/feedback mechanism for submitted assignments, which doesn't exist today.
13. Delete dead code: `App.jsx`, unused `components/login-form.jsx` and `components/Signup.jsx`, unused `mdb-react-ui-kit`/`@mui/icons-material` dependencies (after confirming zero usage).
