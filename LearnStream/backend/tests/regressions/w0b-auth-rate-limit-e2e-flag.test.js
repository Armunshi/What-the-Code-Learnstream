import { describe, it, expect, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// W0-C reported that a full e2e/Playwright run exhausts authLimiter's
// 20-per-15-minutes budget partway through — real logins plus AuthProvider's
// refresh-on-every-mount behavior blow through it, producing a 429 that
// cascades into "Login Failed" and unrelated-looking timeouts in whatever
// spec runs next. This is pre-existing on integration/w0, reproduced with no
// e2e-infra changes involved. middleware/rateLimit.js now skips the limiter
// entirely when E2E_TEST_ROUTES=1 (and not production); this pins down both
// halves of that fix: the flag actually bypasses it, and — just as
// important — leaving the flag off changes nothing about production
// behavior.
//
// Each test dynamically re-imports rateLimit.js after resetting Vitest's
// module registry, because config/env.js computes and freezes `env` once at
// import time — this is the only way to observe two different values of
// E2E_TEST_ROUTES within one test run without spawning a second process.
const buildApp = (authLimiter) => {
    const app = express();
    app.get("/protected", authLimiter, (req, res) => res.status(200).json({ ok: true }));
    app.use((err, req, res, next) => res.status(err.statusCode ?? 500).json({ message: err.message }));
    return app;
};

describe("W0-B fix — authLimiter E2E_TEST_ROUTES escape hatch", () => {
    afterEach(() => {
        delete process.env.E2E_TEST_ROUTES;
        vi.resetModules();
    });

    it("still 429s past the limit when E2E_TEST_ROUTES is off (production behavior unchanged)", async () => {
        delete process.env.E2E_TEST_ROUTES;
        vi.resetModules();
        const { authLimiter } = await import("../../src/middleware/rateLimit.js");
        const app = buildApp(authLimiter);

        const statuses = [];
        for (let i = 0; i < 21; i++) {
            const res = await request(app).get("/protected");
            statuses.push(res.status);
        }

        expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
        expect(statuses[20]).toBe(429);
    });

    it("skips the limiter entirely when E2E_TEST_ROUTES=1", async () => {
        process.env.E2E_TEST_ROUTES = "1";
        vi.resetModules();
        const { authLimiter } = await import("../../src/middleware/rateLimit.js");
        const app = buildApp(authLimiter);

        const statuses = [];
        for (let i = 0; i < 25; i++) {
            const res = await request(app).get("/protected");
            statuses.push(res.status);
        }

        expect(statuses.every((s) => s === 200)).toBe(true);
    });
});
