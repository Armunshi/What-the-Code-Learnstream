import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuthoringStoreProvider } from '../stores/authoringStore';
import { useInstructorCourseQuery, useSetCachedCourse } from '../hooks/useCourseQueries';
import { stepRegistry, getFirstStepPath } from '../steps/registry';
import { CourseAuthoringHeader } from './CourseAuthoringHeader';
import { CourseAuthoringSidebar } from './CourseAuthoringSidebar';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { AuthoringError } from './AuthoringError';
import { AuthoringSkeleton } from './AuthoringSkeleton';

// A small below-md step switcher — the sidebar itself is `hidden md:block`
// (C-NFR-7/C-UI-14 responsive layout), so narrow viewports need some other
// way to jump between steps.
function MobileStepSwitcher({ courseId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = stepRegistry.find((step) => location.pathname.endsWith(`/${step.path}`))?.path;

  return (
    <div className="border-b bg-muted/30 p-2 md:hidden">
      <Select value={currentPath} onValueChange={(path) => navigate(`/instructor/courses/${courseId}/${path}`)}>
        <SelectTrigger aria-label="Jump to authoring step">
          <SelectValue placeholder="Jump to step…" />
        </SelectTrigger>
        <SelectContent>
          {stepRegistry.map((step) => (
            <SelectItem key={step.id} value={step.path}>
              {step.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CourseAuthoringLayout() {
  const { courseId } = useParams();
  const location = useLocation();
  const courseQuery = useInstructorCourseQuery(courseId);
  const setCachedCourse = useSetCachedCourse(courseId);

  if (courseQuery.isLoading) return <AuthoringSkeleton />;
  if (courseQuery.isError) return <AuthoringError onRetry={courseQuery.refetch} />;

  const course = courseQuery.data;
  const isAtCourseRoot = location.pathname === `/instructor/courses/${courseId}`;

  return (
    <AuthoringStoreProvider courseId={courseId}>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        <CourseAuthoringHeader course={course} />
        <MobileStepSwitcher courseId={courseId} />
        <div className="flex flex-1">
          <CourseAuthoringSidebar courseId={courseId} />
          <main className="min-w-0 flex-1">
            {isAtCourseRoot ? (
              <Navigate to={`/instructor/courses/${courseId}/${getFirstStepPath()}`} replace />
            ) : (
              <Outlet context={{ course, onCourseSaved: setCachedCourse }} />
            )}
          </main>
        </div>
      </div>
      <UnsavedChangesDialog />
    </AuthoringStoreProvider>
  );
}

export default CourseAuthoringLayout;
