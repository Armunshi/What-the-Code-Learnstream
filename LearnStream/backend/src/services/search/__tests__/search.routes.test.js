import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../../app.js";
import { Courses } from "../../../models/course.model.js";
import { SearchEvent } from "../../../models/searchEvent.model.js";
import { COURSE_STATUS } from "../../../config/courseLifecycle.js";
import { createTeacher } from "../../../../tests/helpers.js";

// Route-level coverage for the 6 W1-SRC endpoints (plan §W1-SRC "Tests:").
// Colocated under services/search/__tests__ (not backend/tests/) because
// docs/lanes/src.json's ownership manifest grants "backend/src/services/
// search/**" but no backend/tests/** glob — same gap REV's own
// reviews.routes.test.js flags (see this lane's final report for the
// amendment).
//
// Every fixture course here is created directly via Courses.create with the
// full set of search-relevant fields (level/language/topics/stats/...) —
// there is no instructor-facing endpoint anywhere in the merged codebase yet
// that lets a caller set those fields (also flagged in the final report),
// so a route-level unit test has no API path to seed through either.
let seq = 0;
const uniqueTitle = (label) => `${label} ${Date.now()}-${seq++}`;

async function publishedCourse(teacher, overrides = {}) {
    return Courses.create({
        title: overrides.title ?? uniqueTitle("Course"),
        subtitle: overrides.subtitle,
        description: overrides.description ?? "A seeded test course.",
        price: overrides.price ?? 0,
        author: teacher._id,
        category: overrides.category ?? "development",
        subcategory: overrides.subcategory ?? "web-development",
        topics: overrides.topics ?? ["javascript"],
        level: overrides.level ?? "beginner",
        language: overrides.language ?? "en",
        isCertificationPrep: overrides.isCertificationPrep ?? false,
        thumbnail: "https://example.com/thumb.jpg",
        status: COURSE_STATUS.PUBLISHED,
        publishedAt: overrides.publishedAt ?? new Date(),
        stats: {
            totalDurationSec: overrides.totalDurationSec ?? 3600,
            captionLanguages: overrides.captionLanguages ?? [],
            practiceTypes: overrides.practiceTypes ?? [],
            ratingAvg: overrides.ratingAvg ?? 0,
            ratingCount: overrides.ratingCount ?? 0,
            enrollmentCount: overrides.enrollmentCount ?? 0,
        },
    });
}

