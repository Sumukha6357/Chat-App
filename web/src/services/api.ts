import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const refreshed = await refreshToken();
    if (refreshed) return apiRequest<T>(path, options);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || 'Request failed');
  }

  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

export async function refreshToken(): Promise<boolean> {
  const state = useAuthStore.getState();
  if (!state.refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
    if (!res.ok) {
      state.clear();
      return false;
    }
    const json = await res.json();
    const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
    state.setTokens(data.accessToken, data.refreshToken, data.userId, data.username);
    return true;
  } catch {
    state.clear();
    return false;
  }
}

export async function markRoomRead(roomId: string, lastReadMessageId?: string, lastReadAt?: string) {
  return apiRequest(`/rooms/${roomId}/read`, {
    method: 'POST',
    auth: true,
    body: { lastReadMessageId, lastReadAt },
  });
}

export async function fetchRoomReadState(roomId: string) {
  return apiRequest<{ members: Array<{ userId: string; lastReadMessageId?: string; lastReadAt?: string }> }>(
    `/rooms/${roomId}/read-state`,
    { auth: true },
  );
}

export async function fetchUsersPresence(ids: string[]) {
  const qs = ids.length > 0 ? `?ids=${encodeURIComponent(ids.join(','))}` : '';
  return apiRequest<Record<string, { status: 'online' | 'offline' | 'away'; lastSeenAt?: string }>>(
    `/users/presence${qs}`,
    { auth: true },
  );
}

export async function searchRooms(q: string) {
  return apiRequest<any[]>(`/rooms/search?q=${encodeURIComponent(q)}`, { auth: true });
}

export async function searchRoomMessages(
  roomId: string,
  q: string,
  cursor?: { id?: string; createdAt?: string },
  limit = 30,
) {
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('limit', String(limit));
  if (cursor?.id) params.set('cursorId', cursor.id);
  if (cursor?.createdAt) params.set('cursorCreatedAt', cursor.createdAt);
  return apiRequest<{ items: any[]; nextCursor: any }>(
    `/rooms/${roomId}/messages/search?${params.toString()}`,
    { auth: true },
  );
}

export async function uploadFile(file: File, roomId: string) {
  const token = useAuthStore.getState().accessToken;
  const form = new FormData();
  form.append('file', file);
  form.append('roomId', roomId);

  const doUpload = async () =>
    fetch(`${API_URL}/uploads`, {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      body: form,
    });

  let res = await doUpload();
  if (res.status === 401 && token) {
    const refreshed = await refreshToken();
    if (refreshed) {
      res = await doUpload();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(err.message || 'Upload failed');
  }

  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as {
    url: string;
    type: 'image' | 'file';
    name: string;
    size: number;
    mimeType: string;
  };
}

export async function blockUser(userId: string) {
  return apiRequest(`/users/${userId}/block`, { method: 'POST', auth: true });
}

export async function unblockUser(userId: string) {
  return apiRequest(`/users/${userId}/unblock`, { method: 'POST', auth: true });
}
