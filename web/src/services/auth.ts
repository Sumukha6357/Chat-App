import { apiRequest } from './api';

export async function login(email: string, password: string) {
  return apiRequest<{ accessToken: string; refreshToken: string; userId: string; username: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function register(email: string, username: string, password: string) {
  return apiRequest<{ accessToken: string; refreshToken: string; userId: string; username: string }>(
    '/auth/register',
    {
      method: 'POST',
      body: { email, username, password },
    },
  );
}
