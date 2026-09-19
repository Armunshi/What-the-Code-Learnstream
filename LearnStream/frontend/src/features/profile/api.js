import publicClient from '@/lib/api/publicClient';

// A public profile has no viewer-specific fields (the backend route carries
// no auth middleware at all), so this is a plain guest-safe GET through
// publicClient — no token to attach, no refresh to risk triggering.
export async function getPublicProfile(username) {
  const { data } = await publicClient.get(`/users/${username}`);
  return data.data;
}
