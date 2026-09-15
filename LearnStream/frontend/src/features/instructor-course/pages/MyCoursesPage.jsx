import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CourseGridSkeleton } from '@/components/common/Skeletons';
import { formatRelativeTime } from '@/lib/relativeTime';
import { normalizeApiError } from '@/lib/api/errors';
import { deleteInstructorCourse, listInstructorCourses } from '../api';
import { instructorCourseKeys } from '../queryKeys';

function CourseRow({ course, onDeleteRequested }) {
  const isDraft = course.status === 'DRAFT';
  const canDelete = isDraft && (course.enrolledStudents?.length ?? 0) === 0;

  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{course.title}</p>
        <p className="text-sm text-muted-foreground">Updated {formatRelativeTime(course.updatedAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={isDraft ? 'secondary' : 'default'}>{isDraft ? 'Draft' : 'Published'}</Badge>
        <Button asChild size="sm" variant="outline">
          <Link to={`/instructor/courses/${course._id}`}>Edit</Link>
        </Button>
        {canDelete ? (
          <Button size="icon" variant="ghost" aria-label={`Delete ${course.title}`} onClick={() => onDeleteRequested(course)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

// Replaces the legacy TeachersPage (plan W1-SHELL). Route: /instructor/courses.
export function MyCoursesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(null);

  const coursesQuery = useQuery({
    queryKey: instructorCourseKeys.lists(),
    queryFn: listInstructorCourses,
  });

  const deleteMutation = useMutation({
    mutationFn: (courseId) => deleteInstructorCourse(courseId),
    onSuccess: () => {
      toast.success('Course deleted');
      queryClient.invalidateQueries({ queryKey: instructorCourseKeys.lists() });
      setPendingDelete(null);
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My courses</h1>
        <Button className="gap-1" onClick={() => navigate('/instructor/courses/new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create a course
        </Button>
      </div>

      {coursesQuery.isLoading ? <CourseGridSkeleton count={4} /> : null}

      {coursesQuery.isError ? <ErrorState onRetry={coursesQuery.refetch} description="Couldn't load your courses." /> : null}

      {coursesQuery.data?.length === 0 ? (
        <EmptyState
          title="You haven't created a course yet"
          description="Start with just a title — you can fill in the rest as you go."
          action={
            <Button onClick={() => navigate('/instructor/courses/new')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Create a course
            </Button>
          }
        />
      ) : null}

      {coursesQuery.data?.length > 0 ? (
        <div className="space-y-3">
          {coursesQuery.data.map((course) => (
            <CourseRow key={course._id} course={course} onDeleteRequested={setPendingDelete} />
          ))}
        </div>
      ) : null}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{pendingDelete?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the draft course and everything in it. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(pendingDelete._id)} disabled={deleteMutation.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MyCoursesPage;
