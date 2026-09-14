// Thin fetch-based helpers used only by global-setup.ts to seed fixture
// data via direct HTTP calls (no browser needed for these — login-through-
// the-UI happens separately, only to produce realistic storageState files).
import fs from 'node:fs';
import { BACKEND_URL } from '../playwright.config.js';

interface ApiEnvelope<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) {
    throw new Error(`POST ${path} -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
  return json;
}

async function postMultipart<T>(
  path: string,
  fields: Record<string, string>,
  file: { fieldName: string; filePath: string; mimeType: string },
  token: string
): Promise<ApiEnvelope<T>> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const buffer = fs.readFileSync(file.filePath);
  form.append(file.fieldName, new Blob([buffer], { type: file.mimeType }), file.filePath.split('/').pop());

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) {
    throw new Error(`POST ${path} (multipart) -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
  return json;
}

export interface Credentials {
  name: string;
  email: string;
  password: string;
}

interface LoginData {
  user: { _id: string; name: string; email: string };
  role: string;
  accessToken: string;
  refreshToken: string;
}

// Shape of one message in the planned test mail outbox (GET
// /__test__/outbox?email=, gated by E2E_TEST_ROUTES=1 — see the plan doc's
// OTP-signup design). Loosely typed: the AUTH lane hasn't landed the route
// yet, so the exact body shape (a structured `otp`/`token` field vs. a raw
// text/html body to parse) isn't decided. Whatever shape it lands with, `to`
// and `subject` are safe bets for any mail-outbox implementation.
interface OutboxEmail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  [key: string]: unknown;
}

async function readOutbox(email: string): Promise<OutboxEmail[]> {
  const res = await fetch(`${BACKEND_URL}/__test__/outbox?email=${encodeURIComponent(email)}`);
  if (!res.ok) {
    throw new Error(`GET /__test__/outbox?email=${email} -> ${res.status}`);
  }
  const json = (await res.json()) as { data?: OutboxEmail[] } | OutboxEmail[];
  return Array.isArray(json) ? json : json.data ?? [];
}

// Accepts either shape a signup endpoint can return today or in the future:
//   - 201 (today): the account exists immediately, nothing more to do.
//   - 202 (planned OTP flow, BACKEND_AUDIT/UI_REQS OTP-signup design): the
//     account is pending until its verification email is read back and
//     confirmed. Structured this way so that when the AUTH lane (Wave 1)
//     switches a signup route from 201 to 202, signupTeacher/signupStudent
//     below — and every call site of theirs, e.g. global-setup.ts — need NO
//     changes; only the body of the 202 branch below has to be filled in.
async function completeSignup(path: string, creds: Credentials): Promise<void> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<unknown>>;

  if (res.status === 201) {
    return;
  }

  if (res.status === 202) {
    // The outbox route's shape IS specified by the plan, so this part is
    // implemented for real rather than stubbed.
    const outbox = await readOutbox(creds.email);
    // TODO(AUTH lane, Wave 1): the plan calls for a verify endpoint here
    // (read the OTP/token out of `outbox`'s most recent message to
    // creds.email, then POST it to whatever route AUTH defines to activate
    // the account) but that endpoint's name, method, and payload shape are
    // not decided yet. Rather than guess and risk needing rework, this stops
    // here with a clear error naming exactly what's missing. Fill in this
    // branch — and only this branch — once AUTH lands:
    //   1. the verify endpoint's route + method + expected body, and
    //   2. the exact field in an OutboxEmail that carries the OTP/token.
    throw new Error(
      `${path} returned 202 (pending OTP signup) for ${creds.email}, and the harness read ` +
        `${outbox.length} matching outbox message(s), but there is no verify-endpoint call implemented yet — ` +
        'see the TODO in e2e/lib/api-client.ts (completeSignup). Fill in the 202 branch once the AUTH lane ' +
        'defines the verify endpoint; no other file needs to change.'
    );
  }

  throw new Error(`POST ${path} -> ${res.status}: ${json.message ?? 'unknown error'}`);
}

export async function signupTeacher(creds: Credentials): Promise<void> {
  await completeSignup('/user/teacher/signup', creds);
}

export async function loginTeacher(creds: Pick<Credentials, 'email' | 'password'>): Promise<LoginData> {
  const res = await postJson<LoginData>('/user/teacher/login', creds);
  return res.data;
}

export async function signupStudent(creds: Credentials): Promise<void> {
  await completeSignup('/user/student/signup', creds);
}

export async function loginStudent(creds: Pick<Credentials, 'email' | 'password'>): Promise<LoginData> {
  const res = await postJson<LoginData>('/user/student/login', creds);
  return res.data;
}

interface Course {
  _id: string;
  title: string;
}

export async function createCourse(
  teacherToken: string,
  fields: { title: string; description: string; price: string; category: string },
  thumbnailPath: string
): Promise<Course> {
  const res = await postMultipart<Course>(
    '/courses',
    fields,
    { fieldName: 'thumbnail', filePath: thumbnailPath, mimeType: 'image/jpeg' },
    teacherToken
  );
  return res.data;
}

interface CourseModule {
  _id: string;
  title: string;
}

export async function createModule(
  teacherToken: string,
  courseId: string,
  fields: { title: string; description: string }
): Promise<CourseModule> {
  const res = await postJson<CourseModule>(`/courses/${courseId}/modules`, fields, teacherToken);
  return res.data;
}

interface Lecture {
  _id: string;
  title: string;
  public_id: string;
}

export async function createLecture(
  teacherToken: string,
  courseId: string,
  moduleId: string,
  fields: { title: string },
  videoPath: string
): Promise<Lecture> {
  const res = await postMultipart<Lecture>(
    `/courses/${courseId}/modules/${moduleId}/lectures`,
    fields,
    { fieldName: 'videourl', filePath: videoPath, mimeType: 'video/mp4' },
    teacherToken
  );
  return res.data;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export async function createOrder(
  studentToken: string,
  courseIds: string[]
): Promise<RazorpayOrder> {
  const res = await postJson<RazorpayOrder>(
    '/payment/create-order',
    { course_ids: courseIds, currency: 'INR' },
    studentToken
  );
  return res.data;
}

export async function verifyPayment(
  studentToken: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<void> {
  await postJson('/payment/verify', body, studentToken);
}

// Posts a Razorpay-style webhook. Takes the exact body string rather than an
// object on purpose: the signature is computed over the precise bytes sent, so
// serialising once here and again inside the signer could produce different
// JSON and fail verification for reasons that look like a signing bug.
export async function sendWebhook(rawBody: string, signature: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/payment/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: rawBody,
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok) {
    throw new Error(`POST /payment/webhook -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
}

export async function waitForBackendHealth(timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BACKEND_URL}/courses/getallCourses`);
      if (res.ok || res.status === 404) return; // any HTTP response means the server is up
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Backend at ${BACKEND_URL} did not become healthy within ${timeoutMs}ms`);
}
