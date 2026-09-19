import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    // mongodb-memory-server downloads/boots a real mongod the first time;
    // generous timeouts so a cold cache doesn't flake the suite.
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
