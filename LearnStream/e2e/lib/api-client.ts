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

export async function signupTeacher(creds: Credentials): Promise<void> {
  await postJson('/user/teacher/signup', creds);
}

export async function loginTeacher(creds: Pick<Credentials, 'email' | 'password'>): Promise<LoginData> {
  const res = await postJson<LoginData>('/user/teacher/login', creds);
  return res.data;
}

export async function signupStudent(creds: Credentials): Promise<void> {
  await postJson('/user/student/signup', creds);
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
