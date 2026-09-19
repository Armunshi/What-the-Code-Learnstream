import { useEffect, useMemo } from 'react';
import { useUploadQueueStore, isBlocking } from './uploadQueueStore';

/**
 * D4's `useUploadsBlocking()` — true while any tracked upload is still
 * transferring or waiting on its transcode. A consumer (the Publish button,
 * a navigation guard) uses this to stop a teacher from publishing or
 * leaving a course while an upload it's referencing hasn't actually landed
 * yet.
 *
 * Also attaches its own `beforeunload` listener while blocking is true, so
 * a tab close/refresh during an active upload gets the browser's native
 * "leave site?" prompt even before any authoring-layout navigation guard
 * exists to ask the same question in-app (that part is Wave 2/CURR's job,
 * once there's an actual authoring layout to wire it into).
 */
export function useUploadsBlocking() {
  const blocking = useUploadQueueStore((state) => Object.values(state.uploads).some(isBlocking));
  const blockingKeys = useUploadQueueStore((state) =>
    Object.values(state.uploads)
      .filter(isBlocking)
      .map((entry) => entry.key)
  );

  useEffect(() => {
    if (!blocking) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [blocking]);

  return useMemo(() => ({ blocking, blockingKeys }), [blocking, blockingKeys]);
}

export default useUploadsBlocking;
