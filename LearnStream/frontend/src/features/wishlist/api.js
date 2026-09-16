import privateClient from '@/lib/api/privateClient';

export async function getWishlist() {
  const { data } = await privateClient.get('/users/me/wishlist');
  return data.data.items;
}

export async function addToWishlist(courseId) {
  const { data } = await privateClient.post('/users/me/wishlist', { courseId });
  return data.data.items;
}

export async function removeFromWishlist(courseId) {
  const { data } = await privateClient.delete(`/users/me/wishlist/${courseId}`);
  return data.data.items;
}
