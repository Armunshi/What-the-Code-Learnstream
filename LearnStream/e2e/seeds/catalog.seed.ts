// e2e seed registry entry (docs/contracts/registries.md, e2e/lib/seed-registry.ts).
// Builds a PUBLISHED course with a promo video and one free-preview lecture
// — cat.json's own notes require this ("a free-preview item and a promo
// video") so course-detail-view.spec.ts has something to assert a guest can
// actually see and play without logging in.
//
// The base fixture's course (global-setup.ts) is left DRAFT and un-trailered
// on purpose — it exists for the pre-existing teacher-authoring specs, not
// this one. Two calls here go around e2e/lib/api-client.ts (a frozen file
// this lane may not edit) because it doesn't yet expose what this seed
// needs:
//   - createCourse() only uploads a single `thumbnail` file; the backend's
//     POST /courses (extended by this lane) also accepts a second
//     `promoVideo` field on the same multipart request, so this seed sends
//     its own multipart POST rather than two separate course-creation calls.
//   - there is no PATCH-status helper, because the /courses/:courseId/status
//     endpoint is itself new (added by this lane to unblock exactly this
//     seed — see docs/lanes/cat.json's Wave 1 merge-order note about
//     depending on a publish step that doesn't exist yet anywhere else).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SeedCtx } from '../lib/seed-registry.js';
import { writeSeedOutput } from '../lib/seed-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../fixtures/assets');

interface ApiEnvelope<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

async function createCourseWithPromo(
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
  // Reuses the same placeholder video as the promo trailer — MEDIA_PROVIDER
  // is pinned to 'fake' for every e2e run (global-setup.ts), so this never
  // actually reaches Cloudinary; the fake provider only needs a real,
  // readable local file path to unlink.
  form.append(
    'promoVideo',
    new Blob([fs.readFileSync(path.join(ASSETS_DIR, 'placeholder-lecture.mp4'))], { type: 'video/mp4' }),
    'placeholder-lecture.mp4'
  );

  const res = await fetch(`${backendUrl}/courses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: form,
  });
  const json = (await res.json()) as ApiEnvelope<{ _id: string; title: string }>;
  if (!res.ok) {
    throw new Error(`POST /courses (with promoVideo) -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
  return json.data;
}

async function setLectureFreePreview(backendUrl: string, teacherToken: string, courseId: string, moduleId: string, lectureId: string): Promise<void> {
  const res = await fetch(`${backendUrl}/courses/${courseId}/modules/${moduleId}/lectures/${lectureId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({ enableFreePreview: true }),
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok) {
    throw new Error(`PUT .../lectures/${lectureId} -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
}

async function publishCourse(backendUrl: string, teacherToken: string, courseId: string): Promise<void> {
  const res = await fetch(`${backendUrl}/courses/${courseId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok) {
    throw new Error(`PATCH /courses/${courseId}/status -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
}

export async function seed(ctx: SeedCtx): Promise<void> {
  const { teacher, runId, api, backendUrl } = ctx;

  const course = await createCourseWithPromo(backendUrl, teacher.accessToken, {
    title: `E2E Catalog Course ${runId}`,
    description: 'Seeded by the Playwright e2e suite for the catalog/course-detail specs. Not a real course.',
    price: '99900',
    category: 'development',
  });

  const courseModule = await api.createModule(teacher.accessToken, course._id, {
    title: 'Getting started',
    description: 'Seeded module.',
  });

  const freeLecture = await api.createLecture(
    teacher.accessToken,
    course._id,
    courseModule._id,
    { title: 'Welcome — free preview' },
    path.join(ASSETS_DIR, 'placeholder-lecture.mp4')
  );
  await setLectureFreePreview(backendUrl, teacher.accessToken, course._id, courseModule._id, freeLecture._id);

  // A second, non-preview lecture so the curriculum accordion has a locked
  // item to assert against too (course-detail-view.spec.ts: "locked items
  // show no play control").
  await api.createLecture(
    teacher.accessToken,
    course._id,
    courseModule._id,
    { title: 'Locked lecture' },
    path.join(ASSETS_DIR, 'placeholder-lecture.mp4')
  );

  await publishCourse(backendUrl, teacher.accessToken, course._id);

  // A second PUBLISHED course in a second category — the base fixture's own
  // two courses (global-setup.ts) are left DRAFT (they exist for the legacy
  // teacher-authoring specs, not this one) and D2's visibility rule
  // (course.service.js's visibleCourseFilter) correctly excludes a draft
  // from the public catalog, so course-list-navigation.spec.ts's
  // category-switch test needs its own second category to switch to rather
  // than relying on courses seeded elsewhere.
  const secondCourse = await createCourseWithPromo(backendUrl, teacher.accessToken, {
    title: `E2E Catalog Course 2 ${runId}`,
    description: 'Seeded by the Playwright e2e suite for the category-switch test. Not a real course.',
    price: '59900',
    category: 'business',
  });
  await publishCourse(backendUrl, teacher.accessToken, secondCourse._id);

  writeSeedOutput('catalog', {
    courseId: course._id,
    courseTitle: course.title,
    category: 'development',
    moduleId: courseModule._id,
    freeLectureId: freeLecture._id,
    secondCourseId: secondCourse._id,
    secondCategory: 'business',
  });
}
