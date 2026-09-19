import { create } from 'zustand';
import { signUpload, completeUpload, failUpload } from './api';
import { chunkedUpload } from './chunkedUpload';

// Module-level store (D4 "uploadQueueStore") so MediaUploadField instances
// scattered across an authoring page and the single global UploadTray all
// read the same in-flight state, instead of each field owning an island of
// upload state the tray can't see.
//
// Concurrency 2 (D4): a teacher dropping in five lecture videos at once
// shouldn't saturate their upload bandwidth on one connection per file —
// two run at a time, the rest wait in `_pendingRuns`.
const MAX_CONCURRENT_UPLOADS = 2;

export function uploadKey(courseId, kind, itemId) {
  return `${courseId}:${kind}:${itemId ?? ''}`;
}

export const useUploadQueueStore = create((set, get) => ({
  uploads: {},
  _pendingRuns: [],
  _activeCount: 0,

  /**
   * Starts (or restarts) the upload for one target. Returns the key
   * MediaUploadField should select on to observe this entry's progress.
   */
  startUpload({ courseId, target, file }) {
    const key = uploadKey(courseId, target.kind, target.itemId);
    const controller = new AbortController();

    set((state) => ({
      uploads: {
        ...state.uploads,
        [key]: {
          key,
          courseId,
          target,
          file,
          fileName: file.name,
          status: 'uploading',
          progress: 0,
          error: null,
          controller,
        },
      },
    }));

    const run = async () => {
      try {
        const signed = await signUpload({ courseId, target, file });
        set((state) => ({
          uploads: { ...state.uploads, [key]: { ...state.uploads[key], uploadId: signed.uploadId, publicId: signed.publicId } },
        }));

        await chunkedUpload({
          file,
          courseId,
          target,
          signed,
          signal: controller.signal,
          onProgress: (fraction) => {
            set((state) => {
              const entry = state.uploads[key];
              if (!entry || entry.status !== 'uploading') return state;
              return { uploads: { ...state.uploads, [key]: { ...entry, progress: fraction } } };
            });
          },
        });

        const result = await completeUpload(signed.uploadId, signed.publicId);
        set((state) => {
          const entry = state.uploads[key];
          if (!entry) return state;
          return {
            uploads: {
              ...state.uploads,
              [key]: { ...entry, status: result.status === 'PROCESSING' ? 'processing' : 'ready', progress: 1 },
            },
          };
        });
      } catch (error) {
        const isAbort = error?.name === 'AbortError';
        set((state) => {
          const entry = state.uploads[key];
          if (!entry) return state;
          return {
            uploads: {
              ...state.uploads,
              [key]: {
                ...entry,
                status: isAbort ? 'idle' : 'failed',
                error: isAbort ? null : error?.message ?? 'Upload failed',
              },
            },
          };
        });
        if (!isAbort) {
          const uploadId = get().uploads[key]?.uploadId;
          if (uploadId) {
            await failUpload(uploadId, { message: error?.message }).catch(() => {});
          }
        }
      }
    };

    get()._enqueue(run);
    return key;
  },

  /** Cancels an in-flight ("uploading") transfer. A no-op once it's PROCESSING/READY server-side. */
  cancelUpload(key) {
    get().uploads[key]?.controller?.abort();
  },

  /** Called once useMediaStatus confirms an item this store thought was PROCESSING has reached READY/FAILED. */
  syncStatus(key, status) {
    set((state) => {
      const entry = state.uploads[key];
      if (!entry) return state;
      return { uploads: { ...state.uploads, [key]: { ...entry, status } } };
    });
  },

  /** Drops a terminal (ready/failed/idle) entry from the tray. */
  dismiss(key) {
    set((state) => {
      const uploads = { ...state.uploads };
      delete uploads[key];
      return { uploads };
    });
  },

  _enqueue(run) {
    set((state) => ({ _pendingRuns: [...state._pendingRuns, run] }));
    get()._runNext();
  },

  _runNext() {
    const state = get();
    if (state._activeCount >= MAX_CONCURRENT_UPLOADS) return;
    const [next, ...rest] = state._pendingRuns;
    if (!next) return;
    set({ _pendingRuns: rest, _activeCount: state._activeCount + 1 });
    next().finally(() => {
      set((s) => ({ _activeCount: s._activeCount - 1 }));
      get()._runNext();
    });
  },
}));

/** True while an upload still needs the client (bandwidth or a pending queue slot) — not once it's PROCESSING server-side. */
export function isTransferring(entry) {
  return entry.status === 'uploading';
}

/** True for any entry a navigation guard should block on (D4's useUploadsBlocking). */
export function isBlocking(entry) {
  return entry.status === 'uploading' || entry.status === 'processing';
}
