import { runtime } from './lib/e2e-runtime.js';
import { finalizeRun } from './lib/log-writer.js';

export default async function globalTeardown(): Promise<void> {
  const outPath = finalizeRun();
  console.log(`[e2e teardown] wrote run log: ${outPath}`);

  if (runtime.backendProcess && !runtime.backendProcess.killed) {
    console.log('[e2e teardown] stopping isolated backend...');
    runtime.backendProcess.kill();
  }

  if (runtime.mongod) {
    console.log('[e2e teardown] stopping in-memory MongoDB...');
    await runtime.mongod.stop();
  }

  console.log('[e2e teardown] done — :8000 is free again.');
}
