import { privateClient } from '@/lib/api/privateClient';
import { publicClient } from '@/lib/api/publicClient';

// PATCH /users/me/onboarding needs the logged-in identity (privateClient);
// the taxonomy list for the interests step is guest-safe (publicClient).
export async function updateOnboarding(payload) {
  const { data } = await privateClient.patch('/users/me/onboarding', payload);
  return data.data;
}

export async function fetchInterestOptions() {
  const { data } = await publicClient.get('/courses/categories');
  return data.data.categories.map((category) => ({ slug: category.slug, label: category.label }));
}
