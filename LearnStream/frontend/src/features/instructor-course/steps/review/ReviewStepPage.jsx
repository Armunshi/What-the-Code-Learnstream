import { Link, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ErrorState } from '@/components/common/ErrorState';
import { normalizeApiError } from '@/lib/api/errors';
import { useCourseReadinessQuery, usePublishCourseMutation, useUnpublishCourseMutation } from '../../hooks/useCourseQueries';
import { getStepForReadinessKey } from '../registry';

function ChecklistRow({ item, courseId }) {
  const fixStep = getStepForReadinessKey(item.key);
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex items-center gap-2">
        {item.met ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className={item.met ? 'text-muted-foreground line-through' : ''}>{item.label}</span>
      </div>
      {!item.met && fixStep ? (
        <Button asChild variant="link" size="sm">
          <Link to={`/instructor/courses/${courseId}/${fixStep.path}`}>Fix</Link>
        </Button>
      ) : null}
    </li>
  );
}

// steps/review/ (this lane owns it, plan W1-SHELL): readiness checklist with
// fix links, plus the Publish action. The header also has a Publish button
// (C-UI-2) — this is the contextual, "here's exactly what's missing"
// version of the same action.
export function ReviewStepPage() {
  const { course } = useOutletContext();
  const readinessQuery = useCourseReadinessQuery(course._id);
  const publishMutation = usePublishCourseMutation(course._id);
  const unpublishMutation = useUnpublishCourseMutation(course._id);
  const isPublished = course.status === 'PUBLISHED';

  const handlePublish = () => {
    publishMutation.mutate(undefined, {
      onSuccess: () => toast.success('Course published'),
      onError: (err) => toast.error(normalizeApiError(err).message),
    });
  };

  const handleUnpublish = () => {
    unpublishMutation.mutate(undefined, {
      onSuccess: () => toast.success('Course unpublished'),
      onError: (err) => toast.error(normalizeApiError(err).message),
    });
  };

  if (readinessQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Checking readiness…</div>;
  }
  if (readinessQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState onRetry={readinessQuery.refetch} description="Couldn't load this course's readiness." />
      </div>
    );
  }

  const { percent, required, recommended } = readinessQuery.data;
  const allRequiredMet = required.every((item) => item.met);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Publish your course</h1>
        <p className="text-sm text-muted-foreground">
          {isPublished ? 'This course is live.' : 'Complete the required steps below, then publish.'}
        </p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">Course readiness</span>
          <span>{percent}%</span>
        </div>
        <Progress value={percent} />
      </div>

      {required.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Required</h2>
          <ul className="space-y-2">
            {required.map((item) => (
              <ChecklistRow key={item.key} item={item} courseId={course._id} />
            ))}
          </ul>
        </section>
      ) : null}

      {recommended.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Recommended</h2>
          <ul className="space-y-2">
            {recommended.map((item) => (
              <ChecklistRow key={item.key} item={item} courseId={course._id} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex justify-end">
        {isPublished ? (
          <Button variant="outline" onClick={handleUnpublish} disabled={unpublishMutation.isPending}>
            Unpublish
          </Button>
        ) : (
          <Button onClick={handlePublish} disabled={!allRequiredMet || publishMutation.isPending}>
            Publish course
          </Button>
        )}
      </div>
    </div>
  );
}

export default ReviewStepPage;
