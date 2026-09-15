import { useState } from 'react';
import { Play, Clock, Download, Captions, HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { Price } from '@/components/common/Price';
import { PurchaseCta } from '@/features/commerce';
import { WishlistButton } from '@/features/wishlist';
import { formatHoursMinutes } from '@/lib/format';

// Sticky purchase card (plan's W1-CAT task list): a trailer trigger over the
// course poster, price, PurchaseCta/WishlistButton, and an "includes" list
// built from CoursePublicDTO.stats. Only rendered once the course has a
// playable promoVideo (toCoursePublicDTO already withholds it entirely for a
// non-published course), otherwise the poster is a plain, non-interactive
// thumbnail.
export function PreviewCard({ course }) {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const stats = course.stats ?? {};
  const hasTrailer = Boolean(course.promoVideo?.mp4Url || course.promoVideo?.hlsUrl);
  const posterUrl = course.promoVideo?.posterUrl ?? course.thumbnail ?? undefined;

  const includes = [
    { icon: Clock, label: `${formatHoursMinutes(stats.totalDurationSec)} on-demand video` },
    stats.resourceCount > 0 ? { icon: Download, label: `${stats.resourceCount} downloadable resources` } : null,
    stats.captionLanguages?.length > 0 ? { icon: Captions, label: 'Captions available' } : null,
    stats.quizCount > 0 ? { icon: HelpCircle, label: `${stats.quizCount} quizzes` } : null,
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-lg lg:sticky lg:top-20">
      <button
        type="button"
        onClick={() => hasTrailer && setTrailerOpen(true)}
        disabled={!hasTrailer}
        data-testid="course-trailer-trigger"
        className="group relative block aspect-video w-full bg-muted"
      >
        {posterUrl ? (
          <img src={posterUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {hasTrailer ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-foreground">
              <Play className="h-4 w-4" aria-hidden="true" /> Preview this course
            </span>
          </span>
        ) : null}
      </button>

      <div className="flex flex-col gap-4 p-5">
        <Price price={course.price} originalPrice={course.originalPrice} className="text-2xl" />

        <div className="flex flex-col gap-2">
          <PurchaseCta course={course} variant="default" />
          <WishlistButton courseId={course.id} />
        </div>

        {includes.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-foreground">This course includes:</p>
            <ul className="mt-2 space-y-2">
              {includes.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {hasTrailer ? (
        <Dialog open={trailerOpen} onOpenChange={setTrailerOpen}>
          <DialogContent className="max-w-3xl p-0">
            <DialogTitle className="sr-only">{course.title} — trailer</DialogTitle>
            <div className="aspect-video w-full">
              <VideoPlayer src={{ mp4Url: course.promoVideo.mp4Url, hlsUrl: course.promoVideo.hlsUrl }} poster={posterUrl} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export default PreviewCard;
