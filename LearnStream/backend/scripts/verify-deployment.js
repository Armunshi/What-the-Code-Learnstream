// Post-deploy smoke check. Asks the deployed backend whether each fix from
// B1-B5 actually shipped, rather than trusting that a push means a deploy.
//
//   node scripts/verify-deployment.js                      # checks production
//   node scripts/verify-deployment.js http://localhost:8000 # or any origin
//
// Exits non-zero if any check fails.
//
// Written because production was found running pre-B1 code long after the
// fixes were merged: §1.1 was still answering 200 with public_id on a public
// URL. A green local suite says nothing about what is actually deployed.

const BASE = (process.argv[2] || "https://whathecode-learnstream.onrender.com").replace(/\/$/, "");

// A course id that exists in this database, from the original §1.1 finding.
const COURSE_ID = "678bf0eb072334a2221207fa";
// An email known to exist. Probed with a deliberately wrong password, so a 401
// means "found the user" and a 404 means "cannot see the users collection".
const KNOWN_EMAIL = "12@12.com";

// Render free tier cold-starts can take ~35s.
const TIMEOUT_MS = 90_000;

let failures = 0;
let warnings = 0;

const pass = (label, detail = "") => console.log(`ok    ${label}${detail ? ` — ${detail}` : ""}`);
const fail = (label, detail = "") => { failures++; console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const warn = (label, detail = "") => { warnings++; console.log(`warn  ${label}${detail ? ` — ${detail}` : ""}`); };

async function req(path, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* HTML or empty */ }
        return { status: res.status, text, json };
    } catch (error) {
        return { status: 0, text: String(error.message), json: null };
    } finally {
        clearTimeout(timer);
    }
}

async function main() {
    console.log(`Verifying ${BASE}\n`);

    // --- reachable at all ---
    const health = await req("/courses/getallCourses");
    if (health.status === 200) pass("backend is up", "/courses/getallCourses 200");
    else { fail("backend is up", `got ${health.status || "no response"}`); return; }

    // --- B1 §1.1: paid content must not be readable unauthenticated ---
    const modules = await req(`/courses/${COURSE_ID}/modules`);
    if (modules.status === 401) {
        pass("§1.1 unauthenticated course modules refused", "401");
    } else if (modules.status === 200) {
        const leaks = modules.text.includes("public_id");
        fail("§1.1 unauthenticated course modules refused",
             `got 200${leaks ? " AND the body contains public_id — the bypass is live" : ""}`);
    } else {
        warn("§1.1 unauthenticated course modules refused", `got ${modules.status}, expected 401`);
    }

    // --- B2 §2.1: errors must be JSON, not HTML with a stack ---
    const badId = await req("/courses/not-a-valid-objectid");
    if (badId.json && typeof badId.json.statusCode === "number" && "success" in badId.json) {
        pass("§2.1 errors return the JSON envelope", `${badId.status}`);
    } else {
        fail("§2.1 errors return the JSON envelope",
             badId.text.trim().startsWith("<") ? "got an HTML error page — pre-B2 build" : `got ${badId.status}`);
    }

    // --- B4 §2.8: the webhook route must exist ---
    const webhook = await req("/payment/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": "probe" },
        body: "{}",
    });
    if (webhook.status === 404) {
        fail("§2.8 /payment/webhook exists", "404 — B4 is not deployed");
    } else if (webhook.json?.message === "Webhook is not configured") {
        pass("§2.8 /payment/webhook exists", "refusing correctly — RAZORPAY_WEBHOOK_SECRET not set yet");
    } else {
        pass("§2.8 /payment/webhook exists", `${webhook.status} ${webhook.json?.message ?? ""}`.trim());
    }

    // --- B5.6: the unified users collection must be what serves logins ---
    const login = await req("/user/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: KNOWN_EMAIL, password: "deliberately-wrong-probe" }),
    });
    if (login.status === 401) {
        pass("login finds users", "401 for a wrong password on a known email");
    } else if (login.status === 404) {
        fail("login finds users",
             "404 for a known email — the user collection this build reads is empty or missing");
    } else {
        warn("login finds users", `got ${login.status}, expected 401`);
    }

    // --- B4 §2.7: prices are integer paise (the API's half of the contract) ---
    const courses = health.json?.data ?? [];
    const fractional = courses.filter((c) => !Number.isInteger(c.price));
    if (courses.length === 0) warn("§2.7 prices are integer paise", "no courses returned");
    else if (fractional.length) fail("§2.7 prices are integer paise", `${fractional.length} non-integer`);
    else pass("§2.7 prices are integer paise", `${courses.length} courses, e.g. ${courses[0].price}`);

    console.log(
        `\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}` +
        `${warnings ? ` ${warnings} warning(s).` : ""}`
    );
    process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
    console.error("verification could not run:", error.message);
    process.exitCode = 1;
});
