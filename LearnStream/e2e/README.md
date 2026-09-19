# LearnStream E2E tests (Playwright)

Network-auditing integration suite covering four flows: Authentication/Token Refresh, Navigating Course Lists, Viewing Course Details, Marking a Lecture Complete. Full design writeup and findings: `UI_AUDIT.md §12` at the repo root.

## Before running

1. **Stop your manually-started dev backend** if it's bound to the same port this run will use (default `:8000`; see "Running on other ports" below). `global-setup.ts` spins up its own backend against an isolated in-memory MongoDB, and two processes can't share a port.
2. **You do NOT need to start the frontend yourself.** `playwright.config.ts`'s `webServer` builds the frontend once (`vite build`) and serves that static build via `vite preview` for the duration of the run — deliberately not `vite dev`, so this suite never depends on HMR/Fast-Refresh timing. If a frontend is already running on the target port, Playwright reuses it instead of rebuilding (`reuseExistingServer`), so a normal `npm run dev` left running from other work is still fine to leave up.
3. **Check `.env.e2e` has `RAZORPAY_WEBHOOK_SECRET`.** That file is gitignored, so it does not travel with the repo and a fresh clone will not have this key. The fixture enrolls its student by POSTing a correctly-signed `payment.captured` webhook, so setup fails without it. Any throwaway string works — it only has to match what the spawned backend reads.
4. First time only: `npm install && npx playwright install chromium`.

## Running

```
npm test          # headless
npm run test:headed
npm run test:ui   # Playwright's interactive UI mode
npm run report    # open the last HTML report
```

Structured JSON output lands in `logs/` (gitignored) — one file per run, with per-test network/console entries and a summary. `global-teardown.ts` always stops the spawned backend and MongoDB instance afterward, freeing its port again.

### Running on other ports

Set `E2E_BACKEND_PORT`/`E2E_FRONTEND_PORT` (both default 8000/2000) to run fully isolated from any other e2e run on the same machine — this is what lets multiple parallel worktrees each run this suite without colliding:

```
E2E_BACKEND_PORT=8103 E2E_FRONTEND_PORT=2103 npm test
```

## Current state

As of 2026-09-15, against `integration/w0` (`e288aa0`), a full run gets **8 passing, 7 failing** — not the previously-documented 13/2. This is **not** a frontend-serving-mode issue (confirmed identical failure counts/pattern whether the frontend is `vite dev`, `vite preview`, manually pre-started, or Playwright-started) and not something introduced by this suite's own port/webServer wiring. The cause is `backend/src/middleware/rateLimit.js`'s `authLimiter` (`limit: 20` requests per 15-minute window per IP, shared across `/login`, `/signup`, and `/refresh-Token` on both roles): a full run's real logins plus `AuthProvider`'s refresh-on-every-mount behavior exceed that budget partway through the suite, after which every subsequent login gets a `429` and shows as "Login Failed" in the UI, cascading into unrelated-looking failures in whatever spec runs next. Confirmed directly in captured network logs (`logs/*.json`) and Playwright traces — e.g. a `429 http://localhost:<port>/auth/refresh-Token` response on the request `loginAs()` waits on.

This needs a fix in `backend/src/middleware/rateLimit.js` (owned by another lane, not this e2e harness) — e.g. an escape hatch keyed off `NODE_ENV=test`/`E2E_TEST_ROUTES=1` — before the previously-documented 13/2 baseline is reachable again. Until then, don't read a run's exact pass/fail count as a regression signal beyond that pattern.

The two legitimately by-design failures (once the above is fixed and true test failures are visible again) are both in `lecture-completion.spec.ts`: the checkbox/label markup double-firing its completion request on every single click — one for a single click, one for a rapid double-click (see `UI_AUDIT.md §12.3`). The backend is not at fault there: the `/complete` write is atomic and both POSTs return 200. The fix belongs to frontend Module 5. Don't loosen those assertions to get to green — fix the underlying bug instead, then the tests will pass on their own.

The refresh-token-masking-401-as-400 by-design failure (`BACKEND_AUDIT.md §2.11`) is fixed (module B2) and no longer expected to fail.
