// Minimal WebVTT cue parser for TranscriptPanel — deliberately dependency-
// free (D5: "the transcript is parsed from VTT with no extra dependency").
// Only reads what the transcript panel needs: start/end times and cue text,
// ignoring cue settings (position, align, ...) and NOTE blocks.

function parseTimestamp(raw) {
  // "00:01:02.345" or "01:02.345"
  const parts = raw.trim().split(":").map(Number);
  let seconds = 0;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    seconds = h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const [m, s] = parts;
    seconds = m * 60 + s;
  }
  return seconds;
}

/** Parses raw VTT text into `[{ start, end, text }]`, sorted by start time. */
export function parseVtt(vttText) {
  if (!vttText) return [];

  const lines = vttText.replace(/\r\n/g, "\n").split("\n");
  const cues = [];
  let current = null;

  for (const line of lines) {
    const cueTimingMatch = line.match(
      /(\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s*-->\s*(\d{1,2}:)?\d{2}:\d{2}\.\d{3}/
    );

    if (cueTimingMatch) {
      const [startRaw, endRaw] = line.split("-->").map((part) => part.trim().split(" ")[0]);
      current = { start: parseTimestamp(startRaw), end: parseTimestamp(endRaw), text: "" };
      cues.push(current);
      continue;
    }

    if (!current) continue; // header, cue id, blank line, or NOTE block
    if (line.trim() === "") {
      current = null;
      continue;
    }
    current.text = current.text ? `${current.text}\n${line.trim()}` : line.trim();
  }

  return cues.sort((a, b) => a.start - b.start);
}
