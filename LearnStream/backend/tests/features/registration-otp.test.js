import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { PendingRegistration } from "../../src/models/pendingRegistration.model.js";

// mail.service's real transport (jsonTransport in test/dev) never hits the
// network, but mocking sendOtpMail is what lets these tests read the OTP
// code back — the 202/resend responses deliberately never include it
// (docs/contracts/api-conventions.md), the same as a real inbox.
vi.mock("../../src/services/mail.service.js", () => ({
  sendOtpMail: vi.fn(async () => {}),
}));

import { sendOtpMail } from "../../src/services/mail.service.js";

function lastSentCode() {
  const calls = sendOtpMail.mock.calls;
  return calls[calls.length - 1][0].code;
}

const creds = () => ({
  name: "OTP Student",
  email: `otp-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  password: "Passw0rd1",
});

beforeEach(() => {
  sendOtpMail.mockClear();
});

describe("POST /user/student/signup (OTP flow)", () => {
  it("returns 202 with no session and creates a pendingRegistration, not a User", async () => {
    const body = creds();
    const res = await request(app).post("/user/student/signup").send(body);

    expect(res.status).toBe(202);
    expect(res.body.data.email).toBe(body.email);
    expect(res.body.data.expiresAt).toBeTruthy();
    expect(res.body.data.resendAvailableAt).toBeTruthy();
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(res.body.data.accessToken).toBeUndefined();

    const user = await User.findOne({ email: body.email });
    expect(user).toBeNull();
    const pending = await PendingRegistration.findOne({ email: body.email });
    expect(pending).not.toBeNull();
    expect(pending.role).toBe("student");
  });

  it("409s a duplicate email that already belongs to a verified User", async () => {
    const body = creds();
    await User.create({ name: body.name, email: body.email, password: body.password, role: "student" });

    const res = await request(app).post("/user/student/signup").send(body);
    expect(res.status).toBe(409);
    expect(res.body.errors).toEqual([{ field: "email", code: "EMAIL_EXISTS" }]);
  });
});

describe("POST /auth/register/verify", () => {
  it("creates the User and a session on a correct code", async () => {
    const body = creds();
    await request(app).post("/user/student/signup").send(body);
    const code = lastSentCode();

    const res = await request(app).post("/auth/register/verify").send({ email: body.email, code });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(body.email);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeTruthy();

    const user = await User.findOne({ email: body.email });
    expect(user.emailVerifiedAt).toBeTruthy();
    expect(await user.isPasswordCorrect(body.password)).toBe(true);
    expect(await PendingRegistration.findOne({ email: body.email })).toBeNull();
  });

  it("404s a code for an email with no pending signup", async () => {
    const res = await request(app)
      .post("/auth/register/verify")
      .send({ email: "nobody@example.com", code: "123456" });
    expect(res.status).toBe(404);
  });

  it("rejects an incorrect code without creating a session, and deletes the pending record after 5 failures", async () => {
    const body = creds();
    await request(app).post("/user/student/signup").send(body);

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post("/auth/register/verify")
        .send({ email: body.email, code: "000000" });
      expect(res.status).toBe(400);
    }
    expect(await User.findOne({ email: body.email })).toBeNull();
    expect((await PendingRegistration.findOne({ email: body.email })).failedAttempts).toBe(4);

    // 5th failure deletes the record entirely (plan: "after 5 failed
    // attempts the pending record is deleted").
    const finalRes = await request(app)
      .post("/auth/register/verify")
      .send({ email: body.email, code: "000000" });
    expect(finalRes.status).toBe(410);
    expect(await PendingRegistration.findOne({ email: body.email })).toBeNull();

    // The real code no longer verifies — there's nothing left to verify against.
    const code = lastSentCode();
    const afterDelete = await request(app).post("/auth/register/verify").send({ email: body.email, code });
    expect(afterDelete.status).toBe(404);
  });

  it("expires the code after otpExpiresAt and deletes the pending record", async () => {
    const body = creds();
    await request(app).post("/user/student/signup").send(body);
    const code = lastSentCode();

    await PendingRegistration.updateOne(
      { email: body.email },
      { $set: { otpExpiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await request(app).post("/auth/register/verify").send({ email: body.email, code });
    expect(res.status).toBe(410);
    expect(await PendingRegistration.findOne({ email: body.email })).toBeNull();
  });
});

describe("POST /auth/register/resend", () => {
  it("429s a resend attempted under the 30s cooldown", async () => {
    const body = creds();
    await request(app).post("/user/student/signup").send(body);

    const res = await request(app).post("/auth/register/resend").send({ email: body.email });
    expect(res.status).toBe(429);
  });

  it("sends a new code and resets the 15-minute expiry once the cooldown has passed", async () => {
    const body = creds();
    await request(app).post("/user/student/signup").send(body);
    const firstCode = lastSentCode();

    await PendingRegistration.updateOne(
      { email: body.email },
      { $set: { resendAvailableAt: new Date(Date.now() - 1000) } }
    );

    const res = await request(app).post("/auth/register/resend").send({ email: body.email });
    expect(res.status).toBe(200);

    const secondCode = lastSentCode();
    expect(secondCode).not.toBe(firstCode);

    // The old code no longer verifies; the new one does.
    const oldCodeRes = await request(app)
      .post("/auth/register/verify")
      .send({ email: body.email, code: firstCode });
    expect(oldCodeRes.status).toBe(400);

    const newCodeRes = await request(app)
      .post("/auth/register/verify")
      .send({ email: body.email, code: secondCode });
    expect(newCodeRes.status).toBe(201);
  });

  it("429s once the maximum of 5 sends is reached", async () => {
    const body = creds();
    await request(app).post("/user/student/signup").send(body); // send #1

    for (let i = 0; i < 3; i++) {
      await PendingRegistration.updateOne(
        { email: body.email },
        { $set: { resendAvailableAt: new Date(Date.now() - 1000) } }
      );
      const res = await request(app).post("/auth/register/resend").send({ email: body.email });
      expect(res.status).toBe(200); // sends #2-4
    }

    await PendingRegistration.updateOne(
      { email: body.email },
      { $set: { resendAvailableAt: new Date(Date.now() - 1000) } }
    );
    const fifthRes = await request(app).post("/auth/register/resend").send({ email: body.email }); // send #5
    expect(fifthRes.status).toBe(200);

    await PendingRegistration.updateOne(
      { email: body.email },
      { $set: { resendAvailableAt: new Date(Date.now() - 1000) } }
    );
    const sixthRes = await request(app).post("/auth/register/resend").send({ email: body.email });
    expect(sixthRes.status).toBe(429);
  });
});

describe("GET /auth/email-available", () => {
  it("reports an existing verified User's email as unavailable", async () => {
    const body = creds();
    await User.create({ name: body.name, email: body.email, password: body.password, role: "student" });

    const res = await request(app).get("/auth/email-available").query({ email: body.email });
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
  });

  it("reports a fresh email as available", async () => {
    const res = await request(app).get("/auth/email-available").query({ email: "fresh@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
  });
});

describe("PATCH /users/me/onboarding", () => {
  it("updates phone, interests and the dismissed flag for the authenticated user", async () => {
    const body = creds();
    await request(app).post("/user/student/signup").send(body);
    const code = lastSentCode();
    const verifyRes = await request(app).post("/auth/register/verify").send({ email: body.email, code });
    const token = verifyRes.body.data.accessToken;

    const res = await request(app)
      .patch("/users/me/onboarding")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "+919876543210", interests: ["design", "music"], dismissed: true });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe("+919876543210");
    expect(res.body.data.interests).toEqual(["design", "music"]);
    expect(res.body.data.onboarding.dismissed).toBe(true);
  });

  it("401s without a token", async () => {
    const res = await request(app).patch("/users/me/onboarding").send({ dismissed: true });
    expect(res.status).toBe(401);
  });
});
