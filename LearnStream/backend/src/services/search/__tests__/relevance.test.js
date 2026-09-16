import { describe, it, expect } from "vitest";
import { scoreCandidate, compareByRelevance } from "../relevance.js";
import { SCORE } from "../../../config/search.js";

const baseCandidate = {
    title: "React for Beginners",
    subtitle: "Learn the basics",
    description: "A gentle introduction to building UIs",
    topics: ["react", "javascript"],
    categoryLabel: "Web Development",
    authorName: "Jane Doe",
};

describe("search/relevance — scoreCandidate (D6 weights)", () => {
    it("scores a whole-title exact match the highest", () => {
        const score = scoreCandidate({ ...baseCandidate, title: "react for beginners" }, "react for beginners");
        expect(score).toBeGreaterThanOrEqual(SCORE.TITLE_EXACT_PHRASE);
    });

    it("scores a title-prefix match below an exact whole-title match", () => {
        const prefixScore = scoreCandidate(baseCandidate, "React for Beg");
        const exactScore = scoreCandidate({ ...baseCandidate, title: "react for beg" }, "React for Beg");
        expect(prefixScore).toBeLessThan(exactScore);
        expect(prefixScore).toBeGreaterThanOrEqual(SCORE.TITLE_PREFIX);
        expect(prefixScore).toBeLessThan(SCORE.TITLE_EXACT_PHRASE);
    });

    it("adds a flat bonus for a topics match", () => {
        const withTopic = scoreCandidate(baseCandidate, "javascript");
        expect(withTopic).toBeGreaterThanOrEqual(SCORE.TOPICS_MATCH);
    });

    it("adds a flat bonus for an author match", () => {
        const score = scoreCandidate(baseCandidate, "jane");
        expect(score).toBeGreaterThanOrEqual(SCORE.AUTHOR_MATCH);
    });

    it("returns 0 for an empty query", () => {
        expect(scoreCandidate(baseCandidate, "")).toBe(0);
    });

    it("returns 0 when nothing matches", () => {
        expect(scoreCandidate(baseCandidate, "zzzznomatch")).toBe(0);
    });
});

describe("search/relevance — compareByRelevance tie-break", () => {
    it("breaks a score tie by ratingCount, then enrollmentCount", () => {
        const a = { _score: 10, stats: { ratingCount: 5, enrollmentCount: 100 } };
        const b = { _score: 10, stats: { ratingCount: 20, enrollmentCount: 1 } };
        expect(compareByRelevance(a, b)).toBeGreaterThan(0); // b sorts first
    });

    it("prefers a strictly higher score regardless of ratingCount", () => {
        const a = { _score: 100, stats: { ratingCount: 0, enrollmentCount: 0 } };
        const b = { _score: 10, stats: { ratingCount: 999, enrollmentCount: 999 } };
        expect(compareByRelevance(a, b)).toBeLessThan(0); // a sorts first
    });
});
