import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { normalizeApiError } from '@/lib/api/errors';
import { tokenStore } from '@/lib/api/tokenStore';
import { changePassword } from '../api.js';
import { ComingSoon } from '../components/ComingSoon.jsx';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export function SecurityTab() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) => changePassword({ currentPassword, newPassword }),
    onSuccess: ({ accessToken }) => {
      // The backend rotated the refresh token (which signs out every other
      // device) and issued a fresh access token for this session — sync it
      // into the in-memory store so this tab's own next request uses it too.
      if (accessToken) tokenStore.setToken(accessToken);
      toast.success('Password updated — other devices have been signed out.');
      reset();
    },
    onError: (error) => {
      const { status, message } = normalizeApiError(error);
      toast.error(status === 401 ? 'Current password is incorrect' : message);
    },
  });

  return (
    <div className="flex flex-col gap-6" data-testid="security-tab">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
            data-testid="password-form"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" type="password" {...register('currentPassword')} />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" {...register('newPassword')} />
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" className="w-fit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ComingSoon title="Active sessions" description="See and sign out of your other devices — coming soon." />
      <ComingSoon
        title="Two-factor authentication"
        description="Add an extra layer of security to your account — coming soon."
      />
    </div>
  );
}

export default SecurityTab;
