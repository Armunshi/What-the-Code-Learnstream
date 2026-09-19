// lecture.model.js's own comment says a teacher's transcript upload is
// "plain text/VTT/SRT for now" with no format field recorded anywhere — the
// upload route (POST .../lectures/:lecture_id/transcript) accepts any file
// at all, no extension or MIME check. So format has to be sniffed from the
// content itself, not trusted from a URL extension or a stored field that
// doesn't exist.
const TIMING_LINE = /^((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/;
const SRT_CUE_NUMBER = /^\d+$/;
const INLINE_MARKUP = /<[^>]+>/g;

function timestampToSeconds(raw) {
    const parts = raw.trim().replace(",", ".").split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(parts[0]);
}

export function sniffFormat(text) {
    if (/^\s*WEBVTT/i.test(text)) return "vtt";

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length - 1; i++) {
        if (SRT_CUE_NUMBER.test(lines[i].trim()) && TIMING_LINE.test(lines[i + 1].trim())) {
            return "srt";
        }
    }
    return "txt";
}

// Both VTT and SRT are "blocks separated by a blank line, one of which is a
// timing line" — the only real differences are the WEBVTT header/NOTE/STYLE
// blocks (skipped here because they contain no timing line at all, not
// because we special-case them) and comma vs. dot in the timestamp, which
// timestampToSeconds already normalizes. One parser covers both.
function parseTimedCues(text) {
    const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
    const cues = [];

    for (const block of blocks) {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const timingIndex = lines.findIndex((line) => TIMING_LINE.test(line));
        if (timingIndex === -1) continue; // WEBVTT header, NOTE/STYLE blocks, stray blank blocks

        const match = lines[timingIndex].match(TIMING_LINE);
        const cueText = lines
            .slice(timingIndex + 1)
            .join(" ")
            .replace(INLINE_MARKUP, "")
            .trim();
        if (!cueText) continue;

        cues.push({
            text: cueText,
            startSec: timestampToSeconds(match[1]),
            endSec: timestampToSeconds(match[2]),
        });
    }

    return cues;
}

// Plain text has no cue timing at all — one untimed segment, left for
// chunkSegments.js to split down to size.
function parsePlainText(text) {
    const trimmed = text.trim();
    return trimmed ? [{ text: trimmed, startSec: null, endSec: null }] : [];
}

/** Returns `{ text, startSec, endSec }[]` — startSec/endSec are null for plain text. */
export function parseTranscript(text) {
    const format = sniffFormat(text);
    if (format === "txt") return parsePlainText(text);
    return parseTimedCues(text);
}
