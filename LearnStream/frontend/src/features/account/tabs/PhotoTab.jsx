import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeApiError } from '@/lib/api/errors';
import { getMe, uploadAvatar } from '../api.js';
import { accountKeys } from '../queryKeys.js';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];

function initials(name) {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function PhotoTab() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: accountKeys.me(), queryFn: getMe });
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  const mutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: ({ avatar }) => {
      queryClient.setQueryData(accountKeys.me(), (current) => (current ? { ...current, avatar } : current));
      toast.success('Photo updated');
      setPreview(null);
    },
    onError: (error) => toast.error(normalizeApiError(error).message),
  });

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please choose a JPEG or PNG image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }
    setPreview(URL.createObjectURL(file));
    mutation.mutate(file);
  };

  if (isLoading) return <Skeleton className="h-24 w-24 rounded-full" />;

  return (
    <div className="flex flex-col gap-4" data-testid="photo-tab">
      <Avatar className="h-24 w-24">
        <AvatarImage src={preview ?? me?.avatar ?? undefined} alt="" />
        <AvatarFallback className="text-xl">{initials(me?.name)}</AvatarFallback>
      </Avatar>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        data-testid="avatar-input"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {mutation.isPending ? 'Uploading…' : 'Upload new photo'}
      </Button>
      <p className="text-xs text-muted-foreground">JPEG or PNG, up to 5 MB.</p>
    </div>
  );
}

export default PhotoTab;
