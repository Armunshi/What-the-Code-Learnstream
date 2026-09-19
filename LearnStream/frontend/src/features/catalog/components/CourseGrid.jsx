import { EmptyState } from '@/components/common/EmptyState';
import { CourseCard } from './CourseCard';
import { CoursePopoverGroup } from './CoursePopoverGroup';

/**
 * CourseGrid({courses}) (docs/contracts/stubs.md) — frozen signature, this
 * is CAT's Wave 1 body. Wrapped in its own CoursePopoverGroup so "only one
 * popover open at a time" is scoped per grid instance (the homepage and a
 * search-results grid, reusing this unchanged per FR-SRC-2.3, each get their
 * own independent group).
 */
export function CourseGrid({ courses = [] }) {
  if (courses.length === 0) {
    return (
      <EmptyState
        title="No courses found"
        description="Try a different category, or check back soon — new courses are added regularly."
      />
    );
  }

  return (
    <CoursePopoverGroup>
      <div data-testid="course-grid" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {courses.map((course, index) => (
          <CourseCard key={course.id} course={course} priority={index < 4} />
        ))}
      </div>
    </CoursePopoverGroup>
  );
}

export default CourseGrid;
