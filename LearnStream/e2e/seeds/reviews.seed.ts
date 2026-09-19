// docs/lanes/rev.json appends this file to the e2e seed registry
// (e2e/lib/seed-registry.ts) — never edits that file or global-setup.ts.
//
// Posts one review from the base fixture's already-enrolled student onto
// the base fixture's course, so any spec that needs a non-empty
// CourseReviewsSection / rating-summary doesn't have to seed that data
// itself. A second, unauthenticated caller (student not enrolled in this
// course) isn't seeded here: the base fixture only produces one course and
// one student, and enrolling a second student requires the full signed
// -webhook purchase flow global-setup.ts itself uses — out of scope for a
// single-review fixture. A spec that needs a non-author voter should log in
// as the base teacher (who never voted, and voting on your own review is
// rejected by D7 anyway) or create its own student via ctx.api.
import type { SeedCtx } from '../lib/seed-registry.js';
import { writeSeedOutput } from '../lib/seed-registry.js';
import { BACKEND_URL } from '../playwright.config.js';

interface ReviewEnvelope {
  data: { id: string; rating: number; comment: string };
}

export async function seed(ctx: SeedCtx): Promise<void> {
  const rating = 5;
  const comment = 'Clear explanations and a great pace — exactly what I needed.';

  const res = await fetch(`${BACKEND_URL}/courses/${ctx.course.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.student.accessToken}`,
    },
    body: JSON.stringify({ rating, comment }),
  });
  const json = (await res.json()) as ReviewEnvelope;
  if (!res.ok) {
    throw new Error(`POST /courses/${ctx.course.id}/reviews -> ${res.status}: ${JSON.stringify(json)}`);
  }

  writeSeedOutput('reviews', {
    courseId: ctx.course.id,
    reviewId: json.data.id,
    rating,
    comment,
    authorEmail: ctx.student.creds.email,
  });
}
