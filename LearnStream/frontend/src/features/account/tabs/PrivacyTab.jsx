import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeApiError } from '@/lib/api/errors';
import { getMe, updateProfile } from '../api.js';
import { accountKeys } from '../queryKeys.js';

export function PrivacyTab() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: accountKeys.me(), queryFn: getMe });

  const mutation = useMutation({
    mutationFn: (showCourses) => updateProfile({ privacy: { showCourses } }),
    onSuccess: (user) => {
      queryClient.setQueryData(accountKeys.me(), user);
      toast.success('Privacy settings updated');
    },
    onError: (error) => toast.error(normalizeApiError(error).message),
  });

  if (isLoading) return <Skeleton className="h-9 w-64" />;

  const showCourses = me?.privacy?.showCourses ?? true;

  return (
    <div className="flex flex-col gap-4" data-testid="privacy-tab">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <Label htmlFor="show-courses">Show my courses on my public profile</Label>
          <p className="text-xs text-muted-foreground">
            {me?.role === 'teacher'
              ? "When off, your public profile won't list the courses you've published."
              : "Instructors' public profiles can list their published courses; this only applies if you switch to teaching."}
          </p>
        </div>
        <Switch
          id="show-courses"
          checked={showCourses}
          disabled={mutation.isPending}
          onCheckedChange={(checked) => mutation.mutate(checked)}
        />
      </div>
    </div>
  );
}

export default PrivacyTab;
