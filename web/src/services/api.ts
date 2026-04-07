import { useAuthStore } from '@/store/authStore';
import { Room } from '@/store/chatStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  console.log(`API Request: ${method} ${path}`, { body, auth });
  
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.authorization = `Bearer ${token}`;
    else {
      console.log('No auth token available');
      return Promise.reject(new Error('No authentication token'));
    }
  }

  const url = `${API_URL}${path}`;
  console.log('Full URL:', url);
  console.log('Headers:', headers);

  try {
    console.log('Sending fetch request...');
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(`API Response: ${method} ${path}`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${method} ${path}`, response.status, errorText);
      
      // Don't throw errors for drafts, just return null
      if (path.includes('/drafts')) {
        console.log('Ignoring drafts API error');
        return null as T;
      }
      
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`API Success: ${method} ${path}`, data);
    return data;
  } catch (error) {
    console.error(`API Request Failed: ${method} ${path}`, error);
    
    // Don't throw errors for drafts, just return null
    if (path.includes('/drafts')) {
      console.log('Ignoring drafts API error');
      return null as T;
    }
    
    throw error;
  }
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
  const data = await apiRequest<Array<{ _id: string; name: string; type: string }>>(`/rooms/search?q=${encodeURIComponent(q)}`, { auth: true });
  return data.map((r): Room => ({ _id: r._id, name: r.name, type: r.type as 'direct' | 'group', members: [] }));
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
  return apiRequest<{ items: Array<{ _id: string; content: string; createdAt: string }>; nextCursor: { id?: string; createdAt?: string } }>(
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
  if (!roomId || roomId === 'new' || roomId === 'undefined') {
    return Promise.resolve(null);
  }
  return apiRequest<{ roomId: string; content: string } | null>(`/drafts/${roomId}`, { auth: true });
}

export async function upsertDraft(roomId: string, content: string) {
  if (!roomId || roomId === 'new' || roomId === 'undefined') {
    return Promise.resolve(null);
  }
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
  return apiRequest<{ message: { _id: string; content: string; updatedAt: string } }>(`/rooms/${roomId}/messages/${messageId}`, {
    method: 'PATCH',
    auth: true,
    body: { content },
  });
}

export async function deleteMessage(roomId: string, messageId: string) {
  return apiRequest<{ message: { _id: string; deletedAt: string } }>(`/rooms/${roomId}/messages/${messageId}`, {
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
  return apiRequest<{ items: Array<{ _id: string; content: string; createdAt: string; userId: string }> }>(`/rooms/${roomId}/messages/${messageId}/thread`, { auth: true });
}

export async function replyInThread(roomId: string, messageId: string, content: string) {
  return apiRequest<{ message: { _id: string; content: string; createdAt: string } }>(`/rooms/${roomId}/messages/${messageId}/thread`, {
    method: 'POST',
    auth: true,
    body: { content },
  });
}
