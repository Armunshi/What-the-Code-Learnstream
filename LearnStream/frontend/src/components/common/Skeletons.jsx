import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// A small library of shared loading skeletons, built on shadcn's Skeleton
// primitive, so every feature's cold-start loading state (H-NFR-1.3) looks
// consistent instead of each lane inventing its own shimmer layout.

export function CourseCardSkeleton({ className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Skeleton className="aspect-video w-full rounded-md" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function CourseGridSkeleton({ count = 8, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, index) => (
        <CourseCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function TextLineSkeleton({ className }) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

export function AvatarSkeleton({ className }) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
}

export default { CourseCardSkeleton, CourseGridSkeleton, TextLineSkeleton, AvatarSkeleton };
