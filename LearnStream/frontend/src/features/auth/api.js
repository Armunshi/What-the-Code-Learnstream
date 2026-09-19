import { publicClient } from '@/lib/api/publicClient';

// All guest-facing (no session exists yet, or none is required) — always
// through publicClient, never privateClient (H-FR-3.2, docs/contracts/
// api-conventions.md).

export async function signup(role, { firstName, lastName, email, password }) {
  const name = `${firstName} ${lastName}`.trim();
  const { data } = await publicClient.post(`/user/${role}/signup`, {
    name,
    firstName,
    lastName,
    email,
    password,
  });
  return data.data; // { email, expiresAt, resendAvailableAt }
}

export async function verifyRegistration({ email, code }) {
  const { data } = await publicClient.post('/auth/register/verify', { email, code });
  return data.data; // { user, role, accessToken }
}

export async function resendRegistration({ email }) {
  const { data } = await publicClient.post('/auth/register/resend', { email });
  return data.data; // { email, expiresAt, resendAvailableAt }
}

export async function checkEmailAvailable(email) {
  const { data } = await publicClient.get('/auth/email-available', { params: { email } });
  return data.data.available;
}
