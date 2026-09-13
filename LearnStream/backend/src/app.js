// Imported first and for its side effect as much as its value: config/env.js
// is where dotenv is loaded and every variable is validated, so importing it
// here guarantees the rest of this file sees a checked environment.
import { env } from "./config/env.js"

import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import fs from "fs"
import path from "path"
const app = express()

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

//middleware
// The Razorpay webhook signs the exact bytes it sends, so the raw body has to
// survive JSON parsing for that one route (BACKEND_AUDIT.md §2.8).
// Re-serialising the parsed object is not equivalent — key order and
// whitespace would differ and every signature check would fail.
app.use(express.json({
    limit:"16kb",
    verify: (req, res, buf) => {
        if (req.originalUrl === '/payment/webhook') {
            req.rawBody = buf;
        }
    },
}))

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
app.use(express.static("public"))
app.use(cookieParser())


//Routers
// import userStudentRouter from './routes/studentsauth'
import userTeacherRouter from './routes/teachers.routes.js'
import userStudentRouter from './routes/students.routes.js'
import CourseRouter from './routes/CourseRoutes/index.routes.js'
import AuthRouter from "./routes/auth.routes.js"
import PaymentRouter from "./routes/payment.routes.js"
import { errorHandler } from "./middleware/errorHandler.middleware.js"
// Routes declaration
app.use('/user/teacher',userTeacherRouter);
app.use('/user/student',userStudentRouter);
app.use('/courses',CourseRouter);
app.use('/auth',AuthRouter);
app.use('/payment',PaymentRouter);

// Must be registered last: this is what turns every thrown ApiError (and any
// other error asyncHandler forwards) into a JSON envelope instead of
// Express's default HTML-with-stack-trace response (BACKEND_AUDIT.md §2.1).
app.use(errorHandler);

export {app}
