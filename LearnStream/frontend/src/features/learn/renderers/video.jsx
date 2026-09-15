import { LecturePlayer } from "../components/LecturePlayer";

// Video never accepts a manual "mark complete" — the backend rejects it
// (D5: auto-completes at 90% watched via the heartbeat instead), so this
// renderer ignores the shared `onComplete` prop other renderers use.
export default {
  type: "video",
  Component: function VideoRenderer({ courseId, item, completed, onCompleted, onEnded }) {
    return (
      <LecturePlayer
        courseId={courseId}
        item={item}
        completed={completed}
        onCompleted={onCompleted}
        onEnded={onEnded}
      />
    );
  },
};
