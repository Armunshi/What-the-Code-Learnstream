import { Link } from 'react-router-dom';
import { CourseRatingHeaderMetric } from '@/features/reviews';

// Dark banner header (Udemy-style course page convention) holding the title/
// subtitle, REV's compact rating metric, and the instructor byline. Renders
// on the left of the hero row; PreviewCard sits to its right on desktop and
// stacks below it on mobile (CourseDetailPage owns that grid).
export function CourseHero({ course }) {
  return (
    <div className="text-primary-foreground">
      <h1 className="text-2xl font-bold sm:text-3xl">{course.title}</h1>
      {course.subtitle ? <p className="mt-2 text-base text-primary-foreground/80">{course.subtitle}</p> : null}

      <div className="mt-3">
        <CourseRatingHeaderMetric courseId={course.id} stats={course.stats} />
      </div>

      {course.instructor?.name ? (
        <p className="mt-2 text-sm text-primary-foreground/80">
          Created by{' '}
          {course.instructor.username ? (
            <Link to={`/user/${course.instructor.username}`} className="underline hover:text-primary-foreground">
              {course.instructor.name}
            </Link>
          ) : (
            course.instructor.name
          )}
        </p>
      ) : null}
    </div>
  );
}

export default CourseHero;
