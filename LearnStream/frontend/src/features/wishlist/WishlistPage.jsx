import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CourseGrid } from '@/features/catalog';
import { getWishlist } from './api';
import { wishlistKeys } from './queryKeys';

export function WishlistPage() {
  const { data: courses, isLoading } = useQuery({
    queryKey: wishlistKeys.all(),
    queryFn: getWishlist,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">My wishlist</h1>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-video w-full" />
          ))}
        </div>
      ) : (
        <CourseGrid courses={courses ?? []} />
      )}
    </div>
  );
}

export default WishlistPage;
