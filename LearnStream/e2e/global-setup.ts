// Builds a fully isolated environment for one e2e run:
// 1. Starts an ephemeral in-memory MongoDB (mongodb-memory-server).
// 2. Spawns the real backend against it, on :8000 — binds the same port
//    your manually-started dev backend uses, so that must be stopped first
//    (documented in README.md).
// 3. Seeds a teacher, a course with two lectures, and a student enrolled in
//    it — all via direct API calls, except enrollment, which is driven by
//    POSTing a correctly-signed `payment.captured` payload to
//    /payment/webhook. That is the same path real fulfilment takes
//    (BACKEND_AUDIT.md §2.8), so the fixture now exercises production
//    fulfilment code rather than sidestepping it.
//
//    This used to forge the HMAC that verifyPayment accepted, which worked
//    only because that handler never confirmed anything with Razorpay. §2.9
//    closed that hole: verifyPayment now fetches the payment from Razorpay
//    and rejects an id that doesn't exist there, so a synthetic payment can
//    no longer be pushed through it. The webhook is the right seam instead —
//    a signed payload is exactly what Razorpay itself sends.
// 4. Logs in as both roles through the real login UI (not the API) so the
//    resulting storageState.json files contain exactly what a real session
//    produces — cookies AND the localStorage.userMeta the frontend itself
//    sets on login — rather than guessing which pieces matter.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { runtime } from './lib/e2e-runtime.js';
import { initRun } from './lib/log-writer.js';
import * as api from './lib/api-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = __dirname;
const BACKEND_DIR = path.resolve(E2E_ROOT, '../backend');
const AUTH_DIR = path.join(E2E_ROOT, '.auth');
const ASSETS_DIR = path.join(E2E_ROOT, 'fixtures/assets');

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

async function startBackend(mongoUri: string): Promise<void> {
  const envFile = parseEnvFile(path.join(E2E_ROOT, '.env.e2e'));
  const child = spawn('node', ['src/index.js'], {
    cwd: BACKEND_DIR,
    // dotenv (called inside index.js) does NOT override already-set
    // process.env values, so everything here wins over the real backend/.env.
    env: { ...process.env, ...envFile, MONGODB_URI: mongoUri },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => process.stdout.write(`[e2e-backend] ${d}`));
  child.stderr?.on('data', (d) => process.stderr.write(`[e2e-backend] ${d}`));
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[e2e-backend] exited early with code ${code} — check the output above.`);
    }
  });
  runtime.backendProcess = child;
  await api.waitForBackendHealth();
}

// Signs a webhook body the way Razorpay does: HMAC-SHA256 over the raw payload
// bytes, keyed with the webhook secret. The backend checks this with
// Razorpay's own validateWebhookSignature, so getting it right here is the
// whole test of that path.
function signWebhook(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  initRun();

  console.log('[e2e setup] starting in-memory MongoDB...');
  const mongod = await MongoMemoryServer.create();
  runtime.mongod = mongod;
  const mongoUri = mongod.getUri().replace(/\/$/, '');

  console.log('[e2e setup] spawning isolated backend on :8000 (stop your manual dev backend first)...');
  await startBackend(mongoUri);

  const runId = Date.now().toString(36);
  const teacherCreds = {
    name: `E2E Teacher ${runId}`,
    email: `e2e-teacher-${runId}@learnstream.test`,
    password: 'E2ePassw0rd!',
  };
  const studentCreds = {
    name: `E2E Student ${runId}`,
    email: `e2e-student-${runId}@learnstream.test`,
    password: 'E2ePassw0rd!',
  };

  console.log('[e2e setup] seeding teacher, course, module, two lectures...');
  await api.signupTeacher(teacherCreds);
  const teacherLogin = await api.loginTeacher(teacherCreds);

  const course = await api.createCourse(
    teacherLogin.accessToken,
    {
      title: `E2E Fixture Course ${runId}`,
      description: 'Seeded by the Playwright e2e suite. Not a real course.',
      price: '49900',
      category: 'E2E-A',
    },
    path.join(ASSETS_DIR, 'placeholder-thumbnail.jpg')
  );
  // A second course in a second category, purely so the category bar has
  // more than one button — course-list-navigation.spec.ts's category-switch
  // test needs something to switch to. Same count (1 each) as the first
  // category, so the frontend's count-desc/alpha-tie-break ordering
  // (GeneralCourses.jsx) puts "E2E-A" first (default-selected) and "E2E-B"
  // last, deterministically.
  await api.createCourse(
    teacherLogin.accessToken,
    {
      title: `E2E Fixture Course 2 ${runId}`,
      description: 'Seeded by the Playwright e2e suite. Not a real course.',
      price: '39900',
      category: 'E2E-B',
    },
    path.join(ASSETS_DIR, 'placeholder-thumbnail.jpg')
  );
  const courseModule = await api.createModule(teacherLogin.accessToken, course._id, {
    title: 'E2E Module 1',
    description: 'Seeded module.',
  });
  const lecture = await api.createLecture(
    teacherLogin.accessToken,
    course._id,
    courseModule._id,
    { title: 'E2E Lecture 1' },
    path.join(ASSETS_DIR, 'placeholder-lecture.mp4')
  );
  // A second lecture so the rapid-double-click duplicate-POST test has a
  // not-yet-completed target that doesn't collide with the single-click test.
  const lecture2 = await api.createLecture(
    teacherLogin.accessToken,
    course._id,
    courseModule._id,
    { title: 'E2E Lecture 2' },
    path.join(ASSETS_DIR, 'placeholder-lecture.mp4')
  );

  console.log('[e2e setup] seeding student + enrollment (signed webhook, no checkout UI)...');
  await api.signupStudent(studentCreds);
  const studentLogin = await api.loginStudent(studentCreds);

  const order = await api.createOrder(studentLogin.accessToken, [course._id]);
  const envFile = parseEnvFile(path.join(E2E_ROOT, '.env.e2e'));
  // Shaped like Razorpay's payment.captured event. `amount` must equal the
  // order's amount in paise or the handler refuses to fulfil it, so this
  // reads it back off the real order rather than hardcoding a number.
  const webhookBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_e2e_fixture_${runId}`,
          order_id: order.id,
          amount: order.amount,
          status: 'captured',
        },
      },
    },
  });
  await api.sendWebhook(
    webhookBody,
    signWebhook(webhookBody, envFile.RAZORPAY_WEBHOOK_SECRET)
  );

  // No storageState capture here — deliberately. AuthProvider refreshes on
  // every mount and the refresh endpoint rotates the token on every call
  // (see lib/selectors.ts's loginAs doc comment), so a static pre-captured
  // cookie snapshot only survives being used once. Each spec logs in fresh
  // via loginAs() instead.
  fs.writeFileSync(
    path.join(AUTH_DIR, 'test-data.json'),
    JSON.stringify(
      {
        courseId: course._id,
        moduleId: courseModule._id,
        lectureId: lecture._id,
        lecture2Id: lecture2._id,
        teacher: teacherCreds,
        student: studentCreds,
      },
      null,
      2
    )
  );

  console.log('[e2e setup] done — fixture ready.');
}
