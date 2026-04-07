import { apiRequest } from './api';
import { NotificationItem } from '@/store/notificationStore';

export function fetchNotifications(limit = 50): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>('/notifications?limit=' + limit, { auth: true });
}

export function markNotificationsRead(ids: string[]) {
  return apiRequest('/notifications/mark-read', {
    method: 'POST',
    auth: true,
    body: { ids },
  });
}
