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

export async function getPreferences() {
  return apiRequest<{
    theme: 'dark' | 'light' | 'midnight';
    density: 'compact' | 'comfortable' | 'cozy';
    fontSize: 'sm' | 'md' | 'lg';
    sidebarCollapsed: boolean;
  }>('/me/preferences', { auth: true });
}

export async function patchPreferences(body: {
  theme?: 'dark' | 'light' | 'midnight';
  density?: 'compact' | 'comfortable' | 'cozy';
  fontSize?: 'sm' | 'md' | 'lg';
  sidebarCollapsed?: boolean;
}) {
  return apiRequest('/me/preferences', { method: 'PATCH', auth: true, body });
}

export async function getSidebarState() {
  return apiRequest<{
    sectionCollapsed: {
      favorites: boolean;
      textChannels: boolean;
      voice: boolean;
      dms: boolean;
    };
  }>('/me/sidebar-state', { auth: true });
}

export async function patchSidebarState(body: {
  sectionCollapsed: {
    favorites?: boolean;
    textChannels?: boolean;
    voice?: boolean;
    dms?: boolean;
  };
}) {
  return apiRequest('/me/sidebar-state', { method: 'PATCH', auth: true, body });
}

export async function getFavorites() {
  return apiRequest<{ roomIds: string[] }>('/me/favorites', { auth: true });
}

export async function addFavorite(roomId: string) {
  return apiRequest<{ roomIds: string[] }>(`/me/favorites/${roomId}`, { method: 'PUT', auth: true });
}

export async function removeFavorite(roomId: string) {
  return apiRequest<{ roomIds: string[] }>(`/me/favorites/${roomId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function getWorkspaceOrder() {
  return apiRequest<{ workspaceOrder: string[] }>('/me/workspace-order', { auth: true });
}

export async function setWorkspaceOrder(workspaceOrder: string[]) {
  return apiRequest<{ workspaceOrder: string[] }>('/me/workspace-order', {
    method: 'PUT',
    auth: true,
    body: { workspaceOrder },
  });
}

export async function updateLastState(lastWorkspaceId?: string, lastChannelId?: string) {
  return apiRequest('/me/last-state', {
    method: 'PATCH',
    auth: true,
    body: { lastWorkspaceId, lastChannelId },
  });
}

export async function listDrafts() {
  return apiRequest<Array<{ roomId: string; content: string }>>('/drafts', { auth: true });
}

export async function getDraft(roomId: string) {
  return apiRequest<{ roomId: string; content: string } | null>(`/drafts/${roomId}`, { auth: true });
}

export async function upsertDraft(roomId: string, content: string) {
  return apiRequest(`/drafts/${roomId}`, {
    method: 'PUT',
    auth: true,
    body: { content },
  });
}

export async function listNotificationSettings() {
  return apiRequest<Array<{ roomId: string; level: 'all' | 'mentions' | 'none'; quietHoursEnabled: boolean }>>(
    '/notification-settings',
    { auth: true },
  );
}

export async function setNotificationSetting(
  roomId: string,
  level: 'all' | 'mentions' | 'none',
  quietHoursEnabled: boolean,
) {
  return apiRequest(`/notification-settings/${roomId}`, {
    method: 'PUT',
    auth: true,
    body: { level, quietHoursEnabled },
  });
}

export async function editMessage(roomId: string, messageId: string, content: string) {
  return apiRequest<{ message: any }>(`/rooms/${roomId}/messages/${messageId}`, {
    method: 'PATCH',
    auth: true,
    body: { content },
  });
}

export async function deleteMessage(roomId: string, messageId: string) {
  return apiRequest<{ message: any }>(`/rooms/${roomId}/messages/${messageId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function addMessageReaction(roomId: string, messageId: string, emoji: string) {
  return apiRequest<{ reactions: Array<{ emoji: string; count: number; userIds: string[] }> }>(
    `/rooms/${roomId}/messages/${messageId}/reactions`,
    {
      method: 'POST',
      auth: true,
      body: { emoji },
    },
  );
}

export async function removeMessageReaction(roomId: string, messageId: string, emoji: string) {
  return apiRequest<{ reactions: Array<{ emoji: string; count: number; userIds: string[] }> }>(
    `/rooms/${roomId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    {
      method: 'DELETE',
      auth: true,
    },
  );
}

export async function listMessageReactions(roomId: string, messageId: string) {
  return apiRequest<{ reactions: Array<{ emoji: string; count: number; userIds: string[] }> }>(
    `/rooms/${roomId}/messages/${messageId}/reactions`,
    { auth: true },
  );
}

export async function fetchThread(roomId: string, messageId: string) {
  return apiRequest<{ items: any[] }>(`/rooms/${roomId}/messages/${messageId}/thread`, { auth: true });
}

export async function replyInThread(roomId: string, messageId: string, content: string) {
  return apiRequest<{ message: any }>(`/rooms/${roomId}/messages/${messageId}/thread`, {
    method: 'POST',
    auth: true,
    body: { content },
  });
}
