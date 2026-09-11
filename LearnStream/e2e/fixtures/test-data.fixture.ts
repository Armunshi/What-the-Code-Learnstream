import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base } from './network-logger.fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../.auth');

export interface Credentials {
  name: string;
  email: string;
  password: string;
}

export interface TestData {
  courseId: string;
  moduleId: string;
  lectureId: string;
  lecture2Id: string;
  teacher: Credentials;
  student: Credentials;
}

export const test = base.extend<{ testData: TestData }>({
  testData: async ({}, use) => {
    const raw = fs.readFileSync(path.join(AUTH_DIR, 'test-data.json'), 'utf-8');
    await use(JSON.parse(raw) as TestData);
  },
});

export { expect } from '@playwright/test';
