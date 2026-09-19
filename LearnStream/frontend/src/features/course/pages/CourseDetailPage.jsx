import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/common/ErrorState';
import { CourseGridSkeleton } from '@/components/common/Skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { CourseReviewsSection } from '@/features/reviews';
import { PreviewBanner } from '@/features/course-preview';
import { CourseHero } from '../components/CourseHero';
import { PreviewCard } from '../components/PreviewCard';
import { WhatYoullLearn } from '../components/WhatYoullLearn';
import { CurriculumAccordion } from '../components/CurriculumAccordion';
import { Requirements } from '../components/Requirements';
import { Description } from '../components/Description';
import { TargetAudience } from '../components/TargetAudience';
import { InstructorBio } from '../components/InstructorBio';
import { fetchCourseLanding } from '../api';
import { courseKeys } from '../queryKeys';

// The full public course page (plan's W1-CAT "CourseDetailPage" task list).
// PreviewBanner reads its own `?preview=` query param (stubs.md — it takes
// no props), so it's mounted unconditionally here and renders nothing on a
// normal visit.
export function CourseDetailPage() {
  const { courseId } = useParams();

  const { data: course, isLoading, isError, refetch } = useQuery({
    queryKey: courseKeys.landing(courseId),
    queryFn: () => fetchCourseLanding(courseId),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <CourseGridSkeleton count={1} className="mt-6 grid-cols-1" />
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ErrorState title="Course not found" description="This course isn't available." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div data-testid="course-detail-page">
      <PreviewBanner />

      {/* A single grid with exactly two children — the content column and
          PreviewCard — so PreviewCard's `lg:sticky` tracks the full scroll
          height of the content next to it, including the dark hero banner,
          without needing a fragile row-span across two separate grids. */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          <div className="-mx-4 bg-slate-900 px-4 py-8 lg:mx-0 lg:rounded-lg">
            <CourseHero course={course} />
          </div>

          <WhatYoullLearn objectives={course.learningObjectives} />
          <CurriculumAccordion courseId={course.id} stats={course.stats} />
          <Requirements requirements={course.requirements} />
          <Description description={course.description} />
          <TargetAudience audience={course.targetAudience} />
          <InstructorBio instructor={course.instructor} />
          <CourseReviewsSection courseId={course.id} />
        </div>

        <PreviewCard course={course} />
      </div>
    </div>
  );
}

export default CourseDetailPage;
