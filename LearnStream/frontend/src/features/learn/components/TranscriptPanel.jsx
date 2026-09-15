import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseVtt } from "../lib/vtt";

/**
 * Fetches and parses the active caption track's VTT (no extra dependency,
 * D5), highlights the cue containing `currentTimeSec`, and seeks the video
 * to a cue's start time on click.
 */
export function TranscriptPanel({ trackUrl, currentTimeSec, onSeek }) {
  const [cues, setCues] = useState([]);

  useEffect(() => {
    if (!trackUrl) {
      setCues([]);
      return undefined;
    }

    let cancelled = false;
    fetch(trackUrl)
      .then((res) => res.text())
      .then((text) => {
        if (!cancelled) setCues(parseVtt(text));
      })
      .catch(() => {
        if (!cancelled) setCues([]);
      });

    return () => {
      cancelled = true;
    };
  }, [trackUrl]);

  if (!trackUrl || cues.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground" data-testid="transcript-empty">
        No transcript available for this lecture.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full" data-testid="transcript-panel">
      <div className="flex flex-col gap-1 p-2">
        {cues.map((cue, index) => {
          const isActive = currentTimeSec >= cue.start && currentTimeSec < cue.end;
          return (
            <button
              key={`${cue.start}-${index}`}
              type="button"
              data-testid="transcript-cue"
              data-active={isActive}
              onClick={() => onSeek(cue.start)}
              className={`rounded px-2 py-1 text-left text-sm ${
                isActive ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
              }`}
            >
              {cue.text}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default TranscriptPanel;
