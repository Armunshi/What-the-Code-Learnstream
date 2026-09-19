import { describe, it, expect } from "vitest";
import { escapeRegex, normalizeQuery, tokenize, wordPrefixRegExp } from "../text.js";

describe("search/text — escaping and tokenizing", () => {
    it("escapes regex metacharacters so a malicious/odd query never breaks the pattern", () => {
        const escaped = escapeRegex("c++ (advanced).*");
        expect(() => new RegExp(escaped)).not.toThrow();
        expect(new RegExp(escaped).test("c++ (advanced).*")).toBe(true);
        // Unescaped, ".*" would match anything — escaped, it must match only
        // the literal characters ".*".
        expect(new RegExp(escapeRegex(".*")).test("xyz")).toBe(false);
    });

    it("normalizes case and collapses whitespace", () => {
        expect(normalizeQuery("  React   Hooks  ")).toBe("react hooks");
    });

    it("tokenizes on non-alphanumeric separators", () => {
        expect(tokenize("React, Hooks & State!")).toEqual(["react", "hooks", "state"]);
    });

    it("wordPrefixRegExp matches a word-prefix, not a mid-word substring", () => {
        const re = wordPrefixRegExp("rea");
        expect(re.test("React basics")).toBe(true);
        expect(re.test("A great React course")).toBe(true);
        expect(re.test("Korean cuisine")).toBe(false);
    });
});
