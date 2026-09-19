import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUploadQueueStore, uploadKey } from './uploadQueueStore';

/**
 * The synchronous counterpart to MediaUploadField — for course-thumbnail,
 * item-resource, item-caption and assignment-file, none of which
 * config/uploadPolicy.js marks `async`, so /complete already returns READY
 * and there is never a PROCESSING state to poll for (D4 step 3 confirms
 * these off the Admin API response directly).
 *
 * Unlike MediaUploadField, this has no server-status endpoint to read on
 * mount (GET media-status only covers item-video/course-promo — see
 * uploads.routes.js) — the caller already has the current file's URL from
 * whatever it fetched to render the page (e.g. `course.thumbnail`), and
 * passes it as `initialUrl`. `/complete`'s response carries no CDN URL of
 * its own (D4 doesn't require one), so a just-finished upload previews from
 * a local object URL instead of waiting on a server round trip — `onUploaded`
 * fires so the caller can refetch its own data and hand back an updated
 * `initialUrl` once it has one.
 */
export function ImageUploadField({ courseId, target, initialUrl, accept = 'image/jpeg,image/png,image/webp', label = 'Upload an image', onUploaded, onRemove, className }) {
  const { kind, itemId } = target;
  const key = uploadKey(courseId, kind, itemId);
  const inputRef = useRef(null);

  const localEntry = useUploadQueueStore((state) => state.uploads[key]);
  const startUpload = useUploadQueueStore((state) => state.startUpload);
  const dismiss = useUploadQueueStore((state) => state.dismiss);

  const [objectUrl, setObjectUrl] = useState(null);
  useEffect(() => {
    if (!localEntry?.file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(localEntry.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localEntry?.file]);

  const status = localEntry?.status ?? (initialUrl ? 'ready' : 'idle');
  const previewUrl = localEntry?.status === 'ready' ? objectUrl ?? initialUrl : initialUrl;

  useEffect(() => {
    if (localEntry?.status === 'ready') onUploaded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localEntry?.status]);

  const handlePick = (file) => {
    if (!file) return;
    startUpload({ courseId, target, file });
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    handlePick(file);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className={cn('rounded-md border p-4', className)} data-testid="image-upload-field" data-status={status}>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} data-testid="image-upload-input" />

      {status === 'idle' && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            Choose a file
          </Button>
        </div>
      )}

      {status === 'uploading' && (
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{localEntry.fileName}</span>
            <span className="text-muted-foreground">{Math.round((localEntry.progress ?? 0) * 100)}%</span>
          </div>
          <Progress value={(localEntry.progress ?? 0) * 100} />
        </div>
      )}

      {status === 'ready' && (
        <div className="space-y-3">
          <img src={previewUrl} alt="Uploaded file preview" className="w-full rounded object-cover" />
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
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm font-medium text-destructive">Upload failed</p>
          {localEntry?.error && <p className="text-xs text-muted-foreground">{localEntry.error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => (localEntry?.file ? handlePick(localEntry.file) : openPicker())}>
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

export default ImageUploadField;
