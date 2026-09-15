import { cn } from '@/lib/utils';

// Shared course thumbnail used by CourseCard (and anywhere else a course
// needs its landing-page image): fixed aspect-video box, lazy-loaded unless
// it's above the fold (`priority`), with a srcSet so the browser doesn't
// download a full-resolution image for a 300px-wide card (H-NFR-2.2).
export function CourseThumb({ src, alt = '', priority = false, className, width = 320, height = 180 }) {
  const srcSet = src ? `${src}?w=320 320w, ${src}?w=640 640w, ${src}?w=960 960w` : undefined;

  return (
    <div className={cn('aspect-video w-full overflow-hidden rounded-md bg-muted', className)} style={{ width, height }}>
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
