import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// A single VTT/SRT cue is usually a few words — far too small to embed one
// at a time — while a plain-text/PDF transcript is one giant untimed blob
// far too large to embed as one chunk. So this does two things, not one:
// split anything oversized down (via LangChain's RecursiveCharacterTextSplitter
// — tries paragraph breaks, then lines, then words, then raw characters, in
// that order, which handles PDF-extracted text's paragraph/line structure
// better than a sentence-punctuation-only splitter would), then greedily
// re-merge consecutive pieces up to targetChars. A chunk's startSec/endSec is
// the span of everything merged into it, which is what lets the chat
// assistant cite "this answer comes from 04:12–05:30 of the lecture" later —
// null for chunks with no source timing (plain text, PDF).
const DEFAULT_TARGET_CHARS = 900;
const DEFAULT_MAX_CHARS = 1400;

async function splitOversized(segment, maxChars) {
    if (segment.text.length <= maxChars) return [segment];
    // Constructed per call (not module-scoped) so a caller-supplied maxChars
    // actually takes effect — construction itself is cheap/synchronous.
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: maxChars, chunkOverlap: 0 });
    const pieces = await splitter.splitText(segment.text);
    return pieces.map((piece) => ({ ...segment, text: piece }));
}

/** Returns `{ text, startSec, endSec }[]` chunks, sized for embedding. */
export async function chunkSegments(segments, { targetChars = DEFAULT_TARGET_CHARS, maxChars = DEFAULT_MAX_CHARS } = {}) {
    const split = await Promise.all(segments.map((segment) => splitOversized(segment, maxChars)));
    const normalized = split.flat();

    const chunks = [];
    let current = null;

    for (const segment of normalized) {
        if (!current) {
            current = { ...segment };
            continue;
        }

        const merged = `${current.text} ${segment.text}`;
        if (merged.length <= targetChars) {
            current.text = merged;
            current.endSec = segment.endSec ?? current.endSec;
        } else {
            chunks.push(current);
            current = { ...segment };
        }
    }
    if (current) chunks.push(current);

    return chunks;
}
