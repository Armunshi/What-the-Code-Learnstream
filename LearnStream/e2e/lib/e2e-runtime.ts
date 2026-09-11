// Shared mutable state between global-setup.ts and global-teardown.ts.
// Playwright runs both in the same Node process for one `playwright test`
// invocation, so a module-level singleton survives from setup to teardown
// without needing to round-trip PIDs through disk.
import type { ChildProcess } from 'node:child_process';
import type { MongoMemoryServer } from 'mongodb-memory-server';

interface RuntimeState {
  mongod: MongoMemoryServer | null;
  backendProcess: ChildProcess | null;
}

export const runtime: RuntimeState = {
  mongod: null,
  backendProcess: null,
};
