# LearnStream — Backend Audit & Restructuring Plan

Date: 2026-09-11
Companion docs: `UI_AUDIT.md` (frontend findings), `REQUIREMENTS.md` (frontend/fullstack requirements + Module 4/6 plans)

---

## 0. Scope, method, and how to read this

**Scope**: `LearnStream/backend/` in full — all 44 files, ~2,945 lines of `src/`. Every controller, route, model, middleware, and util was read end to end; nothing was sampled.

**Method**: static reading, plus targeted empirical verification where a claim was load-bearing. Two hypotheses were tested and **disproved** during this audit (noted inline in §6.4) rather than reported as bugs — findings below are what survived checking.

**Verification status** is marked on every finding:

- **[VERIFIED]** — reproduced at runtime (live server, or an isolated harness) during this audit.
- **[READ]** — established by direct code reading, with file:line citation, but not executed.
- **[RISK]** — a real weakness whose exploitability depends on conditions not confirmed here. Stated as a risk, not a claim.

**Severity**:

| Tier | Meaning |
|---|---|
| **P0** | Exploitable now, or an endpoint that is broken on every call. Ship fixes first. |
| **P1** | Data integrity, money, or auth correctness. Not immediately exploitable but actively harmful. |
| **P2** | Wrong behaviour, bad API contracts, performance. |
| **P3** | Hygiene, dead code, consistency. |

**Important context**: `backend/.env` sets `CORS_ORIGIN=http://localhost:2000,https://learnstream.onrender.com` — so this backend is **deployed publicly**, at `https://whathecode-learnstream.onrender.com` (`frontend/src/api/axios.js:5`). The P0 findings below were verified against the local instance first; **§1.1 has since been confirmed live in production too** (2026-09-11, see the finding itself) — treat every other P0 as live until proven otherwise, not as a backlog item.

---

## 1. P0 — Critical

### 1.1 Unauthenticated full bypass of paid course content [VERIFIED]

The complete chain was executed end to end against the running backend, with **no credentials at any step**:

1. `GET /courses/getallCourses` — public by design (`courses.routes.js:31`), returns every course `_id`.
2. `GET /courses/:course_id/modules` — **has no auth middleware at all** (`modules.routes.js:10-12`: `.post(verifyJWT, addModule)` is guarded, `.get(getCourseModules)` is not). Returned **HTTP 200** unauthenticated.
3. That handler (`Modules.controller.js:139-155`) populates lectures with `select: 'title duration freePreview public_id'` and assignments with `select: 'title deadline public_id'` — so the response contains the **Cloudinary `public_id` of every lecture video and every assignment file**.
4. `public_id` is the only secret needed to build a direct asset URL — the frontend itself does exactly this (`LectureAssig.jsx:11,52,76` builds `https://res.cloudinary.com/dc9lboron/{video|image}/upload/<public_id>.{mp4|pdf}`).

Fetching one leaked `public_id` from step 3 returned **HTTP 200, `application/pdf`, 3,109,894 bytes** — the actual course material, to an unauthenticated caller.

This is not a theoretical enumeration issue: steps 1–2 hand the attacker the complete list of ids, so the whole catalogue's material is walkable by script.

