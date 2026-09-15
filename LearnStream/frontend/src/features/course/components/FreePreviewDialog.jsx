import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { fetchItemPlayback } from '../api';
import { courseKeys } from '../queryKeys';

// Playback (mp4/hls URLs) is never embedded in the curriculum tree itself
// (dto.md) — a guest clicking "Preview" on a free item opens this dialog,
// which only then fetches GET .../items/:itemId/playback, entitled for
// anyone when the item isFreePreview and the course is PUBLISHED.
export function FreePreviewDialog({ courseId, itemId, title, open, onOpenChange }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: courseKeys.playback(courseId, itemId),
    queryFn: () => fetchItemPlayback(courseId, itemId),
    enabled: open && Boolean(itemId),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0" data-testid="free-preview-dialog">
        <DialogTitle className="sr-only">{title ?? 'Free preview'}</DialogTitle>
        <div className="flex aspect-video w-full items-center justify-center bg-black">
          {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden="true" /> : null}
          {isError ? <p className="text-sm text-white">This preview isn&apos;t available right now.</p> : null}
          {data ? <VideoPlayer src={{ mp4Url: data.mp4Url, hlsUrl: data.hlsUrl }} poster={data.posterUrl} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FreePreviewDialog;
