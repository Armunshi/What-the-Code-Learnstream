import privateClient from '@/lib/api/privateClient';

export async function getMe() {
  const { data } = await privateClient.get('/users/me');
  return data.data;
}

export async function updateProfile(patch) {
  const { data } = await privateClient.patch('/users/me/profile', patch);
  return data.data;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await privateClient.post('/users/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function changePassword(payload) {
  const { data } = await privateClient.patch('/users/me/password', payload);
  return data.data;
}

export async function getPurchases() {
  const { data } = await privateClient.get('/users/me/purchases');
  return data.data.items;
}