**Contributing factor**: the Cloudinary assets are themselves public-read (Cloudinary's default delivery). Fixing the API alone narrows the hole but does not close it while a leaked or previously-scraped `public_id` stays valid forever.

**Fix**: (a) require auth + enrollment on `getCourseModules`; (b) never return `public_id` to a caller who is not enrolled or the course owner; (c) move lecture/assignment delivery to Cloudinary **signed, expiring URLs** (or `type: authenticated` uploads) so a leaked id is not a permanent key. (c) is the only one that fixes already-leaked ids.

**Confirmed live in production (2026-09-11)**: `GET https://whathecode-learnstream.onrender.com/courses/678bf0eb072334a2221207fa/modules` (course id taken from the public `/courses/getallCourses` response) returned **HTTP 200** with no credentials, including a real assignment `public_id` (`za6mvtz9saqlctx1wjxt`). This is not a local-only finding — the deployed instance runs the same vulnerable code. The `public_id` was not fetched from Cloudinary in this check (confirming the API-level bypass was sufficient; step 4 of the chain above already proved the download works, against the local instance). Treat this as a live incident: prioritize §7 Module B0/B1, and rotate the token secrets (§1.4) regardless, since they've been logged for the life of the deployment.

### 1.2 Any teacher can read any other course's student PII and submissions [READ]

`GET /courses/:courseId/assignment/:assignmentId` → `getStudentsAndUploadedAssignments` (`assignments.routes.js:26-27`) is guarded by `verifyJWT` — *any authenticated teacher* — and the handler (`Assignment.controller.js:218-248`) performs **no course-ownership check**. It returns, for every submission: `studentName`, `studentEmail`, and `submittedAssignmentUrls`.

So any teacher with a valid token can read the full roster, email addresses, and submitted files of **any assignment in any course**, by iterating assignment ids.

This is the teacher-side twin of the student-side leak that Module 1 fixed in `getAssignmentById` — Module 1 closed one half and left this half open. `assertCourseOwnership` already exists (`utils/verifyOwnership.js`) and is simply not called here.

**Related, same root cause**: `GET /courses/:courseId/students` → `getEnrolledStudents` (`courses.routes.js:42`, `Course.controller.js:222-234`) — also `verifyJWT` with no ownership check. Lower impact (returns ObjectIds, not names/emails) but the same gap.

### 1.3 `POST /courses/enroll` throws on every call — missing import [VERIFIED by read + grep]

`Course.controller.js:185` calls `enrollStudentInCourses(student_id, course_ids)`. That function lives in `utils/enrollment.js` and is **never imported into this file** — confirmed by grep: the only occurrence of the name in `Course.controller.js` is the call site itself, with no matching import line.

Result: `ReferenceError: enrollStudentInCourses is not defined` → 500 on every request to the wired route `POST /courses/enroll` (`courses.routes.js:39`).

This is a **regression introduced by Module 2's refactor**: the helper was extracted to `utils/enrollment.js` and correctly imported into `Payment.controller.js:10`, but the original caller was never updated. It went unnoticed because Module 2 also removed the frontend's client-side enroll call (`displayRazorpay.js`), so nothing exercises the endpoint — but it is still routed and publicly reachable by any authenticated student.

**Fix**: add the import, or delete the endpoint if enrollment is now exclusively payment-driven. Prefer deleting — see §5.5.

### 1.4 Access and refresh tokens are written to server logs in plaintext [READ]

Long-lived bearer credentials are logged on the hot path:

- `UserStudent.controller.js:106` and `:166` — `console.log("Cookies set: ", accessToken, refreshToken)` on **every registration and every login**.
- `UserTeacher.controller.js:113` — same, on every teacher login.
- `auth.routes.js:67-68` — `console.log("Student Refresh:", ...)` / `("Teacher Refresh:", ...)` on **every token refresh**.
- `authstudent.middleware.js:12` — `console.log(token)` on **every authenticated student request**.

A refresh token is a full account takeover primitive and these are valid for `REFRESH_TOKEN_EXPIRY`. Anyone with log access — including a hosting provider's log aggregation, or anyone who can read a deployment's log stream — has standing credentials for every user who has logged in.

This is the same class as the plaintext-password logging Module 1 removed from `UserStudent.controller.js`, and arguably worse: a password log is one secret per user, a token log is a directly replayable session.

**Fix**: delete all four. Then add a lint rule or log wrapper so credentials can't be logged again (§5.7).

### 1.5 Logout never invalidates the session server-side [READ]

`UserStudent.controller.js:194-196` and `UserTeacher.controller.js:141-143`:

```js
await UserStudent.findByIdAndUpdate(decoded._id, { $set: { refreshToken: undefined } });
```

Mongoose **strips `undefined` values from update objects** before sending them to MongoDB (this is the documented default; `$set: {x: undefined}` becomes a no-op, not a write of null). So the stored `refreshToken` is left **completely untouched**.

The response clears the cookies, so the browser forgets the token — but the token itself remains valid in the database. `auth.routes.js:44` gates refresh on `user.refreshToken !== incomingRefreshToken`, so anyone who captured that refresh token (see §1.4 — it's in the logs) can keep minting fresh access tokens **after the user has logged out**, indefinitely.

**Fix**: `$unset: { refreshToken: 1 }` or `$set: { refreshToken: null }`. Verify with a DB read after logout, not just a 200 response.

---

## 2. P1 — High

### 2.1 There is no error-handling middleware — every error leaks a stack trace as HTML [VERIFIED]

`app.js` (51 lines) registers routers but **never registers an error handler** (`app.use((err, req, res, next) => ...)`). `asyncHandler` (`utils/asyncHandler.js:4`) correctly forwards to `next(err)`, so every thrown `ApiError` lands in **Express's built-in default handler**.

Reproduced in an isolated harness using this codebase's own `ApiError` + `asyncHandler` + its installed Express:

| Thrown | HTTP | Content-Type | Body |
|---|---|---|---|
| `new ApiError(404, "proper not found")` | 404 | `text/html` | `<!DOCTYPE html>…<pre>Error: proper not found<br>at /home/…/backend/…` |
| `new ApiError("course not found")` | **500** | `text/html` | `<pre>Error: Something went wrong<br>at /home/…` |

Two distinct consequences:

**(a) Every error response is HTML carrying a full stack trace with absolute server filesystem paths.** `.env` has `NODE_ENV=development`, which is what makes Express include the stack. This leaks internal structure to any client that triggers any error.

**(b) The frontend can never read an error message.** Every frontend handler does `err.response?.data?.message` — against an HTML body that is `undefined`. This is the root cause of the generic "Something went wrong" / silent-failure symptoms logged throughout `UI_AUDIT.md`, and no amount of frontend work can fix it from that side.

**Fix**: add a global error handler that serializes `ApiError` to the same `{statusCode, data, message, success}` envelope `ApiResponse` uses, includes `stack` only when `NODE_ENV !== "production"`, and maps Mongoose `ValidationError`/`CastError` and Multer errors to 400. This is the single highest-leverage change in this document.

### 2.2 16 `ApiError` calls omit the status code, silently discarding the message [VERIFIED]

`ApiError`'s signature is `(statusCode, message, errors, stack)`. Sixteen live call sites pass the **message as the first argument**, so the human-readable string lands in the `statusCode` slot and `message` falls back to the default `"Something went wrong"`.

Verified behaviour (row 2 of the table in §2.1): status becomes **500** instead of the intended 4xx, and the intended message is **lost entirely**.

Locations — `Course.controller.js`: 76, 89, 101, 114, 129, 165, 209, 212, 228, 240, 254. `Assignment.controller.js`: 56, 65, 71, 80, 137.

Notably `createAssignment` (`Assignment.controller.js:56,65,71,80`) is a live, routed teacher endpoint, so a teacher hitting a validation problem gets a 500 with no explanation rather than a 400 telling them what's wrong.

**Fix**: add the status codes. Then make it unrepeatable — either require `statusCode` to be a number in the constructor (throw on a string) or add a lint rule.

### 2.3 Cascade-delete hooks are dead code — orphaned records accumulate on every delete [READ]

`courses.js:167-181` registers `courseSchema.pre('remove', …)` and `Modules.js:30-42` registers `moduleSchema.pre('remove', …)`.

`package.json` pins **`mongoose: ^8.7.3`**. `Document.prototype.remove()` was deprecated in Mongoose 6 and **removed in Mongoose 7** — `pre('remove')` document middleware no longer fires for anything in v8. Both hooks are unreachable.

Worse, `deleteModule` (`Modules.controller.js:132`) carries a comment asserting the opposite:

```js
await module.deleteOne(); // Triggers the `pre` middleware for cleanup
```

`deleteOne()` is *query* middleware; the schema registers a *document* `remove` hook. Nothing fires.

**Two further defects in the same hooks**, so they would not have worked even on an older Mongoose:

- `courses.js:170` queries `Modules.find({ course_id: this._id })`, but the module schema's field is **`course`**, not `course_id` (`Modules.js:14-18`). The query matches nothing.
- `deleteModule` also never `$pull`s the deleted module's id out of the parent `course.modules[]` array, leaving **dangling ObjectIds** that `getCourseModules`'s `.populate()` renders as `null` entries.

**Net effect**: deleting a module orphans all its lectures and assignments in the database forever, and corrupts the parent course's `modules` array. Deleting a course orphans everything beneath it.

**Fix**: replace with explicit cascade logic in a service layer (§5.3) — not more hooks. Hooks that silently don't fire are how this happened. Also needs a one-off cleanup migration for already-orphaned records.

### 2.4 Cloudinary video and PDF assets are never actually deleted [READ]

`utils/cloudinary.js:63-70`:

```js
const deleteMediaFromCloudinary = async (publicId) => {
  await cloudinary.uploader.destroy(publicId);
};
```

`uploader.destroy()` defaults to **`resource_type: "image"`**. Uploads are performed with `resource_type: "auto"` (`cloudinary.js:18`), so lecture videos are stored as `video` and assignment PDFs as `image`/`raw` depending on the file.

Callers: `deleteLecture` (`Lecture.controller.js:141`) deletes a **video** — the destroy call silently no-ops and the video stays in Cloudinary, still fetchable by anyone holding its `public_id` (see §1.1). `updateLecture` (`:108`) has the same problem when replacing a video, so every replacement leaks a permanently-retained orphan.

Two costs: unbounded Cloudinary storage/quota growth, and **deleted content remaining publicly retrievable**.

**Fix**: store `resource_type` alongside `public_id` on the model, pass it to `destroy()`, and check the `{result: "ok" | "not found"}` response rather than ignoring it.

### 2.5 `deleteAssignment` fires deletions it never waits for [READ]

`Assignment.controller.js:199-201`:

```js
assignment.public_id.forEach(async (id) => {
  await deleteMediaFromCloudinary(id);
});
```

`forEach` ignores the returned promises. The handler proceeds to delete the DB record and respond 200 while the Cloudinary calls are still in flight. Any rejection becomes an **unhandled promise rejection** — which on Node 15+ terminates the process by default.

**Why the `await` inside the callback doesn't help.** This is the trap that makes the bug easy to miss in review: the code *reads* as though it waits. But `forEach` never looks at what its callback returns. Marking the callback `async` makes it return a promise, and `forEach` throws that promise on the floor. The `await` on line 185 suspends only that one callback invocation — it does not suspend `forEach`, and it does not suspend the handler. `forEach` hands back `undefined` the moment it has *started* every callback, not when they finish. (A `for (const id of assignment.public_id) { await … }` loop would have awaited correctly; so would collecting the promises and awaiting them together, which is what the fix does.)

**Concrete walkthrough.** Say a teacher deletes an assignment with three uploaded PDFs, and Cloudinary happens to time out on the third:

| time | what happens |
|---|---|
| `t=0ms` | `forEach` calls `deleteMediaFromCloudinary` three times in a row. Each fires an HTTP request to Cloudinary and immediately returns a pending promise. All three promises are discarded. `forEach` returns. |
| `t=1ms` | The handler carries straight on — nothing has been awaited. Three requests are still in flight. |
| `t=2ms` | `course.save()` and `module.save()` — the assignment's id is pulled out of both parent arrays. |
| `t=5ms` | `Assignments.findByIdAndDelete(assignmentId)` — the assignment document is gone. **This document was the only record of those three `public_id`s.** |
| `t=6ms` | `res.status(200).json(… "Assignment deleted succesfully")`. The teacher is told the delete worked. |
| `t=400ms` | Cloudinary finally answers. Files 1 and 2 deleted fine. File 3 rejects. |
| `t=400ms` | That rejection has no `.catch()` and nothing awaiting it. Node treats it as an unhandled rejection and, since v15, **exits the process** — killing every other request this server was handling at that moment, for a completely unrelated user. |

Two distinct failures fall out of that timeline. The loud one is the crash at `t=400ms`: a single flaky third-party call takes down the API for everybody. The quiet one is at `t=5ms`: because the DB record is deleted before anyone knows whether the asset deletions succeeded, and that record held the only copy of the `public_id`s, a failed deletion leaves an asset in Cloudinary that **nothing in the system can still name**. It isn't recoverable by inspection — you'd have to diff the entire Cloudinary account against the database to find it. And because §2.4's `destroy()` silently no-ops on the wrong `resource_type` and *resolves successfully*, the common case wasn't even the loud one: deletions "succeeded", the record vanished, and the file quietly stayed public forever.

So a Cloudinary hiccup during assignment deletion can take the whole API server down, and the assets are orphaned regardless (compounded by §2.4).

**Fix**: `await Promise.allSettled(assignment.public_id.map(deleteMediaFromCloudinary))`, and log failures rather than throwing mid-delete. `allSettled` waits for every call to finish and never rejects, so the handler can inspect each outcome and log the failures, then delete the DB record deliberately rather than racing it. Note the fix keeps the same *order* — assets first, then the database — but now the order is meaningful, because by the time the DB record is removed the asset outcomes are actually known and any failure has been written to the log with its `public_id` still in hand. A logged orphan is recoverable; the pre-fix silent one was not.

**Fixed in Module B3** (2026-09-12) — see §10.2 for the current implementation and why `Promise.allSettled` is used instead of `Promise.all`, and §7's B3 checklist for the one-off script that swept up the orphans this bug had already created.

### 2.6 Submission lateness is decided by a client-supplied deadline [READ]

`submitAssignment` (`Assignment.controller.js:127-133`):

```js
const { deadline } = req.body;
...
const submittedOnTime = Date.now() < deadline ? true : false;
```

The deadline is read from the **request body**, not from the `Assignment` document — which already stores an authoritative `deadline` (`courses.js:120-124`). A student can post any future timestamp and always be recorded as on time.

This is precisely the class of bug Module 1 fixed for payment amounts ("never trust a client-supplied amount"); the same mistake is live here.

**Second bug in the same write**: the handler pushes `submittedOnTime` into the `uploadedAssignments` subdocument (`:149-154`), but that subschema (`courses.js:125-143`) has **no `submittedOnTime` field** — it lives on the separate `checked[]` array. Mongoose strict mode silently drops it. So lateness is **never persisted at all**, tamperable or not.

**Also**: no check that the assignment exists (`findByIdAndUpdate` returns null for a bad id and the result is ignored — the endpoint returns 200 "submitted successfully" having written nothing), and no check that the student is enrolled in the course.

### 2.7 Razorpay order amounts are computed in floating point [READ]

`Payment.controller.js:34`:

```js
const amount = courses.reduce((sum, course) => sum + course.price, 0) * 100; // paise
```

`price` is a `Number` (`courses.js:23-26`). Any non-integer price produces a non-integer paise value — `19.99 * 100` is `1998.9999999999998` in IEEE-754. Razorpay requires an integer paise amount and will reject or mis-charge.

**Fix**: `Math.round(total * 100)`, and store prices as integer paise in the model to remove the class of bug entirely.


**Resolved 2026-09-12.** Prices are now stored and transmitted as integer paise, validated as whole non-negative integers at the schema, so a fractional price can no longer be created at all. The `* 100` in `createOrder` is gone. Migrated with `scripts/migrate-prices-to-paise.js`: 13/13 courses, none fractional in live data, and a marker in a `migrations` collection makes a second run a hard stop (re-running would multiply by 100 again). `orders.amount` was already paise and was left untouched.

### 2.8 Payment has no webhook — a closed browser loses the enrollment [READ] — **backend-completion prerequisite**

Enrollment happens only inside `verifyPayment` (`Payment.controller.js:107`), which runs only if the **browser** calls back after checkout. If the user closes the tab, loses connectivity, or the handler throws between Razorpay confirming and the enrollment write, the order stays `status: "created"` forever and the student is never enrolled — while Razorpay has taken the money.

Module 2 correctly fixed the *frontend* half of "paid but not enrolled" by making enrollment atomic with verification server-side. This is the remaining half: there is no server-to-server path, so payment success still depends on the client completing a round trip.

**Confirmed live 2026-09-11**: the full checkout path (order create → Razorpay UPI test payment via `success@razorpay` → `verifyPayment` → enrollment → course visible on the student's page) works end to end. That's exactly why this finding is promoted from "P1 hardening" to a **completion prerequisite**: the happy path working is precisely what hides this gap — it only shows up as silent revenue loss (charged, not enrolled, no error, no record to reconcile) the first time a real user's browser doesn't complete the round trip. The backend track should not be called done with fulfilment still client-driven only.

**Fix**: add a Razorpay **webhook** endpoint (signature-verified against `RAZORPAY_WEBHOOK_SECRET`) as the authoritative fulfilment path, and make `verifyPayment` an idempotent fast-path. Requires the idempotency work in §2.9.


**Resolved 2026-09-12.** `scripts/reconcile-orders.js` asked Razorpay what it actually recorded against every unfinished order. The headline number needs stating carefully, because the first reading of it was wrong and the correction matters more than the original claim.

5 orders showed a captured payment with the order still at `created`. That looks like 5 students charged and denied access. **It is not.** All 5 belong to *one* student, all for the same ₹788 course, and that student **is** enrolled in it (confirmed on both `userstudents.Courses` and `courses.enrolledStudents`). They are duplicate order records from repeated checkout attempts on 2025-06-25, not 5 people locked out. 26 further orders were already paid and enrolled and needed only the new provenance fields; 33 were abandoned before payment, which is normal.

That correction was itself incomplete, and the third reading is the one that matters. Those 5 orders stored a singular `course_id` the current schema doesn't declare, so every local signal about them was unreliable. Recovering the real course ids — from Razorpay's order `notes`, which `createOrder` has always populated — and then comparing each paid order against the student's *actual* enrollments found **3 orders, across 2 different students, that were paid and genuinely never enrolled**: one ₹78 course and two orders for a ₹50,000 course. All three were repaired on 2026-09-12; both students now hold what they paid for.

**So §2.8's damage is real and present in this database, not merely logical.** The reason it stayed hidden through two passes is the lesson worth keeping: those orders were marked `paid`, carried a `fulfilledAt`, and named a course — every marker said "fulfilled" while the student held nothing. No status field can detect that. Only joining orders against real enrollments can, which is why `reconcile-orders.js` now examines **every** order rather than only those that look unfinished, and reports a `DRIFTED` bucket separately from missing-marker backfills.

Final state after reconciliation: 0 lost, 0 drifted, 0 orders missing `course_ids` (was 37 of 64), 31 settled, 33 abandoned before payment (normal). `POST /payment/webhook` is now the authoritative path, verified with the SDK's `validateWebhookSignature` over the raw request body. **Not yet live: it needs a real `RAZORPAY_WEBHOOK_SECRET` in `backend/.env` and a webhook registered in the Razorpay dashboard.** Until both exist the endpoint refuses every call with a 500 and logs why — deliberately loud, because a webhook that silently no-ops is indistinguishable from not having one.

#### Bringing the webhook live (one-time setup)

The endpoint is written, e2e-verified, and inert until these steps are done. It must be reachable at a **public HTTPS URL** — Razorpay calls it server-to-server, so `localhost` cannot work.

1. Generate a secret locally and keep it: `openssl rand -hex 32`. It is unrelated to `RAZORPAY_KEY_SECRET` and should not be reused from it.
2. Razorpay Dashboard → **Settings → Webhooks → Create New Webhook**.
3. **Webhook URL**: the deployed backend's public origin plus `/payment/webhook` (for the Render deployment, `https://<service>.onrender.com/payment/webhook`).
4. **Secret**: paste the value from step 1.
5. **Active Events**: tick **`payment.captured`**. That is the only event the handler acts on; anything else is acknowledged with a 200 and ignored, so subscribing to more is harmless but pointless.
6. Save, then set the same value as `RAZORPAY_WEBHOOK_SECRET` in **both** `backend/.env` (local) and the Render service's environment variables (production). A mismatch fails every signature check and looks exactly like an attack in the logs.
7. Verify: make a test payment and confirm the dashboard's webhook delivery log shows a 200. In the database the order should then carry `fulfilledAt` and `fulfilmentSource`. A `fulfilmentSource` of `"webhook"` means the browser never came back and the webhook is doing precisely the job it was added for.

To exercise it against a local backend, expose port 8000 through a tunnel (`ngrok http 8000` or `cloudflared tunnel`) and point a **separate test-mode webhook** at that URL — never repoint the production one.

Run `node scripts/reconcile-orders.js` periodically regardless. The webhook closes the gap going forward, but one that is misconfigured, paused, or has exhausted its retries still leaves orders stranded, and only reconciliation against Razorpay will surface them.

### 2.9 `verifyPayment` is neither idempotent nor bound to the paying user [READ]

`Payment.controller.js:69-117`:

- **No idempotency**: replaying the same valid signature re-runs the whole handler. `enrollStudentInCourses` happens to be idempotent, which is the only reason this isn't worse — the protection is accidental, not designed. Adding the webhook in §2.8 makes double-execution routine rather than hypothetical.
- **No amount verification**: the HMAC proves the `order_id|payment_id` pair is genuine, but the handler never fetches the payment from Razorpay to confirm the **captured amount** matches `order.amount`, or that its status is `captured`.
- **No user binding**: the handler never checks `req.student._id` against `order.user_id`. It enrolls `order.user_id`, so it isn't a privilege escalation, but any authenticated student can drive the fulfilment of another student's order.

**Fix**: guard on `order.status !== "paid"` before doing work, fetch and compare the payment amount/status via the Razorpay API, and assert the order belongs to the caller.

**Confirmed empirically, 2026-09-12**: the e2e Playwright suite's fixture setup (`LearnStream/e2e/global-setup.ts`) enrolls its test student by computing `HMAC-SHA256(order_id|payment_id, RAZORPAY_KEY_SECRET)` for a **synthetic, never-real** `payment_id` and posting straight to `/payment/verify` — no Razorpay checkout UI, no real payment, ever. It works every time. This doesn't lower the severity assessed above — computing that HMAC requires `RAZORPAY_KEY_SECRET`, which only the server holds, so this isn't a bypass an outside attacker can reproduce without that secret. What it does confirm concretely is the underlying gap itself: the code path genuinely never asks Razorpay whether the payment happened, it only checks that whoever called `/payment/verify` could produce the right hash. That matters more than it might otherwise because `RAZORPAY_KEY_SECRET` is exactly the kind of value §1.4 already found being logged in plaintext — a leak there, combined with this gap, is a real path to free enrollment, not just a theoretical one.


**Resolved 2026-09-12.** `verifyPayment` now fetches the payment from Razorpay and rejects it unless the status is `captured`, the amount equals `order.amount`, and `payment.order_id` matches; it asserts the order belongs to `req.student._id`; and it compares signatures in constant time. Idempotency is no longer accidental — both this and the webhook go through `utils/fulfilment.js`, which claims the order with an atomic conditional update so only one caller enrolls.

The e2e fixture's forged-signature enrollment died with this change, as predicted: forging worked *only* because nothing ever contacted Razorpay. `global-setup.ts` now seeds enrollment by POSTing a correctly-signed `payment.captured` webhook, so the fixture exercises the production fulfilment path instead of bypassing it.

### 2.10 Uploads: original filenames, no size limit, publicly served [READ] / [RISK]

Three compounding issues in `middleware/multer.middleware.js` and `app.js`:

- **`filename: cb(null, file.originalname)`** (`multer.middleware.js:7-10`) — the raw client-supplied filename is used verbatim as the on-disk name. Two users uploading `assignment.pdf` **overwrite each other** in `public/temp`, and concurrent requests can upload the wrong file to Cloudinary. [READ] Multer's own documentation warns that `originalname` is attacker-controlled and callers are responsible for sanitising it; path-traversal via crafted names is a **[RISK]** here, not verified.
- **No `limits`** (`multer.middleware.js:28-31`) — `multer({ storage, fileFilter })` sets no `fileSize` cap, on endpoints that accept video. Any authenticated user can fill the server disk. [READ]
- **`app.use(express.static("public"))`** (`app.js:30`) combined with multer writing to `./public/temp` means every in-flight upload is **publicly served at `/temp/<originalname>`, unauthenticated** — and because the name is the unmodified original, it is guessable. `uploadOnCloudinary` unlinks after upload so the window is normally short, but any handler that throws *after* multer writes and *before* the Cloudinary call leaves the file served indefinitely. [RISK]

**Fix**: randomised filenames (`crypto.randomUUID()`), `limits: { fileSize }` per route, and move the temp directory **outside** the statically-served folder.

### 2.11 The token refresh endpoint masks 401s as 400s, defeating the frontend interceptor [READ]

`auth.routes.js:83-85` wraps the entire handler in a `try/catch` that rethrows **everything** as `ApiError(400, …)`. An expired or mismatched refresh token — a genuine 401 — reaches the client as a **400**.

Module 3 shipped an axios response interceptor that retries once on **401** (`frontend/src/api/axios.js`). Because this endpoint can never return 401, the interceptor's failure path never triggers correctly, and a legitimately-expired session is indistinguishable from a malformed request.

**Also in the same handler**: `generateStudentTokens`/`generateTeacherTokens` already fetch the user, set `refreshToken`, and `save()` internally — then lines 57-58 set `refreshToken` again on a **stale** document (read at line 33, before that save) and save a second time. Two writes per refresh, the second from a stale snapshot that can clobber concurrent field updates.

---

## 3. P2 — Medium

### 3.1 `getCourseById` returns the number `200` instead of the course [READ]

`Course.controller.js:132-134`:

```js
return res.status(200).json(200, new ApiResponse(200, course, "course sent succesfully"));
```

`res.json()` takes **one** argument. The second is ignored, so the response body is the literal JSON `200` — the course object is never sent. `GET /courses/:courseId` (`courses.routes.js:43`) is therefore non-functional for every consumer.

### 3.2 Course titles are globally unique across all teachers [READ]

`Course.controller.js:21-24` rejects creation if **any** course anywhere has the same title. Two different teachers cannot both publish "Introduction to Python". Should be scoped per author, or not enforced at all.

### 3.3 Registration rejects duplicate *names* [READ]

`UserStudent.controller.js:62-64` and `UserTeacher.controller.js:46-48`:

```js
const existedUser = await UserStudent.findOne({ $or: [{ email }, { name }] });
```

The second person named "John" cannot register — with the message "User with email or username already exists". `name` has no uniqueness requirement in the schema and shouldn't be treated as an identifier.

### 3.4 Required-field validation passes when fields are absent [READ]

`UserStudent.controller.js:55-57`, `UserTeacher.controller.js:39-42`:

```js
if ([name, email, password].some((field) => field?.trim() === "")) { throw new ApiError(400, ...) }
```

For a **missing** field, `field?.trim()` is `undefined`, which `!== ""` — the guard passes. Execution continues to `Model.create()`, which throws a Mongoose `ValidationError` → surfaced as an opaque 500 (§2.1), instead of a clean 400 naming the missing field.

### 3.5 Empty cart returns 404 [READ]

`cart.controller.js:16-18` throws `404 "Cart not found"` when a student simply hasn't added anything yet — a cart document is only created on first add (`:39-43`). Same in `inCart` (`:91-93`). A new student's cart page is an error case rather than an empty state.

**Also**: `addToCart` (`:25-55`) never checks that the course exists, nor that the student is **already enrolled** — so a purchased course can be re-added and re-purchased.

### 3.6 `createAssignment`'s duplicate-title check queries a non-existent field [READ]

`Assignment.controller.js:69`:

```js
const existingAssignment = await Assignments.findOne({ course_id, module_id: moduleId, title });
```

`assignmentSchema` (`courses.js:98-165`) has **no `course_id` field** — only `module_id`. The same handler also *writes* `course_id` at `:89`, where strict mode silently drops it. Since no stored document has that field, the query never matches and the duplicate check never fires.

### 3.7 No enrollment checks on progress and lecture endpoints [READ]

- `markLectureCompleted` (`Lecture.controller.js:192-223`) — no check that the student is enrolled, nor that `lectureId` belongs to `courseId`. Any student can mark arbitrary lectures of unpurchased courses complete.
- `markAssignmentCompleted` (`Assignment.controller.js:250-285`) — same, and it sets `completedAssignmentCount`, a field **not present** in `ProgressSchema` (`Progress.js:24-45`), so it is silently dropped.
- `getAllLectures` / `getLectureById` (`lectures.routes.js:16,19`) use `verifyJWTCombined` — *any* logged-in user, with no enrollment check. `getLectureById` returns the full lecture including `videourl`. This is §1.1 again, one tier down because it at least requires an account.

### 3.8 Progress has two sources of truth and no uniqueness constraint [READ]

`completedLectureCount` is maintained alongside `completedLectures[]` (`Lecture.controller.js:204,216`) and the two can drift; `CourseProgress` reads the counter for the percentage (`Course.controller.js:261`) but `.length` for the displayed count (`:264`). `ProgressSchema` also has **no compound unique index** on `{studentId, courseId}`, and `markLectureCompleted` does `findOne`-then-`create` rather than an upsert — concurrent requests can create duplicate Progress documents.

### 3.9 N+1 query on category listing [READ]

`getCoursesByCategory` (`Course.controller.js:145-153`) loops over results issuing a separate `UserTeacher.findById` per course, instead of `.populate('author','name')` — which the neighbouring `getCourseById` (`:125`) already does correctly.

### 3.10 No pagination anywhere [READ]

`getAllCourses` (`Course.controller.js:161`) and `getCoursesByCategory` (`:144`) return unbounded `find()` results. `mongoose-aggregate-paginate-v2` is a declared dependency and is **imported** at `courses.js:2` but **never registered as a plugin** — the intent existed and was never finished.

### 3.11 Inconsistent response envelopes [READ]

`markLectureCompleted` and `getLecturesCompleted` (`Lecture.controller.js:226-251`) return **raw objects** (`{success, completedLectures}`) while every other endpoint returns `ApiResponse` (`{statusCode, data, message, success}`). The frontend has already had to special-case this: `LectureAssig.jsx:29` reads `response.data.completedLectures` where everything else reads `response.data.data`.

### 3.12 Cookie flags are hardcoded for HTTPS [READ] / [RISK]

`options = { httpOnly: true, secure: true, sameSite: "none", … }` is hardcoded in three places (`UserStudent.controller.js:13-18`, `UserTeacher.controller.js:8-13`, `auth.routes.js:60-65`) with `NODE_ENV=development` in `.env`.

`secure: true` requires a secure context. Chrome treats `http://localhost` as trustworthy so this often works locally, which is why it hasn't been decisively diagnosed — but it is fragile across browsers and breaks outright on any non-HTTPS non-localhost deployment. `UI_AUDIT.md` §2.6 already flagged refresh as depending on "a cookie that may be blocked"; this is the backend half of that symptom. Should derive from `NODE_ENV`, in one shared place.

### 3.13 `course.assignments` is never written, so assignment progress is always zero

Found 2026-09-12 while extracting the service layer (B5.5). `createAssignment`
pushes the new assignment's id into its **module** (`Modules.findByIdAndUpdate(...
$push: { assignments } )`) and never into the course. Nothing else in `src/` or
`scripts/` writes `course.assignments` either — confirmed by grep.

The array is declared on the course schema and read in two places:

- **`CourseProgress`** computes `totalAssignments = course.assignments.length`,
  so it reports **0 assignments for every course**, always, no matter how many
  exist. The lecture half of the same response is correct, because
  `addLecture` *does* push to both the module and the course.
- **`deleteAssignment`** and the `deleteModule` cascade filter the array. Both
  are silent no-ops on a permanently empty array — harmless, but they read as
  if they are maintaining something.

Not fixed: the correction changes the progress figures students see, so it
belongs in its own change rather than inside a mechanical refactor. Either make
`createAssignment` push to the course the way `addLecture` does (and backfill
existing assignments), or derive `totalAssignments` from the modules and drop
the field. Deriving is the better shape — it cannot drift.

### 3.14 The frontend calls an assignment-submissions route that does not exist

Found 2026-09-12. The frontend requests
`/courses/:courseId/assignments/:assignmentId/submissions`, but no backend route
defines it — the teacher-facing submissions handler is mounted at
`/courses/:courseId/assignment/:assignmentId` (singular, no suffix). Every call
on that path 404s. Either the frontend is pointing at a route that was renamed,
or the endpoint was never built. Needs a decision, not just a path edit.

Related: `freePreview` is stored on the lecture schema, set by `updateLecture`
and selected in several queries, but is **read nowhere in the frontend** —
there is no free-preview flow. That is why B5.4 could put `getLectureById`
behind `requireEnrollment` without breaking anything, but it does mean the
field is now inert.

### 3.15 One orphaned id in a course's `enrolledStudents`

Found 2026-09-12 while verifying the B5.6 user migration. Course
`"Node and Express Tutorial"` holds an `enrolledStudents` id
(`684e91c5412da09f3e620561`) that matches no user. Checked against both source
collections **before** the migration: it existed in neither, so this predates
the merge and was not caused by it — a student account was deleted at some
point without pulling its id out of the courses it was enrolled in.

The same shape as the §2.3 orphans B3 cleaned up, in a place that pass did not
look. Harmless today (`populate` skips it, the enrollment check is an equality
test that simply never matches) but it inflates any count taken from the array
length. One `$pull` fixes it; worth folding into a general referential-integrity
sweep rather than patching alone, since nothing prevents the next one.

---

## 4. P3 — Hygiene, dead code, consistency

### 4.1 Dead and broken code

- **`Course.controller.js:294-361`** — `addToCart`, `removeFromCart`, `getCart` reference `Cart`, whose import is **commented out** at `:11`. They are also never exported and never routed. `removeFromCart` (`:321`) is declared `async () => {}` with **no `req`/`res` parameters** yet uses `req` in its body. They query `{user_id}` / `$push: {courses}`, which don't match the actual cart schema (`user` / `items`). ~68 lines of code that would throw `ReferenceError` if reachable. The real implementations live in `cart.controller.js`. **Delete.**
- **`Modules.controller.js:35-98`** — `addLectureToModule` and `addAssignmentToModule` are exported but **never routed** (confirmed by grep: the names appear only in their own file). Both are also broken: each omits the `module_id` that its target schema marks `required: true` (`courses.js:92,102`), so both would throw `ValidationError` on every call, and **neither calls `assertCourseOwnership`** while every other mutation in that file does. They are near-duplicates of the working, correctly-guarded `addLecture` (`Lecture.controller.js:14-81`) and `createAssignment`. **Delete** — they are a live trap for whoever wires a route to them next.
- **`Assignment.controller.js:13-45`** — 33 lines of commented-out `createAssignment`, with `import fs from "fs/promises"` stranded at `:46` in the middle of the file.
- **Unused imports**: `maxHeaderSize` from `http` (`UserStudent.controller.js:7`); `verifyJWTCombined` in `auth.routes.js:2`; `upload`/`verifyJWTStudent`/`verifyJWTCombined` in `modules.routes.js`; `upload` in `students.routes.js`.
- **Leftover debug middleware shipped in a route**: `assignments.routes.js:32-37` inlines a middleware that does `console.log(req.student._id); console.log('hello');`.

### 4.2 Unused dependencies

- **`mongodb`** — zero references in `src/`; mongoose bundles its own driver.
- **`validator`** — referenced only inside commented-out code (`userteachermodel.js:79,82`).
- **`mongoose-aggregate-paginate-v2`** — imported but never applied (§3.10).
- **`fs-extra`** — used once (`Lecture.controller.js:74`) for a `fs.remove` that is **redundant**: `uploadOnCloudinary` already `unlinkSync`s the file at `cloudinary.js:22`.
- **`nodemon` is in `dependencies`, not `devDependencies`**, and `"start": "nodemon src/index.js"` is the only script — there is no production start command.

### 4.3 Logging noise and PII

Beyond the credential logging in §1.4: `app.js:32-35` logs every request path/method; `authteacher.middleware.js:16,19,25` logs the decoded token and the **entire user document** on every teacher request; `console.log` of full documents in `Course.controller.js:74,87,112,143,154,198-200`, `Modules.controller.js:141,149`, `Lecture.controller.js:66-67`, `Assignment.controller.js:128,139,164,222,252`, `Payment.controller.js:51`. Registration logs the user's email (`UserStudent.controller.js:51`, `UserTeacher.controller.js:34`).

### 4.4 Copy-paste errors in messages

- `Assignment.controller.js:192,195` — both throw **"Lecture Not Found"** inside the *assignment* controller.
- `Lecture.controller.js:136-138` — throws "Lecture Not Found" when the **module** is missing.
- `Course.controller.js:209,212` — the two messages are **swapped**: a missing *student* throws "course id not found" and a missing *course* throws "student not found".
- Registration returns **HTTP 200** with the message "User Logged in Succesfully" (`UserStudent.controller.js:108-119`, `UserTeacher.controller.js:67-76`) — wrong status for a create, wrong verb, and "Succesfully" is misspelled throughout the codebase.

### 4.5 Model-layer defects

- **`Progress.js:21`** — `completedAt: { type: Date, default: Date.now() }`. The parentheses **invoke** `Date.now` at schema-definition time, so every completed *assignment* is stamped with the **server's boot time**, not the completion time. The lecture schema immediately above (`:8-11`) correctly passes `Date.now` without parentheses — the two are three lines apart.
- **`Orders.js:5`** — `ref: "Course"`, but the registered model name is **`"Courses"`** (`courses.js:183`). Any `.populate("course_ids")` on an Order throws `MissingSchemaError`. Latent — nothing populates it today.
- **Circular import** — `Modules.js:2` imports from `courses.js`, and `courses.js:4` imports from `Modules.js`. Tolerated today only because both are used inside deferred hook callbacks (which never fire anyway, §2.3).
- **`email` has no `lowercase: true`/`trim: true`** on either user model, so `A@b.com` and `a@b.com` are distinct accounts despite the unique index.
- **A student and a teacher can share an email** — separate collections, separate indexes, no cross-check.
- **No password length/strength constraint** at the schema level.

### 4.6 Boot-time fragility

- **`app.js:14`** — `process.env.CORS_ORIGIN.split(",")` throws `TypeError` at import if `CORS_ORIGIN` is unset. No default, no validation.
- **`Payment.controller.js:13-16`** — `new Razorpay({...})` runs at **module load**. Missing Razorpay env vars take down the whole server at import, not at first payment.
- **`index.js:14`** — listens on `process.env.PORT || 8000` but logs `${process.env.PORT}`, printing `undefined` when falling back.
- **`dotenv.config()` is called three times** (`app.js:2`, `index.js:6`, `cloudinary.js:4`) plus once more in `UserStudent.controller.js:10`. It works only because `app.js`'s call happens first via import hoisting.
- **`.env` formatting** — `RAZORPAY_KEY_ID =` / `RAZORPAY_KEY_SECRET =` have spaces around `=` unlike every other key. dotenv tolerates it (already confirmed in `UI_AUDIT.md` §10.2); it's an inconsistency, not a bug.

### 4.7 Missing baseline protections

No `helmet` (security headers), no rate limiting on `/login` / `/signup` / `/refresh-Token` (unlimited credential stuffing), no request-id/correlation logging, no graceful shutdown, no health-check endpoint, and **no tests of any kind** (`"test": "echo \"Error: no test specified\" && exit 1"`).

### 4.8 Secrets hygiene — one thing to verify

`backend/.env` is correctly **untracked and gitignored** — good, and confirmed (2026-09-12) it has **never** been committed (`git log --diff-filter=A` on the file returns nothing). `LearnStream/frontend/.env` does appear in git history (added `c3e9f1a`, removed `14480ac`), but its full history is **0 lines ever added** (`git log -p` on the file shows an empty blob at every revision — it was tracked-but-empty, then deleted). **Resolved**: no secrets of any kind were ever committed to this repo's history; no history rewrite needed.

**Confirmed, Cloudinary public-read (2026-09-12)**: `GET /v1_1/{cloud}/resources/image` via the Admin API shows `type: "upload"` (Cloudinary's standard public-delivery type, not `authenticated`/`private`) on every sampled asset — matches §1.1's live download proof. **Not determinable**: whether any leaked `public_id`s have actually been scraped/accessed by a third party — Cloudinary's Admin API on this plan doesn't expose asset-level access/download logs, so this can't be checked after the fact. Treat every already-leaked id as compromised going forward rather than trying to confirm actual misuse.

---

## 5. Structural problems → what restructuring should fix

The bug list above is not a collection of unrelated mistakes. Six structural properties generate them repeatedly.

### 5.1 No error-handling layer
Nothing owns the translation from thrown error to HTTP response, so Express's default handler does it — badly (§2.1). This single gap also hides §2.2 (wrong statuses go unnoticed because *every* error looks the same to the client) and blocks the frontend from ever showing a real message.

### 5.2 Business logic lives in controllers
Controllers parse the request, enforce authorization, talk to Cloudinary, write several collections, and format the response. There is no service layer. Consequences: ownership checks are applied ad hoc and get **forgotten** (§1.2, §1.1); multi-collection writes have no transaction boundary; and identical operations get implemented twice in divergent ways (`addLecture` vs `addLectureToModule`, §4.1).

### 5.3 Authorization is per-handler, not declarative
`assertCourseOwnership` must be remembered and called manually inside each handler. It is called in 6 places and **missing in at least 4 where it is needed** (§1.2, §1.1, and both dead handlers). Enrollment checks don't exist at all (§3.7). Authorization that depends on a developer remembering will keep failing.

### 5.4 Two user models, and role isn't in the token
`userstudentmodel.js` and `userteachermodel.js` are ~90% identical (same fields, same pre-save hook, same three methods). Neither JWT carries a **`role` claim** — both are signed with the same `ACCESS_TOKEN_SECRET` with payload `{_id, email, name}`. Role is inferred purely from *which collection contains that `_id`*, which is why `verifyJWTCombined` (`authcombined.middleware.js:9-10`) has to assign the **same header value** to both `teacherToken` and `studentToken` and try each collection in turn. Every auth path is more complex than it needs to be because of this one modelling decision.

### 5.5 Duplicated and abandoned implementations
Two cart implementations (one dead and broken, §4.1), two lecture-creation paths, two assignment-creation paths, an unrouted-but-exported surface, and an endpoint whose helper was never imported after a refactor (§1.3). Nothing flags a controller that no route references.

### 5.6 No validation, no config, no tests
Request shapes are checked with hand-rolled truthiness tests that don't work (§3.4). Env vars are read directly off `process.env` at import with no validation (§4.6). There are zero tests, so §1.3, §2.3, §3.1 and §4.5 could all sit in `main` indefinitely — each is a one-line assertion away from being caught.

---

## 6. Target structure

### 6.1 Proposed layout

```
backend/src/
  config/
    env.js               # validate + export typed config at boot; fail fast, one place
    db.js                # (moved from db/index.js)
    cloudinary.js        # SDK config only
  models/
    user.model.js        # ONE User model + role discriminator (replaces the two)
    course.model.js      # Courses only
    lecture.model.js     # split out of courses.js
    assignment.model.js  # split out of courses.js
    module.model.js
    progress.model.js
    cart.model.js
    order.model.js
  services/              # NEW — all business logic, no req/res
    course.service.js
    lecture.service.js
    assignment.service.js
    enrollment.service.js
    payment.service.js
    media.service.js     # Cloudinary upload/delete w/ resource_type
  controllers/           # thin: parse → call service → respond
  middleware/
    auth.js              # ONE middleware, role-aware (replaces the three)
    requireRole.js       # requireRole('teacher')
    requireCourseOwner.js# declarative, replaces manual assertCourseOwnership
    requireEnrollment.js # NEW — closes §1.1/§3.7
    upload.js            # multer w/ random names + size limits
    validate.js          # schema validation (zod)
    errorHandler.js      # NEW — the single most important addition
  routes/
  utils/
  validators/            # NEW — request schemas per endpoint
```

### 6.2 The four changes that remove whole bug classes

1. **`errorHandler.js`** — one middleware, registered last in `app.js`. Serializes `ApiError` to the `ApiResponse` envelope, maps Mongoose/Multer errors to 400, includes `stack` only outside production. Kills §2.1 and makes §2.2 visible instead of silent.
2. **Unified `User` model + `role` in the JWT** — collapses two models into one with a discriminator, puts `role` in the token payload, and reduces three auth middlewares to one. Kills §5.4 and simplifies §1.2's fix.
3. **Declarative route guards** — `requireCourseOwner` and `requireEnrollment` as middleware composed at the route, so authorization is visible in the route table and cannot be forgotten inside a handler body. Kills the §5.3 class, including §1.1 and §1.2.
4. **Service layer** — controllers stop owning multi-collection writes; cascades (§2.3) and payment fulfilment (§2.8/§2.9) become explicit, testable, transaction-capable functions.

### 6.3 Explicitly *not* recommended

- **Do not reintroduce Mongoose `pre` hooks for cascades.** Silent non-firing hooks caused §2.3. Explicit service functions, please.
- **Do not switch to TypeScript as part of this.** Valuable, but it would gate every fix below on a full migration. Revisit after B1–B3 land.
- **Do not upgrade Mongoose/Express versions in the same pass** as behavioural fixes — separate, verifiable steps.

### 6.4 Two hypotheses tested and rejected

Recorded so nobody re-investigates them:

- **`student.Courses.includes(course_id.toString())`** (`utils/enrollment.js:22`) was suspected of always returning `false` (ObjectId vs string). **Tested — it works.** Mongoose overrides `includes`/`indexOf` on ObjectId arrays to cast the argument; `includes(string)`, `includes(ObjectId)` and `some(x => x.equals(id))` all returned `true`. **Not a bug.**
- **`ApiError`'s status code was suspected of being ignored** by Express's default handler. **Tested — it is respected** for correctly-constructed errors (a 404 came back as HTTP 404). The real problems are the HTML body + stack leak, and the 16 call sites that never pass a code at all (§2.2).

---

## 7. Delivery plan

Backend modules are numbered **B1–B6** so they don't collide with the existing frontend Module 0–9 sequence in `~/.claude/plans/` and `REQUIREMENTS.md`.

### Module B0 — Verify production exposure (do first, before anything else)
`.env` shows this backend is deployed at `learnstream.onrender.com`, actual API host `whathecode-learnstream.onrender.com`.
- [x] Confirm whether deployed prod serves `GET /courses/:id/modules` unauthenticated (§1.1) — **yes, confirmed 2026-09-11**. Live incident, not a backlog item.
- [x] Local dev `ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET` rotated 2026-09-12 (were the tutorial-default `chai-aur-code`/`chai-aur-backend`).
- [ ] **Still open — needs your Render dashboard access, cannot be done from here**: rotate `ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET` on the **production** service. §1.4 means tokens have been written to logs for the lifetime of the deployment; rotation invalidates anything already captured but also logs out every current user. New values generated and handed off 2026-09-11; confirm once applied so this can be checked off.
- [x] Cloudinary assets confirmed public-read (`type: "upload"` via Admin API, 2026-09-12) — matches §1.1. Scrape history not determinable (no access logs on this plan) — see §4.8.
- [x] Historical `frontend/.env` confirmed benign (2026-09-12) — it was tracked-but-empty in git history, then deleted; zero secrets ever committed anywhere in this repo. See §4.8.

### Module B1 — P0 containment
- [x] Auth + enrollment guard on `getCourseModules`; stop returning `public_id` to non-entitled callers (§1.1) — 2026-09-12. `modules.routes.js`'s `.get('/:course_id/modules')` now requires `verifyJWTCombined`; the handler strips `public_id` from every lecture/assignment unless the caller is the owning teacher or an enrolled student. Re-verified live against the exact course id from the original finding (`678bf0eb072334a2221207fa`): the unauthenticated request now returns **401** instead of 200.
- [ ] Signed/expiring Cloudinary URLs for lecture + assignment media (§1.1) — the only fix that helps against already-leaked ids. Not done — deferred, tracked separately since it's independent of the auth gate above.
- [x] `assertCourseOwnership` on `getStudentsAndUploadedAssignments` and `getEnrolledStudents` (§1.2) — 2026-09-12. `getStudentsAndUploadedAssignments` now resolves the assignment's real course via its `module_id` (not the attacker-controlled `courseId` route param) before checking ownership. `getEnrolledStudents` checks ownership against the resolved course directly.
- [x] Delete all four credential `console.log`s (§1.4) — 2026-09-12. Removed from `UserStudent.controller.js` (register + login), `UserTeacher.controller.js` (login), `auth.routes.js` (refresh), and `authstudent.middleware.js` (every authenticated request).
- [x] Fix logout to actually clear `refreshToken` (§1.5) — 2026-09-12. Both `UserStudent.controller.js` and `UserTeacher.controller.js` now use `$unset: { refreshToken: 1 }` instead of the no-op `$set: { refreshToken: undefined }`.
- [x] Fix or delete `POST /courses/enroll` (§1.3) — 2026-09-12. Deleted (route, handler, and export) per the "prefer deleting" guidance in §1.3/§5.5 — confirmed no frontend caller and no other backend caller before removal; enrollment is exclusively payment-driven now (`Payment.controller.js`'s correctly-imported `enrollStudentInCourses` call is untouched).

**Verification**: e2e suite re-run after these fixes — 12 passed, same 3 pre-existing failures as before (masked-401 in §2.11, lecture double-fire — both unrelated to B1, already tracked under B2/Module 5). No regressions. Full §1.1 chain / cross-teacher / post-logout-refresh manual re-verification against production still pending (needs the same live-course check repeated once B0's prod secret rotation lands).

### Module B2 — Error handling & contracts
- [x] Add `errorHandler.js` and register it last in `app.js` (§2.1) — 2026-09-12. Added `middleware/errorHandler.middleware.js`: serializes any error to the standard `{statusCode, data, message, success, errors}` envelope, maps Mongoose `ValidationError`/`CastError` and `MulterError` to 400, includes `stack` only when `NODE_ENV !== "production"`. Registered last in `app.js`. Live-verified: an unauthenticated request now returns clean JSON (`{"statusCode":401,...}`) instead of HTML with a filesystem stack trace; a malformed ObjectId now returns a JSON 400 with the real Mongoose message instead of a 500 HTML page.
- [x] Fix all 16 (15 found in the current tree) statusless `ApiError` calls (§2.2); make the constructor reject non-numeric status codes — 2026-09-12. Fixed 10 in `Course.controller.js` and 5 in `Assignment.controller.js`, each given a status code matching its actual semantics (401 auth, 404 not-found, 400 validation, 409 duplicate, 500 upstream failure). `ApiError`'s constructor now throws a `TypeError` if `statusCode` isn't an integer, so this class of bug can't silently reappear. Verified zero statusless calls remain (`grep -rn "new ApiError(" src/` audited by hand).
- [x] **Fix `auth.routes.js`'s `refreshAccessToken` masking every failure as 400 instead of the real status (§2.11)** — 2026-09-12. Removed the catch-all `try/catch` that rethrew everything as `ApiError(400, ...)`; only `jwt.verify`'s own throw is now caught (and re-thrown as a real 401), every other `ApiError` propagates with its real status through `asyncHandler` → the new error handler. Also removed the redundant second `user.refreshToken = ...; await user.save(...)` — `generateStudentTokens`/`generateTeacherTokens` already persist it, and the removed write was operating on a stale pre-refresh document. **Regression test flipped green as predicted, no test changes needed**: `auth-token-refresh.spec.ts` now 5/5 passing (was 4/5).
- [x] Fix `getCourseById`'s `res.json(200, …)` (§3.1) — 2026-09-12. Was silently sending the literal JSON `200` instead of the course; now `res.status(200).json(new ApiResponse(...))`.
- [x] Normalise `markLectureCompleted`/`getLecturesCompleted` onto `ApiResponse` (§3.11) — 2026-09-12. `markLectureCompleted` was already normalised (pre-existing); `getLecturesCompleted` was still returning raw `{success, completedLectures}` — now returns the standard envelope. **Coordinated with the frontend**: `LectureAssig.jsx:29` updated from `response.data.completedLectures` to `response.data.data` in the same commit.
- [x] Unblock the frontend: with B2 done, `err.response.data.message` finally carries real text everywhere — verified via the two manual curl checks above (real Mongoose/auth messages now reach the body instead of `undefined`).

**Verification**: e2e suite re-run clean — 13 passed (up from 12), same 2 pre-existing lecture-completion double-fire failures (unrelated to B2, tracked under Module 5). All edited files pass `node --check`. Manual curl checks against the live dev backend confirm JSON error bodies with correct status codes for both an auth failure and a Mongoose `CastError`.

### Module B3 — Data integrity
- [x] Replace the dead cascade hooks with explicit service-layer deletes; `$pull` from parent arrays (§2.3) — 2026-09-12. Removed both `pre('remove')` hooks (`courses.js`'s courseSchema hook and `Modules.js`'s moduleSchema hook) — they never fired under Mongoose 8 and, as a side effect of removing them, the `courses.js` ↔ `Modules.js` circular import (§4.5) is also gone. `deleteModule` (`Modules.controller.js`) now explicitly cascade-deletes every lecture/assignment under the module (DB + Cloudinary, via `Promise.allSettled`) and `$pull`s the module's id — and its lectures'/assignments' ids — out of the parent course's arrays. No course-delete endpoint exists anywhere in the codebase, so the courseSchema hook had nothing to protect; noted in the model file that a future delete-course feature needs its own explicit cascade, not a schema hook.
- [x] One-off cleanup migration for already-orphaned lectures/assignments and dangling `modules[]` ids — 2026-09-12. Added `backend/scripts/cleanup-orphaned-module-content.js` (dry-run by default, `--apply` to actually delete/clean). Dry run against the real dev database found real orphans from the historical bug: 13 orphaned lectures, 5 orphaned assignments, 3 courses with dangling `modules[]` ids. **Applied** (with the user's go-ahead): all 13 orphaned lectures and 5 orphaned assignments deleted (DB + their Cloudinary video/PDF assets); 3 courses' dangling `modules[]` ids cleaned, plus 1 course's `lectures[]` array that only went dangling once the orphaned lecture docs it pointed at were deleted in this same pass — the script caught it in one run. Re-run confirms zero remaining orphans/dangling ids. Backend confirmed healthy afterward.
- [x] `resource_type` on Cloudinary deletes (§2.4); `Promise.allSettled` in `deleteAssignment` (§2.5) — 2026-09-12. Added `resource_type` (lectures) / `resourceTypes[]` (assignments, parallel to `public_id[]`) to the schema, populated at upload time; `deleteMediaFromCloudinary` now takes a `resourceType` param and checks the `{result}` response instead of ignoring it. `deleteAssignment`'s fire-and-forget `forEach(async ...)` (an unhandled-rejection crash risk on Node 15+) replaced with `Promise.allSettled` + logged failures — same pattern used in the new `deleteModule` cascade.
- [x] Server-side deadline + persist `submittedOnTime`; validate the assignment exists (§2.6) — 2026-09-12. `submitAssignment` now reads the assignment's own stored `deadline` instead of trusting `req.body.deadline`, fetches the assignment first and 404s if it doesn't exist, and `submittedOnTime` is now an actual field on the `uploadedAssignments` subschema (it was previously silently dropped by Mongoose strict mode — lateness was never persisted regardless of the client-trust bug).
- [x] Fix `Progress.js:21`'s `Date.now()` and add the `{studentId, courseId}` unique index (§4.5, §3.8) — 2026-09-12. Fixed the schema-definition-time invocation and added the compound unique index. **Also fixed `markLectureCompleted`/`markAssignmentCompleted`'s findOne-then-create race**, which the new unique index would otherwise turn into a duplicate-key 500 under concurrent requests (the checkbox/label double-fire bug — still open, tracked under Module 5 — makes this a real, already-observed scenario, not a hypothetical): both now do an atomic get-or-create upsert followed by an atomic conditional `$push`. Live-verified via the e2e suite's rapid-double-click regression test: 4 concurrent completion POSTs for the same lecture, all still 200, zero 500s.
- [x] Fix `Orders.js`'s `ref: "Course"` (§4.5) — 2026-09-12. Now `ref: "Courses"`, matching the registered model name.

**Verification**: e2e suite re-run clean — 13 passed, same 2 pre-existing lecture-completion double-fire failures (unrelated, tracked under Module 5). All edited files pass `node --check`.

### Module B4 — Payments
- [x] `Math.round` on paise; migrate prices to integer paise (§2.7). Done 2026-09-12. Prices are integer paise end to end; rupees survive only at the UI's input and display edges, both routed through `frontend/src/utils/money.js`. The schema validator rejects a fractional price outright, so the bug class is closed rather than the single instance. Applied to the database with `scripts/migrate-prices-to-paise.js` (13/13 courses, none fractional, marker recorded so a re-run can't multiply by 100 twice).
- [x] **Razorpay webhook as the authoritative fulfilment path (§2.8).** Done 2026-09-12. `POST /payment/webhook`, signature-verified against `RAZORPAY_WEBHOOK_SECRET`, sharing one idempotent `fulfilOrder()` with `verifyPayment`. **Still needs a real secret in `backend/.env` and a webhook registered in the Razorpay dashboard — until then the endpoint refuses every call with a 500, by design.**
- [x] Idempotency guard, amount verification, order-ownership check in `verifyPayment` (§2.9). Done 2026-09-12. It now fetches the payment from Razorpay and checks captured status, amount, and order linkage, asserts the order belongs to `req.student._id`, and compares signatures in constant time.
- [x] **Backfill legacy `course_id` orders and reconcile.** Done 2026-09-12. 37 of 64 orders predated the multi-course cart and stored a singular `course_id` the schema doesn't declare, so Mongoose reported `course_ids: []` and fulfilment enrolled nobody while stamping the order paid. `fulfilOrder` now refuses to mark such an order fulfilled. `scripts/migrate-legacy-order-course-ids.js` recovered all 37 — 31 from the local field, and the remaining 6 from the Razorpay order's `notes`, which is authoritative provider data rather than a guess. `scripts/reset-bogus-fulfilment-markers.js` cleared the markers an earlier reconcile pass wrote without enrolling anyone. Final state: 0 lost, 0 drifted, 0 missing `course_ids`.

### Module B5 — Restructure (§6)
- [x] `config/env.js` with fail-fast validation (§4.6) — 2026-09-12. One module owns dotenv and validates all 14 variables at import; every other file imports `env` instead of touching `process.env` (zero `process.env` reads remain outside it). It reports **every** problem at once rather than the first — a fresh clone is now one pass, not one restart per missing variable; verified against an empty environment, which lists all 11 required entries. Added `.env.example` documenting each one.

  Fixed along the way: `app.js`'s `CORS_ORIGIN.split(",")` at module scope (a `TypeError` about `.split` of undefined, thrown from an import, which named neither the variable nor the cause); `index.js` logging `process.env.PORT` and printing `undefined` whenever the `|| 8000` fallback was used; and the four separate `dotenv.config()` calls that worked only because import hoisting happened to run `app.js`'s first — an ordering nothing enforced.

  Two deliberate non-changes. **`RAZORPAY_WEBHOOK_SECRET` is optional**, not required: `backend/.env` does not have one, and B4 designed the webhook to refuse each call loudly while it is unset (§2.8). Promoting it to a required entry would stop the whole server booting over a feature not yet registered in the Razorpay dashboard — a far worse failure than the one it guards. Verified after the change that `POST /payment/webhook` still answers "Webhook is not configured". **The tutorial-default token secrets warn rather than throw** — B0's production rotation is still open, and refusing to boot would take production down for a rotation that is the operator's to schedule.

  Razorpay's client is still constructed at module load, which §4.6 flagged. That is no longer the hazard it was: both keys are required config entries, so a missing one now fails at boot naming the variable, instead of surfacing as a Razorpay constructor error from the middle of an import.

  `scripts/*.js` still call `dotenv.config()` themselves and were left alone on purpose. They are standalone operational tools, and routing them through `config/env.js` would make a cleanup script that needs only `MONGODB_URI` refuse to run without Razorpay keys.

**Verification**: e2e 13 passed / 2 failed — unchanged baseline. This also exercises the path where the environment arrives through `spawn`'s `env` rather than a `.env` file (`global-setup.ts:56`), which still works because dotenv does not overwrite already-set variables. Server boots clean and logs the real port; live smoke checks pass.
- [x] Unified `User` model + `role` claim; collapse three auth middlewares into one (§5.4) — 2026-09-12. One `User` model replaces `userstudentmodel.js` and `userteachermodel.js`; one `verifyAuth` + `requireRole` replaces `authstudent`, `authteacher` and `authcombined`; one `auth.controller.js` replaces the two near-identical auth controllers. Seven files deleted, `role` is now a field and a JWT claim, and the route table says which role each endpoint needs instead of that being implied by which middleware was imported.

  **A plain `role` field, not a Mongoose discriminator.** §6.2 suggested a discriminator, but that keeps deriving role from something implicit — `__t` rather than the collection name — which is the same shape of problem §5.4 describes. An explicit field is what the guards read and what the token carries, so there is one answer to "what is this user".

  **Migration** (`scripts/migrate-users-to-single-collection.js`, dry-run by default, marker-guarded): 83 → **81 users** (53 students, 28 teachers). `_id` values are preserved exactly — courses, orders, progress, carts and assignment submissions all reference users by `_id`, and generating new ones would have silently orphaned every one of them. Passwords are copied through the driver, not through Mongoose documents, because the pre-save hook would otherwise re-hash an already-hashed value and lock all 81 accounts out. Source collections are left in place, so the whole thing is reversible by dropping `users`.

  The two byte-identical cross-collection email collisions were resolved **by explicit decision, not heuristic**: the teacher side of `12@12.com` and `Prajyot@n.com` each owned zero courses and was deleted. The script re-verifies that shape and aborts if either teacher has since acquired a course. Four remaining addresses were normalised to lowercase, closing §4.5's "`A@b.com` and `a@b.com` are two accounts despite the unique index". **50 live sessions were invalidated**, which is unavoidable: old tokens carry no `role` claim and the middleware that used to infer one no longer exists.

  §4.5's "no password length constraint" is also closed, but **not** with schema `minlength` — bcrypt output is always 60 characters, so a minlength on the stored value passes for every password including a one-character one. The check runs in the pre-save hook against the raw value, and throws `ApiError(400)` rather than a bare `Error`, which the handler would have turned into a 500.

  **One real bug was introduced and caught by the suite**: `verifyAuth` initially read a cookie named `accessToken`, but the app sets `studentAccessToken`/`teacherAccessToken`. Header-bearing calls succeeded while cookie-bearing ones 401'd, so only *some* requests on a page failed — `course-detail-view.spec.ts` caught it as "got 401, 401, 200, 200". Exactly the intermittent-looking failure that is miserable to diagnose in production.

**Verification**: e2e 13 passed / 2 failed — back to the unchanged baseline after the cookie fix. `verify-ownership-guards.mjs` 16/16 against the unified model. Against the migrated database: 0 duplicate emails, 0 users without a role, 0 surviving refresh tokens, 0 non-lowercase emails, `{email: 1}` unique index present, and every foreign key resolves — 13 courses with 0 dangling authors, 64 orders with 0 dangling `user_id`, `populate('author')` returning a teacher. One dangling `enrolledStudents` id was found and confirmed to **predate** this work (§3.15). Live end-to-end: signup normalises `B5Check@Example.COM`, login with different casing succeeds, the JWT carries `role`, `/me` works, a student hits 403 on a teacher route, a wrong-role login 404s, a duplicate email across roles 409s, and a short password 400s. Test accounts removed afterwards; back to exactly 81 users.
- [x] Service layer extraction; thin controllers (§5.2) — 2026-09-12. `services/` now holds seven modules and no `req`/`res` reaches any of them. Three already existed as services in everything but location — `fulfilment.js` and `enrollment.js` moved out of `utils/`, and `cloudinary.js` split into `config/cloudinary.js` (credentials) and `services/media.service.js` (operations). Four are new: course, module, lecture, assignment. `utils/` is left holding `ApiError`, `ApiResponse` and `asyncHandler`, which is what it should always have been.

  The four course-content controllers went from **909 lines to 466**, against 727 lines of service. Each handler is now parse → call service → respond; the multi-collection writes §5.2 blamed for §1.1, §1.2 and §2.3 — the module cascade, lecture creation touching three collections, assignment creation and deletion — are single named functions callable without an HTTP request, which is what makes them testable in B6.

  Done in four commits with the e2e suite and `verify-ownership-guards.mjs` run between each, so a break would have been localised to one domain rather than found at the end of a 900-line diff.

  **Two deliberate behaviour changes**, called out rather than buried: `createCourse` returned **401** for a missing thumbnail file, which is a 400 — neither an authentication nor an authorization failure; and the `console.log`s of whole documents in these five files are gone (§4.3 wanted them removed anyway). Everything else is shape-for-shape identical.

  **Two things deliberately preserved**, each with a comment in the service saying so: `getCoursesByCategory`'s per-course author query (the §3.9 N+1) and `CourseProgress`'s always-zero `totalAssignments` (§3.13, found during this work). Fixing either inside a mechanical refactor would hide a behavioural change in a diff nobody would read that closely.

  `UserStudent.controller.js` and `UserTeacher.controller.js` were **left alone on purpose** — B5.6 collapses both into one user model and one auth middleware, so extracting services from them now is work that change would throw away.

**Verification**: e2e 13 passed / 2 failed — unchanged baseline at every one of the four steps. `verify-ownership-guards.mjs` 16/16. Live smoke checks against the real database confirm `getallCourses`, the category filter, `getCourseById` and `getTeacher` all still return their previous shapes.
- [x] `requireCourseOwner` / `requireEnrollment` route guards (§5.3) — 2026-09-12. Both are composed at the route, so authorization is visible in the route table instead of depending on a developer remembering a call inside a handler body. They share one resolver table (`middleware/courseContext.js`); handlers now work from `req.course`/`req.module`/`req.lecture`/`req.assignment` — the objects that were actually authorized — and `utils/verifyOwnership.js` is deleted, fully absorbed.

  **Both guards resolve the course by walking *up* from the resource the route addresses** (lecture → module → course) rather than reading a course id out of the URL. That direction is what closes the bug class rather than the instances: the id being authorized and the id being acted on become the same object, so no second param is left to disagree with. It is §1.2's lesson applied at the route.

  **Two real vulnerabilities were found and closed, each demonstrated before and after.** `e2e/scripts/verify-ownership-guards.mjs` boots the backend against an in-memory MongoDB and checks 16 assertions; it is checked in so neither can quietly return.

  1. **Cross-teacher content mutation.** `updateLecture`, `deleteLecture` and `deleteAssignment` asserted ownership of the course named in one URL segment, then mutated the lecture or assignment named in a different segment, with nothing checking the two were related. Any teacher who owned any course could pair their own `course_id` with another teacher's `lecture_id`. Against `7236227` the script shows Alice's `PUT` returning **200** and Bob's lecture title becoming `"OWNED BY ALICE"`; a `DELETE` would have taken the Cloudinary asset with it. Now 403, title untouched, while the owner's own edit still returns 200.
  2. **§1.1 still open through a sibling route.** B1 gated `getCourseModules`, but `getLectureById` returned the whole lecture document — `videourl` **and** `public_id` — to any authenticated caller. Against `7705074` a signed-in student who never bought the course gets **200 with both fields**. Now 403, while an enrolled student and the owning teacher still get 200 with `videourl`. `getAssignmentById` leaked `public_id` the same way; `submitAssignment`, `markLectureCompleted` and `markAssignmentCompleted` accepted writes from non-enrolled students.

  `requireEnrollment` is deliberately **not** applied to the endpoints returning only titles and durations (`getCourseModules`, `getModuleById`, `getAllLectures`). B1 chose to let non-entitled callers browse that metadata while stripping `public_id`, and gating it here would silently change what a course preview shows. The line drawn is B1's: the secret is the Cloudinary id and the media URL, not the syllabus.

  Two side findings, neither fixed here. The frontend calls `/courses/:courseId/assignments/:assignmentId/submissions`, which **no backend route defines** — a dead call that 404s. And `freePreview` is stored and selected backend-side but read nowhere in the frontend; there is no free-preview flow, which is why gating `getLectureById` breaks nothing, but it does mean the field is now fully inert.

**Verification**: e2e 13 passed / 2 failed — unchanged baseline, and that suite exercises both guards on the happy path (a teacher creating a course/module/lecture, an enrolled student reading and completing them). `verify-ownership-guards.mjs`: 16/16.
- [x] Split `models/Course/courses.js` into three model files; break the circular import (§4.5) — 2026-09-12. `courses.js` became `course.model.js`, `lecture.model.js` and `assignment.model.js`. The `models/Course/` directory is gone: `Modules.js` and `Progress.js` moved with it to `module.model.js`/`progress.model.js`, and `Orders.js` to `order.model.js`, so `models/` now matches §6.1 apart from `user/`, which B5.6 replaces wholesale. All 17 import sites updated across `src/` and `scripts/`. The circular import was already removed in B3 along with the dead `pre('remove')` hooks; it did not come back. **Every `mongoose.model()` name is byte-identical to before** — renaming one would silently break every `ref:` pointing at it.

  **The split removed an accident that was doing real work.** Importing any one of `Courses`/`Lectures`/`Assignments` used to register all three, because they shared a module. Split apart, a file that imports only `course.model.js` leaves `"Lectures"` unregistered, and a later `.populate('lectures')` throws `MissingSchemaError` at runtime, far from the import that caused it — exactly the §4.5 `ref: "Course"` failure mode, reintroduced by a refactor that looks purely cosmetic. `db/index.js` now imports all nine models for their side effect before `connectDB` can run, so registration no longer depends on which file happened to import what. Verified by asserting `mongoose.modelNames()` contains all nine.

**Verification**: e2e 13 passed / 2 failed — unchanged baseline. All files pass `node --check`.
- [x] Delete all dead code in §4.1; drop unused deps in §4.2; move `nodemon` to devDependencies and add a real `start` — 2026-09-12. Deleted `Course.controller.js`'s three dead cart handlers (the working ones are in `cart.controller.js` and are the ones actually routed), and `Modules.controller.js`'s `addLectureToModule`/`addAssignmentToModule`, which were exported but unrouted and would have thrown `ValidationError` on every call. The same-named functions in `frontend/src/Pages/Courseupdatation.jsx` are local helpers that call different endpoints — checked before deleting. Also removed the 33-line commented-out `createAssignment` block and the leftover `console.log` middleware in `assignments.routes.js`.

  **Unused imports were swept mechanically, not by eye** — a throwaway script parsed every import in `src/` and checked each name against the file body with comments stripped. It found 14 files' worth, a superset of the five §4.1 listed, and re-running it after the edits reports clean. Worth repeating after B5's later chunks move code around.

  Dropped `mongodb`, `validator`, `mongoose-aggregate-paginate-v2` and `fs-extra` (7 packages removed). `fs-extra`'s single use — `Lecture.controller.js`'s `fs.remove(videoLocalPath)` — was deleting a file `uploadOnCloudinary` had already `unlinkSync`'d on both its success and failure paths (`cloudinary.js:22,28`); it never errored only because `fs-extra`'s `remove` is idempotent on a missing path. `morgan` was also on the §4.2 suspect list but **is** in use (`app.js:21,24`) and stays.

  Scripts are now `start: node src/index.js`, `dev: nodemon src/index.js`, `test: npm --prefix ../e2e test` — the Playwright suite is real and `exit 1` meant CI could never gate on it. `README.md` updated to point contributors at `npm run dev`, since `npm start` no longer watches files. The e2e suite spawns `node src/index.js` directly (`global-setup.ts:53`) and is unaffected.

**Verification**: e2e suite 13 passed / 2 failed — identical to the B4 baseline, same two lecture-completion double-fire failures (frontend Module 5, unrelated). All 49 backend files pass `node --check`. Live dev backend smoke-checked after the edits: `/courses/getallCourses` 200, unauthenticated `/courses/:id/modules` still 401, `/courses/cart` still 401.

### Module B6 — Hardening & tests
- [ ] `helmet`, rate limiting on auth routes, upload size limits + randomised filenames, temp dir outside `public/` (§2.10, §4.7).
- [ ] `NODE_ENV`-derived cookie flags in one shared place (§3.12).
- [ ] Request validation schemas (§3.4).
- [ ] Pagination (§3.10) and the N+1 fix (§3.9).
- [ ] First tests — prioritise regression tests for §1.1, §1.2, §1.3, §2.3, and §3.1, each of which a single assertion would have caught.
- [ ] Strip logging noise / PII (§4.3); fix the message copy-paste errors (§4.4).

---

## 8. Summary

**Fix first (P0)** — 1.1 unauthenticated paid-content bypass (verified end to end) · 1.2 cross-teacher student PII leak · 1.3 `/courses/enroll` 500s on every call · 1.4 tokens in server logs · 1.5 logout doesn't invalidate sessions.

**Then (P1)** — 2.1 no error handler (highest leverage single change) · 2.2 sixteen statusless errors · 2.3 dead cascade hooks orphaning data · 2.4 Cloudinary assets never deleted · 2.5 unawaited deletes can crash the process · 2.6 client-controlled deadlines · 2.7 float paise · 2.8 no payment webhook · 2.9 non-idempotent verification · 2.10 upload handling · 2.11 refresh masks 401 as 400.

**Structural** — no error layer, logic in controllers, non-declarative authorization, duplicated user models with no role claim, abandoned duplicate implementations, no validation/config/tests (§5). Target layout and the four highest-value changes in §6.

**Two suspected bugs were tested and cleared** (§6.4) — they are not bugs, don't re-investigate.

**Not verified against production** — §7 Module B0 lists exactly what to check there, including secret rotation, which §1.4 makes non-optional.

---

## 9. Test plan

**Status: planning only — no test code has been written yet.** This section is being reviewed before any test file is created, per explicit instruction. There is currently zero test infrastructure (`"test": "echo \"Error: no test specified\" && exit 1"`, no test runner in `dependencies`) — this is a greenfield setup, not an extension of something existing.

**Scope**: every controller already in the codebase (8 files, ~40 handlers — inventoried below) gets coverage, not just B1's fixes going forward. New B1 code gets its tests written alongside the fix that introduces it, in the same commit; the pre-existing untested surface is worked through as its own phased backlog (T1-T4 below), in the same priority order as the B-modules so testing and hardening land on the same files together instead of two separate passes.

### 9.1 Tooling

| Concern | Choice | Why |
|---|---|---|
| Test runner | **Vitest** | ESM-native (this project is `"type": "module"` throughout — Jest's ESM support is still friction-prone), Jest-compatible API/mocking so it reads familiar, fast watch mode. |
| HTTP integration | **supertest** | `app.js` already exports `{ app }` separately from `index.js`'s `app.listen(...)` — supertest can drive the real Express app in-process, no port binding, no separate server lifecycle to manage in tests. |
| Test database | **mongodb-memory-server** | Spins up a real, ephemeral MongoDB per test run — integration tests exercise actual Mongoose schema validation, indexes, and query behavior instead of a hand-rolled mock, with zero risk of touching the real Atlas cluster and zero manual cleanup. |
| External services | **`vi.mock()`** on the `cloudinary` and `razorpay` packages | Tests must never call real Cloudinary/Razorpay APIs — cost, flakiness, rate limits, and it'd otherwise require real credentials in CI. Mock at the SDK boundary so controller logic (what gets sent, how responses/errors are handled) is still exercised. |
| JWT | Real `jsonwebtoken`, fixed secret from a `.env.test` | Fast and deterministic; no reason to mock a pure function. |
| Coverage | `@vitest/coverage-v8` (optional, nice-to-have) | Not a gate initially — this codebase has zero tests today, so "some coverage" is already the win; a coverage threshold can be added once the backlog below is cleared. |

New `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`. A `src/tests/setup.js` (or `tests/` at the backend root, mirroring `src/`) wires `mongodb-memory-server` up/down in `beforeAll`/`afterAll` and resets collections in `afterEach`.

**Unit vs. integration split**: most of these controllers are thin wrappers around Mongoose calls with a handful of real branches (auth, ownership, amount/signature math) — mocking every Mongoose call to "unit test" them would mostly test the mocks. So coverage leans **integration-heavy** (supertest + in-memory Mongo, exercising the real route including its auth middleware), with **unit tests reserved for pure logic**: `utils/verifyOwnership.js`, `utils/enrollment.js`'s branching, `ApiError`/`ApiResponse`/`asyncHandler`, the Razorpay signature check and amount calculation in `Payment.controller.js`, and each auth middleware's token-branch logic.

### 9.2 Regression tests mapped to findings already in this document

Every P0/P1 finding above that was fixed (or will be, in B1-B4) gets a test asserting the *old* broken behavior can't come back — this is the highest-value tranche, since each one is a single assertion that would have caught a real, already-shipped bug:

- §1.1 unauthenticated `getCourseModules` — assert 401 for no token, 403 for a non-enrolled/non-owner caller, 200 with modules for enrolled student or owning teacher (once B1 lands the guard).
- §1.2 cross-teacher PII leak — teacher B hitting teacher A's `getStudentsAndUploadedAssignments`/`getEnrolledStudents` must 403 (once B1 lands `assertCourseOwnership` there).
- §1.3 `/courses/enroll` — must not 500 (regression test for the missing-import crash).
- §1.4 credential logging — a log-output assertion (or just: this is closed by deletion, so no test needed once the `console.log` lines are gone — covered implicitly).
- §1.5 logout — after logout, read the student/teacher document directly and assert `refreshToken` is actually cleared (not just that the response is 200).
- §2.2 statusless `ApiError`s — `ApiError` constructor test: rejects/normalizes a non-numeric status code.
- §2.3 cascade deletes — deleting a course must leave no orphaned `Modules`/`Lectures`/`Assignments` documents referencing it.
- §2.6 assignment deadlines — a submission after the *server-recorded* deadline is marked late even if the client claims otherwise.
- §2.7 float paise — `createOrder`'s amount for prices that produce floating-point remainders (e.g. three courses at odd prices) must be a clean integer.
- §2.9 payment idempotency — calling `verifyPayment` twice with the same valid signature must not double-enroll or double-process (this is also a B4 prerequisite, tested as it's built).
- §3.1 `getCourseById` — must return the course document, not the literal number `200`.
- §3.6 `createAssignment` duplicate-title check — query against the field that actually exists on the schema.

### 9.3 File-by-file backlog (pre-existing code, phased)

Phased in the same order as the B-modules so a file's tests land alongside its fix, not as a separate pass:

**T1 — Auth (do first: every other integration test needs the ability to log a test user in)**
- `UserStudent.controller.js` (`registerUserStudent`, `loginUserStudent`, `logoutUserStudent`, `getCurrentStudent`) — duplicate email/name rejection, wrong-password rejection, cookie + token shape on success, logout actually clears `refreshToken` (§1.5).
- `UserTeacher.controller.js` (`registerUser`, `loginUser`, `logoutUser`, `getCurrentTeacher`) — same shape, plus a regression test for the historical signup crash (already fixed, but easy to reintroduce).
- `auth.routes.js`'s `refreshAccessToken` — valid refresh succeeds and rotates tokens; invalid/expired/revoked (post-logout) refresh is rejected with the correct status (§2.11 — currently masks 401 as 400, worth asserting the *correct* code once fixed).
- `authstudent.middleware.js`, `authteacher.middleware.js`, `authcombined.middleware.js` — missing token, malformed token, expired token, wrong-secret token (simulates a pre-rotation token, ties directly to tonight's live incident) all rejected; valid token attaches `req.student`/`req.teacher`.

**T2 — Modules / Lectures / Assignments (in flight now as part of B1)**
- `Modules.controller.js`, `Lecture.controller.js`, `Assignment.controller.js` — ownership guard on every mutation (teacher B 403 on teacher A's course, matches §1.1/§1.2's fix), `getCourseModules` auth+enrollment gate once B1 lands, `createAssignment`'s duplicate-title field bug (§3.6), `deleteAssignment`'s unawaited-deletion crash risk (§2.5).

**T3 — Payment (highest real-money risk; confirmed working live tonight, needs regression coverage before it's touched again for B4)**
- `Payment.controller.js` — `createOrder`'s server-side amount derivation (rejects a tampered client amount, matches the Module 1 fix), integer-paise rounding (§2.7), `verifyPayment`'s signature check (valid/invalid/tampered), idempotency once B4 adds it (§2.9), enrollment + cart-clear side effects on success.

**T4 — Course catalog, cart, remaining edges**
- `Course.controller.js` — `getCourseById` (§3.1 regression), `getCoursesByCategory`, `enrollMultipleCourses`, `checkEnrollment`, `CourseProgress` calculation once B3's fixes land.
- `cart.controller.js` — add/remove/get, empty-cart response (§3.5 — currently 404s, assert the corrected behavior once fixed).
- `utils/verifyOwnership.js`, `utils/enrollment.js` — direct unit tests for their branches (already-enrolled skip, missing course, ownership mismatch).

### 9.4 Execution order for this session

1. Set up tooling (`vitest`, `supertest`, `mongodb-memory-server` as devDependencies; `tests/setup.js`; `package.json` scripts). No feature code touched.
2. Continue B1 (auth-guard `getCourseModules`, ownership checks, logout fix, `/courses/enroll`) — write each fix's test in the same pass, per T1/T2 above.
3. Backfill T1 (auth) tests for existing code not touched by B1, since everything downstream depends on it.
4. Continue into B2 (error handling) with tests, then work through T3/T4 as B3/B4 are reached — keeping "fix a module" and "test that module" as one motion rather than a separate sweep at the end.

**Not doing**: a coverage-percentage target, snapshot testing, or end-to-end browser tests (Cypress/Playwright) — out of scope here, this section is backend controller/integration coverage only.

---

## 10. Architectural Patterns & Rationale

Reference notes on three patterns introduced during the B1–B3 fixes, for anyone (including a future session) who needs to reuse or explain them. Each cites the actual current code, not a simplified version of it.

### 10.1 Authorization & ownership: `assertCourseOwnership`

`utils/verifyOwnership.js`:

```js
const assertCourseOwnership = (course, teacherId) => {
    if (!course) {
        throw new ApiError(404, "Course not found");
    }
    if (course.author.toString() !== teacherId.toString()) {
        throw new ApiError(403, "You are not authorized to modify this course");
    }
};
```

**Why a manual guard function instead of an RBAC framework.** This app has exactly one authorization rule that matters for write access: *a teacher may only mutate a course they authored.* There are no roles beyond student/teacher, no per-resource permission sets, and no need to compose multiple policies. A policy engine (CASL, an ACL table, a permissions middleware framework) would add a dependency, a new mental model, and a layer of indirection to express a rule that a two-line `if` already states exactly and legibly. `assertCourseOwnership` is called at the top of every mutating handler (`addModule`/`updateModule`/`deleteModule` in `Modules.controller.js:22,109,132`; `addLecture`/`updateLecture`/`deleteLecture` in `Lecture.controller.js:24,95,141`; `createAssignment`/`deleteAssignment`/`getStudentsAndUploadedAssignments` in `Assignment.controller.js`; `getEnrolledStudents` in `Course.controller.js`) — one line, same shape, same failure modes (404 if the resource doesn't exist, 403 if it exists but isn't theirs), grep-able by name. The cost of "not an RBAC framework" is that this rule is repeated at each call site rather than declared once at the route table — that's the real gap, and it's exactly what `requireCourseOwner` (§6.1, Module B5) is planned to close *without* introducing a general-purpose permission system, by making the same check a route-level middleware instead of an in-handler call.

**Teacher ownership vs. student access are different questions, checked differently, on purpose.** `assertCourseOwnership` only ever answers "does this teacher own this course" — it has no concept of a student at all, and is never called from a student-facing read path. A student is never "the owner" of a course in this data model; a course's `author` field (`courses.js`) is always a `UserTeacher` reference. What a student *does* have is enrollment, which is a completely separate relationship: `course.enrolledStudents[]` (an array of `UserStudent` ids on the `Courses` document itself — there is no separate `Enrollment` collection in this codebase) records who has paid for read access, and `Progress` (`models/Course/Progress.js`) separately tracks how much of that content a given student has consumed. `getCourseModules` (`Modules.controller.js:172-207`) is the clearest example of both checks living side by side without being conflated:

```js
const isOwner = req.teacher && course.author.toString() === req.teacher._id.toString();
const isEnrolled = req.student && course.enrolledStudents.some(
    (studentId) => studentId.toString() === req.student._id.toString()
);
```

`isOwner` is a write-permission-shaped question (would this caller be allowed to change the course), reusing the exact same comparison `assertCourseOwnership` makes. `isEnrolled` is a consumption-permission-shaped question (has this caller paid for this content) and is checked independently, against a different field, because they are genuinely different facts about the caller — a course's own teacher is not "enrolled" in it, and an enrolled student never becomes its author. Keeping them as two separate booleans (rather than folding both into one generic `hasAccess` check) is what let this handler give owners and enrolled students full data while giving everyone else a stripped response, instead of a single allow/deny — a permission model expressive enough to need that distinction is exactly the case a bespoke check handles more clearly than a generic one.

### 10.2 Asynchronous media cleanup: `Promise.allSettled` in cascading deletes

Every cascading delete that touches Cloudinary (`deleteModule` in `Modules.controller.js:121-170`, `deleteAssignment` in `Assignment.controller.js`) follows the same two-step shape:

```js
const cloudinaryDeletions = [
    ...module.lectures.map((lecture) =>
        deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type)
    ),
    ...module.assignments.flatMap((assignment) =>
        assignment.public_id.map((id, i) =>
            deleteMediaFromCloudinary(id, assignment.resourceTypes?.[i])
        )
    ),
];
const cloudinaryResults = await Promise.allSettled(cloudinaryDeletions);
cloudinaryResults.forEach((result) => {
    if (result.status === "rejected") {
        console.error("Cloudinary cleanup failed during module delete:", result.reason);
    }
});
```

**Why `allSettled` and not `all`.** Cloudinary is a third-party network call outside this process's control — it can time out, rate-limit, or 404 on an asset that was already deleted out of band. `Promise.all` rejects as soon as *any* promise in the batch rejects, discarding the outcomes of every other promise in flight, including ones that already succeeded. In a batch of, say, ten assignment files, one Cloudinary hiccup would `all`-reject the whole batch — the handler's `catch` (or, before this fix, no catch at all — see §2.5) would then abort before the database records are cleaned up, leaving the DB and Cloudinary inconsistent with each other and the other nine files' *successful* deletions unrecorded anywhere. `Promise.allSettled` never short-circuits: every promise runs to completion regardless of the others' outcomes, and the returned array reports each one's own `{status: "fulfilled"} | {status: "rejected", reason}` — which is exactly what the `.forEach()` above inspects, logging only the failures instead of throwing. This is also what makes it safe to delete the parent module/course records unconditionally right after: a failed Cloudinary delete becomes a logged, inspectable orphan (exactly the kind the migration script in §7/B3 exists to clean up later) rather than a crash that leaves the parent record un-deleted while some of its children are already gone.

This directly replaced the pre-fix code (§2.5) that fired Cloudinary deletes inside a bare `forEach(async (id) => { await deleteMediaFromCloudinary(id) })` — `forEach` never awaits its callback's returned promises, so the handler proceeded immediately, and any rejection became an **unhandled promise rejection**, which terminates the Node process by default on Node 15+. `Promise.allSettled` fixes both problems in the same change: it waits for real completion, and it can never itself reject.

### 10.3 Concurrency control in progress tracking: races, silent double entries, and the atomic fix

**The race.** The pre-fix `markLectureCompleted`/`markAssignmentCompleted` (`Lecture.controller.js`, `Assignment.controller.js`) both followed this shape: `findOne` the student's `Progress` document, check in application code whether the lecture/assignment id is already in the array, and — only if not — push it and `.save()`. This is a classic read-modify-write critical section with no lock around it. Two requests for the same completion arriving close enough together (a genuine double-click, or — concretely, in this codebase — the still-open checkbox/label markup bug in `LectureAssig.jsx` that fires two `POST /complete` calls from one physical click, tracked separately under Module 5) can both execute their `findOne` before either has written its result back: both see the array *without* the new id, both conclude "not yet completed," and both proceed to push and save.

**Silent vs. explicit double entry.** Without a database-level constraint, that race produces a **silent double entry**: two `{lectureId, completedAt}` rows for the *same* lecture end up in `completedLectures[]`, `completedLectureCount` gets incremented twice for one real completion, and every request in the race still returns `200 OK` — nothing errors, nothing is logged, the corruption is only visible if someone later inspects the array's contents. This is the more dangerous failure mode precisely because it produces no signal. An **explicit double entry**, by contrast, is what happens once a database-level uniqueness constraint exists and something tries to violate it anyway: MongoDB rejects the write outright with a duplicate-key error (`E11000`), which surfaces as a real, visible error the caller (and the error handler, §2.1) can see and react to. Adding the `{studentId, courseId}` unique index on `ProgressSchema` (`models/Course/Progress.js:46`, §3.8) moved the *document-creation* half of this problem from silent to explicit — but only the creation half; it does nothing by itself to stop the *array-push* half from silently double-entering, because pushing into an existing document's array isn't a constraint violation at all under a plain `$push`.

**The atomic fix.** Both handlers now do two atomic operations instead of one non-atomic read-modify-write:

```js
// 1. Get-or-create — idempotent regardless of how many requests race here;
//    the unique index guarantees at most one Progress document ever exists
//    per (studentId, courseId), so a concurrent double-insert attempt now
//    fails loudly (explicit) instead of silently succeeding twice.
await Progress.findOneAndUpdate(
    { studentId, courseId },
    { $setOnInsert: { studentId, courseId } },
    { upsert: true }
);

// 2. Conditional, atomic record of the completion itself. The query's
// `{ $ne: lectureId }` clause is the *only* thing enforcing uniqueness on
// lectureId — MongoDB evaluates the filter and applies the update as one
// atomic operation, so two concurrent requests can never both see "not
// present yet" the way two application-level findOne calls could. The write
// operator is a plain $push. $addToSet is NOT usable here: it compares the
// whole subdocument, including `completedAt`, which differs on every
// request — so every entry looks unique to it and it dedupes nothing, while
// reading as though it guarantees uniqueness.
const progress = await Progress.findOneAndUpdate(
    { studentId, courseId, "completedLectures.lectureId": { $ne: lectureId } },
    {
        $push: { completedLectures: { lectureId, completedAt: Date.now() } },
        $inc: { completedLectureCount: 1 },
        $set: { lastUpdated: Date.now() },
    },
    { new: true }
) ?? await Progress.findOne({ studentId, courseId });
```

If the lecture is already completed, the filter matches no document, `findOneAndUpdate` returns `null`, and the handler falls back to a plain read so the response still reflects current state — a repeat completion is a no-op, not an error, which matches what a user clicking an already-checked box should experience. **Live-verified under real concurrency**: the e2e suite's rapid-double-click regression test fires four near-simultaneous `POST /complete` requests for the same lecture against this exact code path; all four return `200` with zero duplicate-key errors — the test still fails, by design, on its network-layer assertion that only one request should have fired at all (that's the still-open frontend checkbox/label bug, Module 5's problem, not this endpoint's), but the endpoint itself no longer crashes or silently double-writes under the race it's actually exercising. The "exactly one entry" guarantee itself is enforced by MongoDB's documented atomicity of a single `findOneAndUpdate` — the filter-then-update pair is evaluated as one indivisible operation server-side, not re-checked empirically per call.
