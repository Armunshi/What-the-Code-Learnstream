import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Frozen signature (docs/contracts/stubs.md). Native <video> plus a lazily
// imported hls.js — used unmodified by the course-page trailer dialog (CAT),
// the learn player (LEARN), and course preview (PREV). Deliberately free of
// any feature-specific logic: no captions UI, no speed menu, no transcript.
// Those are built as siblings around this component by later lanes, not
// inside it, so this stays a single shared seam instead of forking per
// feature.
export const VideoPlayer = forwardRef(function VideoPlayer(
  {
    src,
    poster,
    tracks = [],
    playbackRate = 1,
    startAt = 0,
    onTimeUpdate,
    onEnded,
    onPlay,
    onPause,
    onRateChange,
    videoRef,
  },
  forwardedRef
) {
  const internalRef = useRef(null);
  const hlsRef = useRef(null);

  // Expose the underlying <video> element both via the `videoRef` prop
  // (frozen contract) and any ref forwarded through the component itself.
  useImperativeHandle(videoRef, () => internalRef.current, []);
  useImperativeHandle(forwardedRef, () => internalRef.current, []);

  const hlsUrl = src?.hlsUrl;
  const mp4Url = src?.mp4Url;

  useEffect(() => {
    const video = internalRef.current;
    if (!video || !hlsUrl) return undefined;

    // Safari/iOS play HLS natively — only reach for hls.js when the browser
    // can't. The dynamic import keeps hls.js (a non-trivial chunk) out of
    // every page that merely imports VideoPlayer but never plays an HLS
    // source.
    const canPlayNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    if (canPlayNativeHls) {
      video.src = hlsUrl;
      return undefined;
    }

    let cancelled = false;

    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (mp4Url) video.src = mp4Url;
        return;
      }
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    });

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl, mp4Url]);

  useEffect(() => {
    const video = internalRef.current;
    if (video && video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const video = internalRef.current;
    if (video && startAt > 0) {
      video.currentTime = startAt;
    }
    // Only seek once on mount for a given source — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsUrl, mp4Url]);

  return (
    <video
      ref={internalRef}
      poster={poster}
      // Fall back to a direct mp4 src when there's no HLS URL at all.
      src={!hlsUrl ? mp4Url : undefined}
      controls
      playsInline
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
      onPlay={onPlay}
      onPause={onPause}
      onRateChange={onRateChange}
      className="h-full w-full bg-black"
    >
      {tracks.map((track) => (
        <track
          key={track.url || track.src || track.lang}
          kind={track.kind || 'captions'}
          src={track.url || track.src}
          srcLang={track.lang}
          label={track.label}
          default={track.isDefault}
        />
      ))}
    </video>
  );
});

export default VideoPlayer;
