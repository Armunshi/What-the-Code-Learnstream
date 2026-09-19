// e2e seed registry entry (docs/contracts/registries.md, e2e/lib/seed-registry.ts).
// Builds a PUBLISHED free course and a PUBLISHED paid course for W1-COM's
// specs (guest-cart, free-enrollment, checkout-redirect): com.json's own
// notes require "a free published course" — free-enrollment.spec.ts needs
// one it can enroll into directly, guest-cart.spec.ts and
// checkout-redirect.spec.ts need a paid one to actually cart/checkout.
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

// PATCH /courses/:courseId/status — CAT's own stopgap publish endpoint
// (services/course.service.js, not owned by this lane; see catalog.seed.ts
// for the same call). Not in e2e/lib/api-client.ts yet, so called directly
// here the same way that seed does.
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

  const freeCourse = await api.createCourse(
    teacher.accessToken,
    {
      title: `E2E Commerce Free Course ${runId}`,
      description: 'Seeded by the Playwright e2e suite for the commerce specs. Not a real course.',
      price: '0',
      category: 'commerce-free',
    },
    path.join(ASSETS_DIR, 'placeholder-thumbnail.jpg')
  );
  await publishCourse(backendUrl, teacher.accessToken, freeCourse._id);

  const paidCourse = await api.createCourse(
    teacher.accessToken,
    {
      title: `E2E Commerce Paid Course ${runId}`,
      description: 'Seeded by the Playwright e2e suite for the commerce specs. Not a real course.',
      price: '49900',
      category: 'commerce-paid',
    },
    path.join(ASSETS_DIR, 'placeholder-thumbnail.jpg')
  );
  await publishCourse(backendUrl, teacher.accessToken, paidCourse._id);

  writeSeedOutput('commerce', {
    freeCourseId: freeCourse._id,
    freeCourseTitle: freeCourse.title,
    paidCourseId: paidCourse._id,
    paidCourseTitle: paidCourse.title,
  });
}
