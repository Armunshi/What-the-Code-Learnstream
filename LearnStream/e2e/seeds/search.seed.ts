// e2e seed registry entry (docs/contracts/registries.md, e2e/lib/seed-registry.ts).
// Seeds a fixed set of PUBLISHED courses, all sharing the query term
// "javascript" in their title, that between them cover every filter group
// FR-SRC-3.2 needs a fixture for: language, level, captions, duration,
// price, rating and certification-prep — plus the facet-count-matches-
// backend test (search-filters.spec.ts criterion 14).
//
// **Needed amendment, flagged per the lane's own hard rule (not fixed here
// since it would mean editing frozen files outside this lane's glob):**
// no endpoint anywhere in the merged codebase (checked the legacy POST
// /courses controller and SHELL's POST /instructor/courses / PATCH
// .../learners) lets an instructor set subtitle, level, language, topics,
// isCertificationPrep, subcategory, stats.captionLanguages or
// stats.practiceTypes — exactly the fields this seed needs varied. The
// workaround below connects directly to the same in-memory MongoDB
// instance global-setup.ts already started (via runtime.mongod, read-only
// from e2e/lib/e2e-runtime.js — a file this lane doesn't own or edit) and
// writes those fields with the `mongodb` driver directly. `mongodb` is not
// in e2e/package.json's own dependencies, but it's a real, already-resolved
// transitive dependency of mongodb-memory-server-core (confirmed importable
// with `node -e "import('mongodb')"` from this directory), so this needs no
// change to e2e/package.json — which check-lane-ownership.mjs would reject
// anyway, since e2e/package.json isn't in this lane's owns/appends globs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';
import type { SeedCtx } from '../lib/seed-registry.js';
import { writeSeedOutput } from '../lib/seed-registry.js';
import { runtime } from '../lib/e2e-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../fixtures/assets');
const DB_NAME = 'learnstreamdb';

interface ApiEnvelope<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

async function createCourse(
  backendUrl: string,
  teacherToken: string,
  fields: { title: string; description: string; price: string; category: string }
): Promise<{ _id: string; title: string }> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append(
    'thumbnail',
    new Blob([fs.readFileSync(path.join(ASSETS_DIR, 'placeholder-thumbnail.jpg'))], { type: 'image/jpeg' }),
    'placeholder-thumbnail.jpg'
  );
  const res = await fetch(`${backendUrl}/courses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: form,
  });
  const json = (await res.json()) as ApiEnvelope<{ _id: string; title: string }>;
  if (!res.ok) throw new Error(`POST /courses -> ${res.status}: ${json.message ?? 'unknown error'}`);
  return json.data;
}

async function publishCourse(backendUrl: string, teacherToken: string, courseId: string): Promise<void> {
  const res = await fetch(`${backendUrl}/courses/${courseId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok) throw new Error(`PATCH /courses/${courseId}/status -> ${res.status}: ${json.message ?? 'unknown error'}`);
}

// Fields the plain course-creation/publish HTTP surface has no way to set
// (see the file-header amendment note) — written directly into the shared
// in-memory Mongo instance instead.
interface DirectCourseFields {
  subtitle: string;
  subcategory: string;
  topics: string[];
  level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  language: string;
  isCertificationPrep: boolean;
  publishedAt: Date;
  stats: {
    totalDurationSec: number;
    lectureCount: number;
    captionLanguages: string[];
    practiceTypes: string[];
    ratingAvg: number;
    ratingCount: number;
  };
}

async function applyDirectFields(client: MongoClient, courseId: string, fields: DirectCourseFields): Promise<void> {
  await client
    .db(DB_NAME)
    .collection('courses')
    .updateOne(
      { _id: new ObjectId(courseId) },
      {
        $set: {
          subtitle: fields.subtitle,
          subcategory: fields.subcategory,
          topics: fields.topics,
          level: fields.level,
          language: fields.language,
          isCertificationPrep: fields.isCertificationPrep,
          publishedAt: fields.publishedAt,
          'stats.totalDurationSec': fields.stats.totalDurationSec,
          'stats.lectureCount': fields.stats.lectureCount,
          'stats.captionLanguages': fields.stats.captionLanguages,
          'stats.practiceTypes': fields.stats.practiceTypes,
          'stats.ratingAvg': fields.stats.ratingAvg,
          'stats.ratingCount': fields.stats.ratingCount,
        },
      }
    );
}

