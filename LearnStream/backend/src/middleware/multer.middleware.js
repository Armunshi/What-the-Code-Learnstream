import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

// Outside public/ on purpose (BACKEND_AUDIT.md §2.10): app.js used to serve
// "public" statically, which made every in-flight upload downloadable,
// unauthenticated, at /temp/<filename> for as long as it sat on disk.
const TEMP_DIR = path.resolve("tmp_uploads");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  // The client-supplied name is never trusted for the on-disk filename: two
  // people uploading "assignment.pdf" used to overwrite each other, and an
  // attacker-controlled name is a path-traversal vector Multer's own docs
  // warn about. Only the extension survives, taken from a fixed position so
  // a name like "../../evil.pdf" still yields the harmless ".pdf".
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, "");
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const allowedMimeTypes = [
  "image/jpeg", "image/png", "image/gif",   // Images
  "audio/mpeg", "audio/wav",                // Audio
  "video/mp4", "video/avi", "video/mkv",    // Video
  "application/pdf",
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images, audio, video and PDFs are allowed."), false);
  }
};

const MB = 1024 * 1024;

// One shared instance per size class rather than one global limit
// (BACKEND_AUDIT.md §2.10 / §4.7): a limit generous enough for lecture video
// would let an "image" or "PDF" field upload the same size, on routes that
// never expect video at all.
const makeUploader = (fileSize, extra = {}) =>
  multer({ storage, fileFilter, limits: { fileSize, ...extra } });

// Course thumbnails and assignment/submission documents.
export const upload = makeUploader(20 * MB);

// Lecture videos, and the bulk course-submission endpoint (upload.any()),
// which can carry a video among the files in the same multipart request.
export const uploadVideo = makeUploader(500 * MB, { files: 50 });