describe("GET /courses/search — matching and relevance", () => {
    it("escapes regex-special characters in the query instead of crashing", async () => {
        const teacher = await createTeacher();
        await publishedCourse(teacher, { title: "C++ (Advanced).*" });

        const res = await request(app).get("/courses/search").query({ q: "c++ (advanced).*" });
        expect(res.status).toBe(200);
        expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it("ranks a title match above a description-only match", async () => {
        const teacher = await createTeacher();
        await publishedCourse(teacher, { title: "React Fundamentals", description: "Learn to build apps" });
        await publishedCourse(teacher, { title: "Backend Basics", description: "Uses react under the hood" });

        const res = await request(app).get("/courses/search").query({ q: "react" });
        expect(res.status).toBe(200);
        expect(res.body.data.items[0].title).toBe("React Fundamentals");
    });

    it("each sort option changes the ordering", async () => {
        const teacher = await createTeacher();
        await publishedCourse(teacher, {
            title: "Sort Alpha Course",
            ratingAvg: 4.9,
            ratingCount: 5,
            publishedAt: new Date("2020-01-01"),
        });
        await publishedCourse(teacher, {
            title: "Sort Beta Course",
            ratingAvg: 3.0,
            ratingCount: 500,
            publishedAt: new Date("2026-01-01"),
        });

        const byRating = await request(app).get("/courses/search").query({ q: "sort", sort: "highest_rated" });
        expect(byRating.body.data.items[0].title).toBe("Sort Alpha Course");

        const byReviewed = await request(app).get("/courses/search").query({ q: "sort", sort: "most_reviewed" });
        expect(byReviewed.body.data.items[0].title).toBe("Sort Beta Course");

        const byNewest = await request(app).get("/courses/search").query({ q: "sort", sort: "newest" });
        expect(byNewest.body.data.items[0].title).toBe("Sort Beta Course");
    });

    it("facet counts are disjunctive — a group's own filter never restricts its own counts", async () => {
        const teacher = await createTeacher();
        await publishedCourse(teacher, { title: "Facet English Beginner", language: "en", level: "beginner" });
        await publishedCourse(teacher, { title: "Facet Hindi Beginner", language: "hi", level: "beginner" });
        await publishedCourse(teacher, { title: "Facet English Advanced", language: "en", level: "advanced" });

        // Filtering by level=beginner must still report BOTH languages in the
        // lang facet (disjunctive on lang's own group), but filtering by
        // lang=en must reduce the level facet to only levels that appear
        // among English courses.
        const res = await request(app).get("/courses/search").query({ q: "facet", level: "beginner" });
        expect(res.status).toBe(200);
        expect(res.body.data.facets.lang.en).toBe(1);
        expect(res.body.data.facets.lang.hi).toBe(1);
        // The level facet is excluded from its own group's filter, so it
        // reflects all 3 facet-query courses regardless of the level=beginner
        // filter applied to everything else. "advanced" is folded into the
        // "all" filter option (config/search.js's levelFilterToModelLevels —
        // the UI's third level checkbox is "all (advanced)").
        expect(res.body.data.facets.level.beginner).toBe(2);
        expect(res.body.data.facets.level.all).toBe(1);
    });

    it("a zero-result strict match falls back to a relaxed any-token match and flags relaxed:true", async () => {
        const teacher = await createTeacher();
        await publishedCourse(teacher, { title: "Python Django", topics: ["python"] });

        // No single course has both "python" and "zzzznomatch" — strict
        // (all tokens) should fail, relaxed (any token) should still find it.
        const res = await request(app).get("/courses/search").query({ q: "python zzzznomatch" });
        expect(res.status).toBe(200);
        expect(res.body.data.relaxed).toBe(true);
        expect(res.body.data.items.some((i) => i.title === "Python Django")).toBe(true);
    });

    it("spotlight is null when nothing scores above the threshold", async () => {
        const teacher = await createTeacher();
        // Only a weak description-only match (+2) — well under SPOTLIGHT_MIN_SCORE.
        await publishedCourse(teacher, {
            title: "Unrelated Title",
            description: "mentions zzzzspotlightprobe once",
        });

        const res = await request(app).get("/courses/search").query({ q: "zzzzspotlightprobe" });
        expect(res.status).toBe(200);
        expect(res.body.data.spotlight).toBeNull();
    });

    it("spotlight appears for a clear, unambiguous winner", async () => {
        const teacher = await createTeacher();
        await publishedCourse(teacher, { title: "Spotlight Winner Course" });
        await publishedCourse(teacher, { title: "Completely unrelated" });

        const res = await request(app).get("/courses/search").query({ q: "Spotlight Winner Course" });
        expect(res.status).toBe(200);
        expect(res.body.data.spotlight).not.toBeNull();
        expect(res.body.data.spotlight.title).toBe("AI Overview");
        expect(res.body.data.spotlight.course.title).toBe("Spotlight Winner Course");
    });
});

describe("GET /courses/search/suggest", () => {
    it("a 1-character query returns suggestions without erroring", async () => {
        const teacher = await createTeacher();
        await publishedCourse(teacher, { title: "Python for Everyone" });

        const res = await request(app).get("/courses/search/suggest").query({ q: "p" });
        expect(res.status).toBe(200);
        expect(res.body.data.courses.length).toBeGreaterThanOrEqual(1);
    });

    it("caps courses at 3", async () => {
        const teacher = await createTeacher();
        for (let i = 0; i < 5; i++) {
            await publishedCourse(teacher, { title: `Suggest Cap Course ${i}` });
        }
        const res = await request(app).get("/courses/search/suggest").query({ q: "suggest cap" });
        expect(res.body.data.courses.length).toBeLessThanOrEqual(3);
    });
});

describe("GET /courses/search/trending", () => {
    it("excludes zero-result and denylisted queries", async () => {
        const now = new Date();
        const sessions = ["s1", "s2", "s3"];
        for (const sessionId of sessions) {
            await SearchEvent.create({ q: "legit trending query", resultCount: 5, sessionId, at: now });
            await SearchEvent.create({ q: "zero result query", resultCount: 0, sessionId, at: now });
            await SearchEvent.create({ q: "test", resultCount: 5, sessionId, at: now }); // denylisted
        }

        const res = await request(app).get("/courses/search/trending");
        expect(res.status).toBe(200);
        expect(res.body.data.queries).toContain("legit trending query");
        expect(res.body.data.queries).not.toContain("zero result query");
        expect(res.body.data.queries).not.toContain("test");
    });
});

describe("GET /courses/search/related", () => {
    it("surfaces a co-occurring query from the same session", async () => {
        const now = new Date();
        await SearchEvent.create({ q: "react hooks", resultCount: 3, sessionId: "co-1", at: now });
        await SearchEvent.create({
            q: "react context api",
            resultCount: 2,
            sessionId: "co-1",
            at: new Date(now.getTime() + 60_000),
        });

        const res = await request(app).get("/courses/search/related").query({ q: "react hooks" });
        expect(res.status).toBe(200);
        expect(res.body.data.queries).toContain("react context api");
    });
});

describe("POST /courses/search/events", () => {
    it("logs the event and responds 204", async () => {
        const res = await request(app)
            .post("/courses/search/events")
            .send({ q: "event logging test", resultCount: 3, sessionId: "evt-1" });
        expect(res.status).toBe(204);

        const logged = await SearchEvent.findOne({ q: "event logging test" });
        expect(logged).not.toBeNull();
        expect(logged.sessionId).toBe("evt-1");
    });
});
