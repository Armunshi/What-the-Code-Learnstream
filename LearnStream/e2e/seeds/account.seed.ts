// docs/lanes/acc.json appends this file to the e2e seed registry
// (e2e/lib/seed-registry.ts) — never edits that file or global-setup.ts.
//
// Gives the base fixture's student a known username via the real PATCH
// /users/me/profile endpoint, so a spec can visit /user/<username> without
// first driving a profile-edit flow itself just to get a stable slug to
// assert against.
import type { SeedCtx } from '../lib/seed-registry.js';
import { writeSeedOutput } from '../lib/seed-registry.js';
import { BACKEND_URL } from '../playwright.config.js';

interface ProfileEnvelope {
  data: { username: string };
}

export async function seed(ctx: SeedCtx): Promise<void> {
  const username = `learner-${ctx.runId}`;

  const res = await fetch(`${BACKEND_URL}/users/me/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.student.accessToken}`,
    },
    body: JSON.stringify({ username }),
  });
  const json = (await res.json()) as ProfileEnvelope;
  if (!res.ok) {
    throw new Error(`PATCH /users/me/profile -> ${res.status}: ${JSON.stringify(json)}`);
  }

  writeSeedOutput('account', {
    username: json.data.username,
    studentEmail: ctx.student.creds.email,
  });
}
