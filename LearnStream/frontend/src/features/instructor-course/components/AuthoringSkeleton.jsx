import { Skeleton } from '@/components/ui/skeleton';

// Cold-start loading state for the whole authoring shell (H-NFR-1.3) — shown
// while the course itself is still loading, before CourseAuthoringHeader/
// Sidebar/step content have anything to render.
export function AuthoringSkeleton() {
  return (
    <div className="p-6">
      <Skeleton className="mb-6 h-14 w-full" />
      <div className="flex gap-6">
        <div className="hidden w-64 shrink-0 space-y-3 md:block">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export default AuthoringSkeleton;
