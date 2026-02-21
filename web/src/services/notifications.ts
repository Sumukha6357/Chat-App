import { apiRequest } from './api';

export function fetchNotifications(limit = 50) {
  return apiRequest('/notifications?limit=' + limit, { auth: true });
}

export function markNotificationsRead(ids: string[]) {
  return apiRequest('/notifications/mark-read', {
    method: 'POST',
    auth: true,
    body: { ids },
  });
}
