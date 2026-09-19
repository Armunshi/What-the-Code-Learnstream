import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUploadQueueStore, uploadKey } from './uploadQueueStore';
import { useMediaStatus } from './useMediaStatus';
import { readInflightUpload } from './chunkedUpload';

/**
 * D4's video/promo upload field — the one with a PROCESSING state, because
 * item-video and course-promo are the only two upload kinds async config/
 * uploadPolicy.js marks `async: true`. Sync kinds (thumbnails, resources,
 * captions) use ImageUploadField instead, which never needs to poll.
 *
 * `target.kind` must be "item-video" or "course-promo". For item-video,
 * `target.itemId` is required; course-promo has no itemId (its status is
 * read under the literal id "promo" — see uploads.routes.js's media-status
 * handler).
 */
export function MediaUploadField({ courseId, target, accept = 'video/mp4,video/quicktime,video/webm,video/x-matroska', label = 'Upload a video', onRemove, className }) {
  const { kind, itemId } = target;
  const id = kind === 'course-promo' ? 'promo' : itemId;
  const key = uploadKey(courseId, kind, itemId);
  const inputRef = useRef(null);

  const localEntry = useUploadQueueStore((state) => state.uploads[key]);
  const startUpload = useUploadQueueStore((state) => state.startUpload);
  const cancelUpload = useUploadQueueStore((state) => state.cancelUpload);
  const dismiss = useUploadQueueStore((state) => state.dismiss);
  const syncStatus = useUploadQueueStore((state) => state.syncStatus);

  const ids = useMemo(() => [id], [id]);
  // Only poll while there's a real reason to: no local entry yet (so the
  // initial mount can discover an already-PROCESSING or already-READY
  // server state), or a local entry that's waiting on the transcode.
  const shouldPoll = !localEntry || localEntry.status === 'processing';
  const { statusById, isLoading } = useMediaStatus(courseId, ids, { enabled: shouldPoll });
  const serverEntry = statusById[id];

  useEffect(() => {
    if (localEntry?.status !== 'processing') return;
    if (serverEntry?.status === 'READY') syncStatus(key, 'ready');
    else if (serverEntry?.status === 'FAILED') syncStatus(key, 'failed');
  }, [localEntry?.status, serverEntry?.status, key, syncStatus]);

  // "Upload interrupted" (D4's field-state list): a previous attempt for
  // this exact target left a resume record (chunkedUpload.js) but never
  // reached /complete, and the server still has no PROCESSING/READY state
  // for it — the only way that combination happens is a reload mid-upload.
  const [interruptedFileName, setInterruptedFileName] = useState(null);
  useEffect(() => {
    if (localEntry || isLoading) return;
    if (serverEntry && serverEntry.status !== 'NONE') return;
    const record = readInflightUpload({ courseId, kind, itemId });
    setInterruptedFileName(record?.fileName ?? null);
  }, [localEntry, isLoading, serverEntry, courseId, kind, itemId]);

  const status =
    localEntry?.status ??
    (serverEntry?.status === 'READY'
      ? 'ready'
      : serverEntry?.status === 'FAILED'
        ? 'failed'
        : serverEntry?.status === 'PROCESSING'
          ? 'processing'
          : interruptedFileName
            ? 'interrupted'
            : 'idle');

  const handlePick = (file) => {
    if (!file) return;
    setInterruptedFileName(null);
    startUpload({ courseId, target, file });
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    handlePick(file);
  };

  const openPicker = () => inputRef.current?.click();

  const hiddenInput = (
    <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} data-testid="media-upload-input" />
  );

  return (
    <div className={cn('rounded-md border p-4', className)} data-testid="media-upload-field" data-status={status}>
      {hiddenInput}

      {status === 'idle' && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            Choose a file
          </Button>
        </div>
      )}

      {status === 'interrupted' && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm font-medium">Upload interrupted</p>
          <p className="text-xs text-muted-foreground">
            {interruptedFileName ? `Select "${interruptedFileName}" again to resume.` : 'Select the file again to resume.'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            Select file
          </Button>
        </div>
      )}

      {status === 'uploading' && (
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{localEntry.fileName}</span>
            <span className="text-muted-foreground">{Math.round((localEntry.progress ?? 0) * 100)}%</span>
          </div>
          <Progress value={(localEntry.progress ?? 0) * 100} data-testid="media-upload-progress" />
          <Button type="button" variant="ghost" size="sm" onClick={() => cancelUpload(key)}>
            Cancel
          </Button>
        </div>
      )}

      {status === 'processing' && (
        <div className="flex flex-col items-center gap-2 py-6 text-center" data-testid="media-upload-processing">
          <p className="text-sm font-medium">Processing…</p>
          <p className="text-xs text-muted-foreground">This can take a minute for longer videos.</p>
        </div>
      )}

      {status === 'ready' && (
        <div className="space-y-3" data-testid="media-upload-ready">
          <video
            controls
            className="w-full rounded"
            src={serverEntry?.mp4Url}
            poster={serverEntry?.posterUrl}
            data-hls-src={serverEntry?.hlsUrl || undefined}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openPicker}>
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                dismiss(key);
                onRemove?.();
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center gap-2 py-6 text-center" data-testid="media-upload-failed">
          <p className="text-sm font-medium text-destructive">Upload failed</p>
          {localEntry?.error && <p className="text-xs text-muted-foreground">{localEntry.error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (localEntry?.file ? handlePick(localEntry.file) : openPicker())}
              data-testid="media-upload-retry"
            >
              Retry
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={openPicker}>
              Choose another file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaUploadField;
