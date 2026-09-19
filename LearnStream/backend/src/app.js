// Imported first and for its side effect as much as its value: config/env.js
// is where dotenv is loaded and every variable is validated, so importing it
// here guarantees the rest of this file sees a checked environment.
import { env } from "./config/env.js"

import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import helmet from "helmet"
import compression from "compression"
import fs from "fs"
import path from "path"
const app = express()

// This is a pure JSON API with no static assets, and most of its GETs are
// personalized (my-learning, cart, instructor courses, …). Express's default
// `etag` setting auto-computes a weak ETag from the raw response body with no
// awareness of *who* asked for it, so a browser holding an old cached body
// for a URL (from an earlier account, or from before the data changed) can
// get it validly replayed via a 304 the moment two different responses for
// that URL happen to hash the same — confirmed live: /users/me/learning,
// /courses/cart and /instructor/courses were all observed serving stale 304s
// this way. Disabling etag app-wide, plus defaulting every response to
// `Cache-Control: no-store`, kills that class of bug outright. Routes that
// deliberately want caching (catalog, stats, search, reviews) opt back in
// explicitly via middleware/cacheControl.js's cacheControl()/publicCache(),
// which sets its own Cache-Control header later in the same request and
// overrides this default.
app.disable("etag")
app.use((req, res, next) => {
    res.set("Cache-Control", "no-store")
    next()
})

// crossOriginResourcePolicy defaults to "same-origin", which makes browsers
// block a cross-origin fetch of this API's own responses regardless of the
// CORS headers below — and this app is cross-site by construction (Vercel
// frontend, Render backend), so that default would break every request.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))

// Function format, not a format string: morgan renders an empty token as "-".
const accessLog = (tokens, req, res) => {
    const ms = tokens['response-time'](req, res);
    const slow = parseFloat(ms) > 1000 ? 'SLOW ' : '';
    return `${tokens.date(req, res, 'iso')} ${slow}${tokens.method(req, res)} ${tokens.url(req, res)} ${tokens.status(req, res) ?? '-'} ${ms ?? '-'} ms - ${tokens.res(req, res, 'content-length') ?? '-'}`;
};

// Registered first so the measured time covers body parsing, CORS, uploads and the handler.
if (env.isProduction) {
    app.use(morgan('combined'))
} else {
    fs.mkdirSync(path.resolve('logs'), { recursive: true })
    app.use(morgan(accessLog, {
        stream: fs.createWriteStream(path.resolve('logs/access.log'), { flags: 'a' }),
    }))
}

app.use(compression())

//middleware
// The Razorpay webhook and (later) the Cloudinary notification webhook both
// sign the exact bytes they send, so the raw body has to survive intact for
// verification (BACKEND_AUDIT.md §2.8, docs/contracts/api-conventions.md
// "Body size limits"). Re-serialising a parsed object is not equivalent —
// key order and whitespace would differ and every signature check would
// fail — so these two paths get express.raw() ahead of every other body
// parser, instead of a verify callback bolted onto the JSON parser.
//
// This also captures the JSON payload into `req.body` for the handler's
// convenience (same as before), by parsing the raw bytes ourselves right
// after capturing them — the handler still reads req.body.event etc. as
// plain JSON, it just also has req.rawBody for the signature check.
const RAW_BODY_PATHS = ["/payment/webhook", "/webhooks/cloudinary"];
app.use(RAW_BODY_PATHS, express.raw({ type: "*/*", limit: "1mb" }));
app.use(RAW_BODY_PATHS, (req, res, next) => {
    req.rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    try {
        req.body = req.rawBody.length ? JSON.parse(req.rawBody.toString("utf8")) : {};
    } catch {
        req.body = {};
    }
    next();
});

// /instructor authoring endpoints (curriculum/metadata edits) need a bigger
// body than the rest of the API, so this is mounted BEFORE the global 16kb
// parser below — body-parser's shared `req._body` flag (set by whichever
// parser reads the body first) is what makes the global one skip re-parsing
// a body this has already consumed, rather than hanging on an
// already-drained stream (docs/contracts/api-conventions.md "Body size
// limits").
app.use('/instructor', express.json({ limit: '1mb' }))

// The global parser for everything else. It never runs a second time for a
// request one of the two middlewares above already parsed — see the
// req._body note above.
app.use(express.json({ limit: "16kb" }))

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error("Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));


app.use(express.urlencoded({extended:true,limit:"16kb"}))
// No express.static("public") — that used to exist solely to serve
// multer's temp upload directory, which made every in-flight upload publicly
// downloadable, unauthenticated (BACKEND_AUDIT.md §2.10). Uploads now write
// outside public/ entirely (see multer.middleware.js), so there is nothing
// left in public/ that needs to be served.
app.use(cookieParser())


//Routers
// import userStudentRouter from './routes/studentsauth'
import userTeacherRouter from './routes/teachers.routes.js'
import userStudentRouter from './routes/students.routes.js'
import CourseRouter from './routes/CourseRoutes/index.routes.js'
import AuthRouter from "./routes/auth.routes.js"
import PaymentRouter from "./routes/payment.routes.js"
import { errorHandler } from "./middleware/errorHandler.middleware.js"
import { mountFeatureRoutes, mountTestRoutes } from "./routes/loadFeatureRoutes.js"

// Routes declaration
app.use('/user/teacher',userTeacherRouter);
app.use('/user/student',userStudentRouter);

// routes/features/*.routes.js (docs/contracts/registries.md) mounted BEFORE
// the legacy CourseRouter below: two of its new static routes
// (/courses/categories, /courses/cards) are single path segments that would
// otherwise be swallowed by the legacy GET /courses/:courseId catch-all —
// Express dispatches middleware in registration order, so whichever router
// is added to the stack first wins a path both would otherwise match.
// Registering the whole feature-routes registry ahead of the legacy router
// is what makes every new static sibling win without this file needing to
// know about them individually (docs/contracts/api-conventions.md "Route
// mounting" — priority only orders entries within the registry itself).
await mountFeatureRoutes(app);

app.use('/courses',CourseRouter);
app.use('/auth',AuthRouter);
app.use('/payment',PaymentRouter);

// e2e-only scaffolding (mail outbox, fake media, learn-captions helpers) —
// never a production code path (docs/contracts/api-conventions.md "Route
// mounting").
if (env.e2eTestRoutes && !env.isProduction) {
    await mountTestRoutes(app);
}

// Must be registered last: this is what turns every thrown ApiError (and any
// other error asyncHandler forwards) into a JSON envelope instead of
// Express's default HTML-with-stack-trace response (BACKEND_AUDIT.md §2.1).
app.use(errorHandler);

export {app}
