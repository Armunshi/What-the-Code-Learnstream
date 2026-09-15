import { useCallback, useEffect, useRef } from "react";
import { tokenStore } from "@/lib/api/tokenStore";

const HEARTBEAT_INTERVAL_MS = 15_000;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * D5 watch tracking: a heartbeat every 15s, plus on pause/ended/
 * visibilitychange, PUTs {positionSec, watchedDeltaSec, playbackRate} to
 * `/learn/:courseId/items/:itemId/position`. Uses `fetch(..., {keepalive})`
 * rather than axios so a heartbeat fired right as the tab is being hidden
 * or closed still has a chance to reach the server — axios/XHR requests are
 * dropped once the page starts unloading, `fetch` with `keepalive: true`
 * is not.
 *
 * The server does its own delta-capping (elapsed wall time x playback
 * rate) — this hook just reports what the client observed since its own
 * last send, it doesn't need to replicate that cap itself.
 */
export function useWatchHeartbeat({ videoRef, courseId, itemId, enabled, onResult }) {
  const lastPositionRef = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const send = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    const positionSec = video.currentTime;
    const watchedDeltaSec = Math.max(0, positionSec - lastPositionRef.current);
    lastPositionRef.current = positionSec;

    if (watchedDeltaSec <= 0) return;

    try {
      const token = tokenStore.getToken();
      const res = await fetch(
        `${BACKEND_URL}/learn/${courseId}/items/${itemId}/position`,
        {
          method: "PUT",
          keepalive: true,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            positionSec,
            watchedDeltaSec,
            playbackRate: video.playbackRate || 1,
          }),
        }
      );
      if (!res.ok) return;
      const json = await res.json();
      onResultRef.current?.(json.data);
    } catch {
      // A dropped heartbeat isn't worth surfacing to the viewer — the next
      // tick (or the next play session) just resumes reporting from there.
    }
  }, [videoRef, courseId, itemId, enabled]);

  useEffect(() => {
    lastPositionRef.current = 0;
  }, [itemId]);

  useEffect(() => {
    if (!enabled) return undefined;

    const interval = setInterval(send, HEARTBEAT_INTERVAL_MS);
    const video = videoRef.current;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") send();
    };

    video?.addEventListener("pause", send);
    video?.addEventListener("ended", send);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      video?.removeEventListener("pause", send);
      video?.removeEventListener("ended", send);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, send, videoRef]);

  return { sendNow: send };
}
