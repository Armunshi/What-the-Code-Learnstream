import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeApiError } from '@/lib/api/errors';
import { createInstructorCourse } from '../api';
import { instructorCourseKeys } from '../queryKeys';

// Replaces the legacy MakeaCourse page (plan W1-SHELL, C-FR-1 "guided course
// creation workflow"): title only, per D2 — everything else is filled in
// step by step once the draft exists.
export function CreateCoursePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState } = useForm({ defaultValues: { title: '' } });

  const createMutation = useMutation({
    mutationFn: (title) => createInstructorCourse(title),
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: instructorCourseKeys.lists() });
      navigate(`/instructor/courses/${course._id}`);
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  const onSubmit = ({ title }) => createMutation.mutate(title.trim());

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Create a new course</h1>
        <p className="text-sm text-muted-foreground">
          Start with a title — you&apos;ll fill in everything else once your draft is created.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Course title</Label>
          <Input
            id="title"
            autoFocus
            placeholder="e.g. Complete Web Development Bootcamp"
            maxLength={60}
            {...register('title', { required: 'A title is required', maxLength: 60 })}
          />
          {formState.errors.title ? <p className="text-sm text-destructive">{formState.errors.title.message}</p> : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/instructor/courses')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}

export default CreateCoursePage;
