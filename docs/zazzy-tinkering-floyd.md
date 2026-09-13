# Add morgan request/response-time logging to the backend

## Context
We want to see how long each backend request takes. The need came up while debugging the assignment upload failure: requests that go through multer and Cloudinary can be slow, and nothing currently records their duration. The only request logging today is a hand-written middleware at `backend/src/app.js:32-35` that prints `req.path` and `req.method`. It records no status code, no timing, and runs before the response exists. On top of that, `/tmp/backend-dev.log` is flooded with full user-document dumps on every request, so a timing line would get lost in it.

**Outcome**: every request writes one clean line (method, URL, status, response time, size) to its own file, `backend/logs/access.log`. Any request slower than 1 s is prefixed with `SLOW `, so `grep SLOW` lists only the problem requests. Errors and debug output stay where they are, in `/tmp/backend-dev.log`.

## Changes

### 1. Install morgan (backend)
`npm install morgan` in `LearnStream/backend/`. The current version is 1.12.1 and it isn't present yet, not even as a transitive dependency. It goes in `dependencies` because production uses it too.

### 2. `LearnStream/backend/src/app.js`
- Add imports: `morgan`, `fs`, `path`.
- **Register morgan first**, straight after `const app = express()` and before `express.json`/`cors`. The timer starts when morgan's middleware runs, so putting it first makes the measured time cover body parsing, CORS, multer uploads, the Cloudinary round-trip and the handler. Morgan writes the line on response `finish`, so the time is for the full request.
- Define a custom token that marks slow requests. It reuses morgan's built-in `response-time` token, so it adds no second timer:
  ```js
  morgan.token('slow', (req, res) =>
    parseFloat(morgan['response-time'](req, res)) > 1000 ? 'SLOW ' : '');
  ```
- **Environment-dependent output**:
  - **Not production**: log format `':date[iso] :slow:method :url :status :response-time ms - :res[content-length]'`, written to `fs.createWriteStream(path.resolve('logs/access.log'), { flags: 'a' })`. Create the directory first with `fs.mkdirSync(path.resolve('logs'), { recursive: true })`. The path is relative to the working directory, the same way multer already uses `./public/temp`.
  - **Production** (`NODE_ENV === 'production'`): `morgan('combined')` writing to stdout. Render's filesystem is ephemeral, so a log file there would be lost. Stdout is what shows up in Render's log viewer.
- **Delete the old logger** at `app.js:32-35` (`console.log(req.path, req.method)`). Morgan covers what it did.

### 3. `LearnStream/backend/.gitignore`
Add `/logs` so `access.log` is never committed.

## Guardrails checked
- **No restart loop**: nodemon only watches `js,mjs,cjs,json` (its startup log says so). A `.log` file is not watched, so writing to `access.log` won't trigger restarts. Don't give the log file a `.json` name.
- **No credentials in the new log**: the format has no `:req[authorization]`, cookies or headers. `:url` includes query strings, but this app never passes tokens in them: every auth middleware reads the `Authorization` header or a cookie. This matters because `BACKEND_AUDIT.md` §1.4 already covers tokens leaking into the other log, and the new log mustn't leak them too.
- **Nothing else changes**: the uncommitted `console.error` line in `utils/cloudinary.js` stays as it is.

## Verification
1. After the install and the `app.js` edit, nodemon restarts by itself. Confirm `/tmp/backend-dev.log` shows `Server is running at port : 8000` and that `LearnStream/backend/logs/access.log` now exists.
2. Send some traffic with `curl -s localhost:8000/courses/getallCourses`, a request to a missing course id, and a few page loads from the frontend. Each should add exactly one line to `tail -f logs/access.log`, e.g. `2026-09-11T… GET /courses/getallCourses 200 41.203 ms - 5321`.
3. Check the slow flag with a real upload, such as adding an assignment through the UI. Cloudinary uploads usually take over 1 s, so the line should start with `SLOW POST /courses/…/assignments`. `grep SLOW logs/access.log` should list it.
4. Check for leaked credentials: `grep -c 'eyJ' logs/access.log` must print `0`.
5. Check that the old logger is gone: `/tmp/backend-dev.log` should no longer print bare `/path METHOD` lines for new requests.
6. Regression check: log in, open the teacher dashboard and load the cart, and confirm the app works as before.
