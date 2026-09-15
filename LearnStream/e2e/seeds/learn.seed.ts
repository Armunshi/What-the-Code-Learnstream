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
