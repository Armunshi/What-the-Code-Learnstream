import dotenv from "dotenv";
import path from "path";

// Populates process.env from .env.test BEFORE any test file imports app.js
// (and therefore config/env.js). config/env.js's own dotenv.config() call
// never overwrites values already in process.env, so this wins.
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

import { beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Mocked at the SDK boundary (BACKEND_AUDIT.md §9.1) — tests must never call
// the real Cloudinary/Razorpay APIs (cost, flakiness, real credentials in
// CI), but controller/service logic around them still runs for real.
vi.mock("cloudinary", () => ({
  v2: {
    config: () => {},
    uploader: {
      upload: async () => ({ secure_url: "https://example.com/mock.jpg", public_id: "mock_public_id" }),
      destroy: async () => ({ result: "ok" }),
    },
  },
}));

vi.mock("razorpay", () => {
  class MockRazorpay {
    orders = { create: async (options) => ({ id: "order_mock_id", amount: options.amount, currency: options.currency }) };
    payments = { fetch: async () => ({ status: "captured" }) };
    static validateWebhookSignature = () => true;
  }
  return { default: MockRazorpay };
});

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

// A real, ephemeral MongoDB per test run (BACKEND_AUDIT.md §9.1) rather than a
// hand-rolled mock — exercises actual Mongoose schema validation and query
// behavior, with zero risk of touching the real Atlas cluster.
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