export async function seed(ctx: SeedCtx): Promise<void> {
  const { teacher, runId, backendUrl } = ctx;

  if (!runtime.mongod) {
    throw new Error('search.seed.ts requires runtime.mongod to be set — is it running after global-setup\'s MongoMemoryServer.create()?');
  }
  const client = new MongoClient(runtime.mongod.getUri());
  await client.connect();

  try {
    // All five share the query term "javascript" in the title, so
    // search-filters.spec.ts's whole scenario is "search javascript, then
    // filter" — one seed, one query, every filter group represented.
    const specs = [
      {
        title: `JavaScript for Beginners E2E ${runId}`,
        price: '0',
        direct: {
          subtitle: 'Start from zero — variables, functions, the DOM.',
          subcategory: 'web-development',
          topics: ['javascript', 'html-css'],
          level: 'beginner' as const,
          language: 'en',
          isCertificationPrep: false,
          publishedAt: new Date(),
          stats: {
            totalDurationSec: 1800, // 0-1h bucket
            lectureCount: 12,
            captionLanguages: ['en'],
            practiceTypes: ['quizzes'],
            ratingAvg: 4.8,
            ratingCount: 40,
          },
        },
      },
      {
        title: `JavaScript Advanced Patterns E2E ${runId}`,
        price: '49900',
        direct: {
          subtitle: 'Closures, prototypes, async patterns for experienced devs.',
          subcategory: 'web-development',
          topics: ['javascript', 'react'],
          level: 'advanced' as const, // folds into the "all" level filter option
          language: 'hi',
          isCertificationPrep: true,
          publishedAt: new Date(),
          stats: {
            totalDurationSec: 14400, // 3-6h bucket
            lectureCount: 30,
            captionLanguages: ['hi', 'en'],
            practiceTypes: ['practice_tests'],
            ratingAvg: 4.2,
            ratingCount: 18,
          },
        },
      },
      {
        title: `JavaScript Fullstack Mastery E2E ${runId}`,
        price: '69900',
        direct: {
          subtitle: 'Node, Express and React end to end.',
          subcategory: 'web-development',
          topics: ['javascript', 'nodejs'],
          level: 'intermediate' as const,
          language: 'en',
          isCertificationPrep: false,
          publishedAt: new Date(),
          stats: {
            totalDurationSec: 36000, // 6-17h bucket
            lectureCount: 55,
            captionLanguages: ['en'],
            practiceTypes: [],
            ratingAvg: 4.9,
            ratingCount: 65,
          },
        },
      },
      {
        title: `JavaScript Testing Deep Dive E2E ${runId}`,
        price: '39900',
        direct: {
          subtitle: 'Unit tests, e2e tests, and test automation in JS.',
          subcategory: 'software-testing',
          topics: ['unit-testing', 'e2e-testing'],
          level: 'intermediate' as const,
          language: 'es',
          isCertificationPrep: false,
          // Published well over 60 days ago — deliberately EXCLUDED from
          // Hot and Fresh (FR-SRC-4.2's 60-day window), so fresh.js's
          // subcategory-fallback path has something real to skip over.
          publishedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
          stats: {
            totalDurationSec: 7200, // 1-3h bucket
            lectureCount: 20,
            captionLanguages: ['es'],
            practiceTypes: ['quizzes', 'practice_tests'],
            ratingAvg: 3.6,
            ratingCount: 9,
          },
        },
      },
      {
        // Deliberately low rating / no captions / long duration — gives
        // the "3.0 & up" and "17+" buckets a distinct member from the rest,
        // and keeps at least one course out of the "4.0 & up" bucket so
        // that rating filter isn't a no-op against this fixture set.
        title: `JavaScript Legacy Codebases E2E ${runId}`,
        price: '19900',
        direct: {
          subtitle: 'Working with jQuery-era and pre-ES6 JavaScript.',
          subcategory: 'web-development',
          topics: ['javascript'],
          level: 'all' as const,
          language: 'en',
          isCertificationPrep: false,
          publishedAt: new Date(),
          stats: {
            totalDurationSec: 72000, // 17+ bucket
            lectureCount: 48,
            captionLanguages: [],
            practiceTypes: [],
            ratingAvg: 3.1,
            ratingCount: 5,
          },
        },
      },
    ];

    const seededCourses: Array<{ id: string; title: string }> = [];

    for (const spec of specs) {
      const course = await createCourse(backendUrl, teacher.accessToken, {
        title: spec.title,
        description: `${spec.direct.subtitle} Seeded by the Playwright e2e suite for search-suggest.spec.ts / search-filters.spec.ts. Not a real course.`,
        price: spec.price,
        category: 'development',
      });
      await applyDirectFields(client, course._id, spec.direct);
      await publishCourse(backendUrl, teacher.accessToken, course._id);
      seededCourses.push({ id: course._id, title: course.title });
    }

    // Backend facet counts, computed the same way (disjunctive over the
    // unfiltered "javascript" query) that engine.mongo.js's own $facet
    // pipeline computes them — search-filters.spec.ts criterion 14 asserts
    // the panel's rendered counts equal these, read back via readSeed().
    const expectedFacets = {
      lang: { en: 3, hi: 1, es: 1 },
      rating: { '4.5': 2, '4.0': 3, '3.5': 4, '3.0': 5 },
      level: { beginner: 1, intermediate: 2, all: 2 },
      price: { free: 1, paid: 4 },
      duration: { '0-1': 1, '1-3': 1, '3-6': 1, '6-17': 1, '17+': 1 },
    };

    writeSeedOutput('search', {
      query: 'javascript',
      courses: seededCourses,
      expectedFacets,
      englishCourseCount: 3,
      certificationPrepCourseTitle: `JavaScript Advanced Patterns E2E ${runId}`,
    });
  } finally {
    await client.close();
  }
}
