import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { getPublicProfile } from './api.js';

function initials(name) {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

// Frozen signature (docs/contracts/stubs.md): PublicProfilePage renders at
// /user/:username, no props — it reads its own params/query.
//
// The route param is actually named :idOrUsername (app/UserOrCourseRoute.jsx)
// — /user/:username collides with the legacy /user/:courseId course-view
// route (plan §0.2), so both share one route disambiguated by whether the
// value is a 24-hex ObjectId. Aliased back to `username` here since that's
// never true for a real username (see domain-model.md's user.model.js note).
export function PublicProfilePage() {
  const { idOrUsername: username } = useParams();
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['publicProfile', username],
    queryFn: () => getPublicProfile(username),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Profile not found" description="This learner doesn't have a public profile at this address." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10" data-testid="public-profile">
      <div className="flex items-center gap-4">
        <Avatar className="h-24 w-24">
          <AvatarImage src={profile.avatar ?? undefined} alt="" />
          <AvatarFallback className="text-xl">{initials(profile.name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" data-testid="public-profile-name">
              {profile.name}
            </h1>
            {profile.verified ? (
              <BadgeCheck className="h-5 w-5 text-primary" aria-label="Verified" data-testid="public-profile-verified" />
            ) : null}
          </div>
          {profile.headline ? (
            <p className="text-sm text-muted-foreground" data-testid="public-profile-headline">
              {profile.headline}
            </p>
          ) : null}
        </div>
      </div>

      {profile.bio ? <p className="whitespace-pre-line text-sm text-foreground">{profile.bio}</p> : null}

      {profile.links?.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {profile.links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {link.label || link.url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default PublicProfilePage;
