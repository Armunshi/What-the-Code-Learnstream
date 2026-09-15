import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUploadQueueStore } from './uploadQueueStore';

const STATUS_LABEL = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Done',
  failed: 'Failed',
  idle: 'Cancelled',
};

/**
 * D4's global upload tray: one place a teacher can see every upload
 * running anywhere on the page, since uploadQueueStore is shared by every
 * MediaUploadField/ImageUploadField instance. Nothing consumes this yet —
 * the curriculum authoring layout that would mount it once, near the app
 * root, is Wave 2/CURR's — so it's exported here, built and ready, for
 * whichever page first renders an upload field to place. The e2e harness
 * page (harness/UploadHarnessPage.jsx) mounts it directly for now.
 */
export function UploadTray() {
  const uploads = useUploadQueueStore((state) => state.uploads);
  const dismiss = useUploadQueueStore((state) => state.dismiss);
  const cancelUpload = useUploadQueueStore((state) => state.cancelUpload);

  const entries = Object.values(uploads);
  if (entries.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2" data-testid="upload-tray">
      {entries.map((entry) => (
        <div key={entry.key} className="rounded-md border bg-background p-3 shadow-lg" data-testid="upload-tray-item" data-status={entry.status}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{entry.fileName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABEL[entry.status] ?? entry.status}</span>
          </div>
          {entry.status === 'uploading' && <Progress className="mt-2" value={(entry.progress ?? 0) * 100} />}
          <div className="mt-2 flex justify-end gap-2">
            {entry.status === 'uploading' && (
              <Button type="button" variant="ghost" size="sm" onClick={() => cancelUpload(entry.key)}>
                Cancel
              </Button>
            )}
            {(entry.status === 'ready' || entry.status === 'failed') && (
              <Button type="button" variant="ghost" size="sm" onClick={() => dismiss(entry.key)}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default UploadTray;
