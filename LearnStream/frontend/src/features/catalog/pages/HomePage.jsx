import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchCatalog, fetchCategories } from '../api.js';
import { catalogKeys, categoriesKeys } from '../queryKeys.js';
import { CategoryTabs } from '../components/CategoryTabs.jsx';
import { CourseGrid } from '../components/CourseGrid.jsx';
import { CourseGridSkeleton } from '@/components/common/Skeletons';
import { ErrorState } from '@/components/common/ErrorState';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { HomeSocialProof } from '@/features/reviews';

const PAGE_SIZE = 12;

/**
 * The real "/" homepage (plan §4 W1-CAT: "HomePage, CategoryTabs, CourseGrid,
 * and the full CourseCard + CoursePopover"). Mounted both here (the live
 * registry route, currently shadowed — see routes.jsx) and directly from
 * Pages/Home.jsx (the legacy route app/router.jsx still serves at "/" — that
 * file is frozen after Wave 0, so this is the only way the new homepage is
 * actually reachable today).
 */
export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || undefined;
  const page = Number(searchParams.get('page')) || 1;

  const categoriesQuery = useQuery({
    queryKey: categoriesKeys.all,
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  const catalogParams = useMemo(() => ({ category, page, limit: PAGE_SIZE }), [category, page]);

  // Category switching under 200ms (H-NFR-1.1): 5min staleTime plus
  // keepPreviousData so the grid updates in place instead of flashing a
  // skeleton on every tab click.
  const catalogQuery = useQuery({
    queryKey: catalogKeys.list(catalogParams),
    queryFn: () => fetchCatalog(catalogParams),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const handleCategoryChange = (nextCategory) => {
    const next = new URLSearchParams(searchParams);
    if (nextCategory === 'all') next.delete('category');
    else next.set('category', nextCategory);
    next.delete('page');
    setSearchParams(next);
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const total = catalogQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <section className="relative bg-[url('/assets/HeroImg.png')] bg-cover bg-center bg-no-repeat min-h-[500px] h-[90vh] w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 to-transparent/0" />
        <div className="relative mx-auto max-w-screen-xl px-4 py-32 sm:px-6 lg:flex lg:h-screen lg:items-center lg:px-8">
          <div className="max-w-xl text-center ltr:sm:text-left">
            <h1 className="text-4xl font-extrabold text-white sm:text-6xl">Transform Your Education Journey.</h1>
            <p className="mt-4 max-w-lg text-white/90 sm:text-xl/relaxed">
              Take the first step toward mastering new skills and broadening your horizons.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-center">
              <Link
                to="/login"
                className="block w-full rounded bg-[#588157] px-12 py-3 text-sm font-medium text-white shadow hover:bg-[#137dc7] hover:text-black focus:outline-none focus:ring sm:w-auto"
              >
                Get Started
              </Link>
              <a
                href="#courses"
                className="block w-full rounded bg-white px-12 py-3 text-sm font-medium text-black shadow hover:text-black focus:outline-none focus:ring sm:w-auto"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      <div id="courses" className="scroll-mt-20 py-10">
        <div className="max-w-container mx-auto px-4 md:px-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">Courses</h2>

          <div className="mb-6">
            <CategoryTabs categories={categoriesQuery.data ?? []} value={category ?? 'all'} onChange={handleCategoryChange} />
          </div>

          {catalogQuery.isPending ? (
            <CourseGridSkeleton />
          ) : catalogQuery.isError ? (
            <ErrorState description="We couldn't load courses right now." onRetry={catalogQuery.refetch} />
          ) : (
            <>
              <CourseGrid courses={catalogQuery.data?.items ?? []} />
              {totalPages > 1 ? (
                <Pagination className="mt-8">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#courses"
                        aria-disabled={page <= 1}
                        className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        onClick={(event) => {
                          event.preventDefault();
                          if (page > 1) goToPage(page - 1);
                        }}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-2 text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#courses"
                        aria-disabled={page >= totalPages}
                        className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                        onClick={(event) => {
                          event.preventDefault();
                          if (page < totalPages) goToPage(page + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </>
          )}
        </div>

        <HomeSocialProof />
      </div>
    </>
  );
}

export default HomePage;
