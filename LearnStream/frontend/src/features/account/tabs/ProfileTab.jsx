import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeApiError } from '@/lib/api/errors';
import { getMe, updateProfile } from '../api.js';
import { accountKeys } from '../queryKeys.js';

// Mirrors backend/src/services/user/profile.service.js's updateProfileSchema
// (zod v3 here vs. the backend's v4 — same rules, different package).
const linkSchema = z.object({
  label: z.string().max(60).optional().default(''),
  url: z
    .string()
    .min(1, 'URL is required')
    .url('Enter a valid URL')
    .refine((value) => value.startsWith('https://'), 'Links must start with https://'),
});

const profileSchema = z.object({
  firstName: z.string().trim().max(80).optional().default(''),
  lastName: z.string().trim().max(80).optional().default(''),
  headline: z.string().trim().max(60, 'Headline must be at most 60 characters').optional().default(''),
  bio: z.string().trim().max(2000, 'Biography must be at most 2000 characters').optional().default(''),
  language: z.string().trim().max(10).optional().default(''),
  username: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[a-zA-Z0-9-]{3,30}$/.test(value), 'Use 3-30 letters, numbers, or hyphens')
    .optional()
    .default(''),
  links: z.array(linkSchema).max(10).default([]),
});

const EMPTY_DEFAULTS = { firstName: '', lastName: '', headline: '', bio: '', language: '', username: '', links: [] };

export function ProfileTab() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: accountKeys.me(), queryFn: getMe });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'links' });

  useEffect(() => {
    if (!me) return;
    reset({
      firstName: me.firstName ?? '',
      lastName: me.lastName ?? '',
      headline: me.headline ?? '',
      bio: me.bio ?? '',
      language: me.language ?? '',
      username: me.username ?? '',
      links: me.links ?? [],
    });
  }, [me, reset]);

  const mutation = useMutation({
    mutationFn: (values) => {
      const payload = { links: values.links };
      for (const key of ['firstName', 'lastName', 'headline', 'bio', 'language']) {
        if (values[key].trim() !== '') payload[key] = values[key];
      }
      if (values.username.trim() !== '') payload.username = values.username.toLowerCase();
      return updateProfile(payload);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(accountKeys.me(), user);
      toast.success('Profile updated');
    },
    onError: (error) => {
      const { message, errors: fieldErrors } = normalizeApiError(error);
      toast.error(fieldErrors.some((e) => e.field === 'username') ? 'That username is already taken' : message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex flex-col gap-5"
      data-testid="profile-form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register('firstName')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register('lastName')} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input id="username" {...register('username')} placeholder="jane-doe" data-testid="username-input" />
        {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
        <p className="text-xs text-muted-foreground">Your public profile will be at /user/&#123;username&#125;.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          {...register('headline')}
          placeholder="e.g. Software Engineer"
          maxLength={60}
          data-testid="headline-input"
        />
        {errors.headline && <p className="text-xs text-destructive">{errors.headline.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Biography</Label>
        <Textarea id="bio" {...register('bio')} rows={5} maxLength={2000} data-testid="bio-input" />
        {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="language">Language</Label>
        <Input id="language" {...register('language')} placeholder="en" className="max-w-[160px]" />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Links</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <Input {...register(`links.${index}.label`)} placeholder="Label" className="w-32" />
            <div className="flex flex-1 flex-col gap-1">
              <Input {...register(`links.${index}.url`)} placeholder="https://example.com" />
              {errors.links?.[index]?.url && (
                <p className="text-xs text-destructive">{errors.links[index].url.message}</p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove link">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => append({ label: '', url: '' })}
        >
          <Plus className="h-4 w-4" /> Add link
        </Button>
      </div>

      <Button type="submit" className="w-fit" disabled={mutation.isPending || !isDirty}>
        {mutation.isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

export default ProfileTab;
