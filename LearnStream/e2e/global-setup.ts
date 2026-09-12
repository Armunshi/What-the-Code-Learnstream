// Builds a fully isolated environment for one e2e run:
// 1. Starts an ephemeral in-memory MongoDB (mongodb-memory-server).
// 2. Spawns the real backend against it, on :8000 — binds the same port
//    your manually-started dev backend uses, so that must be stopped first
//    (documented in README.md).
// 3. Seeds a teacher, a course with two lectures, and a student enrolled in
//    it — all via direct API calls, except enrollment, which is done by
//    forging the HMAC signature Payment.controller.js's verifyPayment
//    accepts (it never actually confirms with Razorpay's API — see
//    BACKEND_AUDIT.md §2.9). This is a deliberate shortcut for setup speed
//    and determinism; if §2.9 is ever fixed properly, this needs to switch
//    to driving the real Razorpay checkout UI instead.
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

function forgeRazorpaySignature(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
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

  console.log('[e2e setup] seeding student + enrollment (forged Razorpay signature, no checkout UI)...');
  await api.signupStudent(studentCreds);
  const studentLogin = await api.loginStudent(studentCreds);

  const order = await api.createOrder(studentLogin.accessToken, [course._id]);
  const forgedPaymentId = `pay_e2e_fixture_${runId}`;
  const envFile = parseEnvFile(path.join(E2E_ROOT, '.env.e2e'));
  const signature = forgeRazorpaySignature(order.id, forgedPaymentId, envFile.RAZORPAY_KEY_SECRET);
  await api.verifyPayment(studentLogin.accessToken, {
    razorpay_order_id: order.id,
    razorpay_payment_id: forgedPaymentId,
    razorpay_signature: signature,
  });

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
