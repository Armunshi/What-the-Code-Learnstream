// LEARN's own seed data (docs/lanes/learn.json's "appends" glob), added on
// top of the base fixture's course/module without touching global-setup.ts
// or lib/seed-registry.ts.
//
// The backend's MEDIA_PROVIDER=fake in e2e produces non-resolvable
// `https://fake-media.test/<uuid>` urls, so a video item authored through
// the normal upload pipeline can never actually play in a real browser here.
// Instead this embeds a real, tiny (3.3KB), exactly-4-second mp4 (blue
// 64x64, silent audio, baseline H.264, generated once via ffmpeg — not at
// runtime) directly as a `data:` URI, so LecturePlayer's <video> element has
// something genuinely decodable to load and drive playback/heartbeat tests
// against. The caption track is a plain-text VTT, also inlined as a `data:`
// URI for the same reason (no committed asset file needed, and this lane
// doesn't own e2e/fixtures/assets/ anyway).
import type { SeedCtx } from '../lib/seed-registry.js';
import { writeSeedOutput } from '../lib/seed-registry.js';

const TINY_4S_MP4_BASE64 =
  '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';

const TINY_4S_MP4_DATA_URL = `data:video/mp4;base64,${TINY_4S_MP4_BASE64}`;

const CAPTION_VTT = `WEBVTT

00:00:00.000 --> 00:00:02.000
Hello and welcome to this lecture.

00:00:02.000 --> 00:00:04.000
This is the second line of the transcript.
`;

const CAPTION_VTT_DATA_URL = `data:text/vtt;charset=utf-8,${encodeURIComponent(CAPTION_VTT)}`;

const ARTICLE_BODY = `# E2E Learn Article

This is a short article item seeded for the learn lane's e2e coverage.

It has enough content to exercise the article renderer and its
completion button without needing any real authoring endpoint.
`;

interface TestItemResponse {
  itemId: string;
}

async function createTestItem(backendUrl: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${backendUrl}/test/learn/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data: TestItemResponse; message?: string };
  if (!res.ok) {
    throw new Error(`POST /test/learn/items -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
  return json.data.itemId;
}

async function attachCaption(backendUrl: string, itemId: string): Promise<void> {
  const res = await fetch(`${backendUrl}/test/learn/items/${itemId}/captions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang: 'en',
      label: 'English',
      url: CAPTION_VTT_DATA_URL,
      isDefault: true,
      transcriptText: 'Hello and welcome to this lecture. This is the second line of the transcript.',
    }),
  });
  const json = (await res.json()) as { message?: string };
  if (!res.ok) {
    throw new Error(`POST /test/learn/items/${itemId}/captions -> ${res.status}: ${json.message ?? 'unknown error'}`);
  }
}

export async function seed(ctx: SeedCtx): Promise<void> {
  const videoItemId = await createTestItem(ctx.backendUrl, {
    courseId: ctx.course.id,
    sectionId: ctx.course.moduleId,
    type: 'video',
    title: 'E2E Learn Video',
    durationSec: 4,
    mp4Url: TINY_4S_MP4_DATA_URL,
  });
  await attachCaption(ctx.backendUrl, videoItemId);

  const articleItemId = await createTestItem(ctx.backendUrl, {
    courseId: ctx.course.id,
    sectionId: ctx.course.moduleId,
    type: 'article',
    title: 'E2E Learn Article',
    body: ARTICLE_BODY,
  });

  writeSeedOutput('learn', { videoItemId, articleItemId });
}
