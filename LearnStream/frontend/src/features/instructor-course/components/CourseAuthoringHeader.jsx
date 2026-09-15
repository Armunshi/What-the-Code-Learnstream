import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { normalizeApiError } from '@/lib/api/errors';
import { usePublishCourseMutation, useUnpublishCourseMutation } from '../hooks/useCourseQueries';
import { getStepById } from '../steps/registry';

// C-UI-2 "course context header": back to My courses, title, status badge,
// Preview, SaveStatus (rendered per-step next to its own form — there's no
// single global SaveStatus here since only one step has an autosave form in
// this lane), Publish.
export function CourseAuthoringHeader({ course }) {
  const navigate = useNavigate();
  const publishMutation = usePublishCourseMutation(course._id);
  const unpublishMutation = useUnpublishCourseMutation(course._id);
  const isPublished = course.status === 'PUBLISHED';

  const handlePublish = () => {
    publishMutation.mutate(undefined, {
      onSuccess: () => toast.success('Course published'),
      onError: (err) => {
        const normalized = normalizeApiError(err);
        if (normalized.code === 'NOT_READY') {
          toast.error("This course isn't ready to publish yet");
          const reviewStep = getStepById('review');
          if (reviewStep) navigate(`/instructor/courses/${course._id}/${reviewStep.path}`);
        } else {
          toast.error(normalized.message);
        }
      },
    });
  };

  const handleUnpublish = () => {
    unpublishMutation.mutate(undefined, {
      onSuccess: () => toast.success('Course unpublished'),
      onError: (err) => toast.error(normalizeApiError(err).message),
    });
  };

  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-3">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/instructor/courses')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        My courses
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{course.title}</p>
      </div>

      <Badge variant={isPublished ? 'default' : 'secondary'}>{isPublished ? 'Published' : 'Draft'}</Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Preview
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={`/course/${course._id}?preview=guest`} target="_blank" rel="noreferrer">
              Preview as guest
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/course/${course._id}`} target="_blank" rel="noreferrer">
              View live page
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isPublished ? (
        <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={unpublishMutation.isPending}>
          Unpublish
        </Button>
      ) : (
        <Button size="sm" onClick={handlePublish} disabled={publishMutation.isPending}>
          Publish
        </Button>
      )}
    </header>
  );
}

export default CourseAuthoringHeader;
