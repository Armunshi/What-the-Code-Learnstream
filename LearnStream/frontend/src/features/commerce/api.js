import { privateClient } from '@/lib/api/privateClient';

// Server-cart + enrollment endpoints (docs/contracts/api-conventions.md
// "Free enrollment (D10)"). All require a logged-in student, so these only
// ever run in useCart()'s 'server' mode — privateClient, not publicClient.

export async function fetchCart() {
  const { data } = await privateClient.get('/courses/cart');
  return data.data.items;
}

export async function addToCartRequest(courseId) {
  const { data } = await privateClient.post(`/courses/cart/${courseId}`);
  return data.data.items;
}

export async function removeFromCartRequest(courseId) {
  const { data } = await privateClient.delete(`/courses/cart/${courseId}`);
  return data.data.items;
}

export async function mergeCartRequest(courseIds) {
  const { data } = await privateClient.post('/courses/cart/merge', { courseIds });
  return data.data.items;
}

export async function enrollFreeCourse(courseId) {
  const { data } = await privateClient.post(`/courses/${courseId}/enroll`);
  return data.data; // { redirectTo }
}

export async function fetchMeSummary() {
  const { data } = await privateClient.get('/users/me/summary');
  return data.data; // { enrolledCount, enrolledCourseIds, cartCount, avatar }
}
