# LearnStream E2E tests (Playwright)

Network-auditing integration suite covering four flows: Authentication/Token Refresh, Navigating Course Lists, Viewing Course Details, Marking a Lecture Complete. Full design writeup and findings: `UI_AUDIT.md §12` at the repo root.

## Before running

1. **Stop your manually-started dev backend.** `global-setup.ts` spins up its own backend (against an isolated in-memory MongoDB) and binds it to `:8000` — the same port `npm start` in `backend/` uses. Two processes can't share that port.
2. **Leave the frontend dev server running** (`npm run dev` in `frontend/`, port `2000`). It has no direct database dependency and transparently talks to whichever backend is listening on `:8000`, so it does not need to be restarted.
3. **Check `.env.e2e` has `RAZORPAY_WEBHOOK_SECRET`.** That file is gitignored, so it does not travel with the repo and a fresh clone will not have this key. The fixture enrolls its student by POSTing a correctly-signed `payment.captured` webhook, so setup fails without it. Any throwaway string works — it only has to match what the spawned backend reads.
4. First time only: `npm install && npx playwright install chromium`.

## Running

```
npm test          # headless
npm run test:headed
npm run test:ui   # Playwright's interactive UI mode
npm run report    # open the last HTML report
```

Structured JSON output lands in `logs/` (gitignored) — one file per run, with per-test network/console entries and a summary. `global-teardown.ts` always stops the spawned backend and MongoDB instance afterward, freeing `:8000` again — restart your normal `npm start` in `backend/` once you're done here.

## Current state

13 passing, 2 failing **by design** (as of 2026-09-12). The two failures both document the lecture-completion checkbox/label markup double-firing its completion request on every single click — one for a single click, one for a rapid double-click (see `UI_AUDIT.md §12.3`). The backend is not at fault: the `/complete` write is atomic and both POSTs return 200. The fix belongs to frontend Module 5. Don't loosen those assertions to get to green — fix the underlying bug instead, then the tests will pass on their own.

The third by-design failure is gone: the refresh-token endpoint masking 401 as 400 (`BACKEND_AUDIT.md §2.11`) was fixed in module B2, and that test now passes.
