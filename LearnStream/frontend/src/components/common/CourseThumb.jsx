import { cn } from '@/lib/utils';

// Shared course thumbnail used by CourseCard (and anywhere else a course
// needs its landing-page image): fixed aspect-video box, lazy-loaded unless
// it's above the fold (`priority`), with a srcSet so the browser doesn't
// download a full-resolution image for a 300px-wide card (H-NFR-2.2).
export function CourseThumb({ src, alt = '', priority = false, className, width = 320, height = 180 }) {
  const srcSet = src ? `${src}?w=320 320w, ${src}?w=640 640w, ${src}?w=960 960w` : undefined;

  return (
    // width/height below are only HTML attributes on the <img> (its
    // intrinsic size, so the browser can reserve the right box before the
    // image loads — no CLS) — never a CSS size. An inline `style` here used
    // to fix this wrapper at exactly 320x180px regardless of the actual grid
    // column width, which inline styles always win over the `w-full`/
    // `aspect-video` classes for; on any grid narrower than 320px per column
    // (any 2- or 3-column layout, most viewports), that forced-320px box
    // overflowed into the next card — the reported "cards sticking
    // together."
    <div className={cn('aspect-video w-full overflow-hidden rounded-md bg-muted', className)}>
      {src ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes="(min-width: 1024px) 320px, 45vw"
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          className="h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

export default CourseThumb;
