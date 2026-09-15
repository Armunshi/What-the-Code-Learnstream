import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { Badge } from "@/components/ui/badge";
import { SpeedMenu, getPersistedPlaybackRate } from "./SpeedMenu";
import { CaptionsMenu } from "./CaptionsMenu";
import { TranscriptPanel } from "./TranscriptPanel";
import { useWatchHeartbeat } from "../hooks/useWatchHeartbeat";

/**
 * The video renderer (`renderers/video.jsx` registers this under type
 * "video"). Composes the frozen VideoPlayer stub with the speed/captions
 * menus and the transcript panel — all built as siblings around
 * VideoPlayer, never inside it (stubs.md).
 */
export function LecturePlayer({ courseId, item, completed, onCompleted, onEnded }) {
  const videoRef = useRef(null);
  const [playbackRate, setPlaybackRate] = useState(getPersistedPlaybackRate);
  const [captionLang, setCaptionLang] = useState(
    () => item.media?.captions?.find((c) => c.isDefault)?.lang ?? null
  );
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  useEffect(() => {
    setCaptionLang(item.media?.captions?.find((c) => c.isDefault)?.lang ?? null);
    setCurrentTimeSec(0);
    // Only reset when the item itself changes, not on every caption array
    // identity change from a parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const { sendNow } = useWatchHeartbeat({
    videoRef,
    courseId,
    itemId: item.id,
    enabled: !completed,
    onResult: (result) => {
      if (result?.completed) onCompleted?.();
    },
  });

  const activeTrack = item.media?.captions?.find((c) => c.lang === captionLang) ?? null;
  const tracks = activeTrack ? [{ ...activeTrack, isDefault: true }] : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <VideoPlayer
          videoRef={videoRef}
          src={{ mp4Url: item.media?.mp4Url, hlsUrl: item.media?.hlsUrl }}
          poster={item.media?.posterUrl}
          tracks={tracks}
          playbackRate={playbackRate}
          onTimeUpdate={(e) => setCurrentTimeSec(e.currentTarget.currentTime)}
          onEnded={() => {
            sendNow();
            onEnded?.();
          }}
          onPause={sendNow}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          {completed && <Badge data-testid="item-completed-badge">Completed</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <CaptionsMenu
            captions={item.media?.captions ?? []}
            selectedLang={captionLang}
            onChange={setCaptionLang}
          />
          <SpeedMenu
            playbackRate={playbackRate}
            onChange={(rate) => {
              setPlaybackRate(rate);
              if (videoRef.current) videoRef.current.playbackRate = rate;
            }}
          />
        </div>
      </div>

      <div className="h-48 rounded-lg border">
        <TranscriptPanel
          trackUrl={activeTrack?.url}
          currentTimeSec={currentTimeSec}
          onSeek={(startSec) => {
            if (videoRef.current) videoRef.current.currentTime = startSec;
          }}
        />
      </div>
    </div>
  );
}

export default LecturePlayer;
