import { create } from 'zustand';

export interface NotificationItem {
  _id: string;
  type: string;
  payload: Record<string, any> | string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  setItems: (items: NotificationItem[]) => void;
  addItem: (item: NotificationItem) => void;
  markRead: (ids: string[]) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  setItems: (items) => set({ items, unreadCount: items.filter((i) => !i.read).length }),
  addItem: (item) => {
    const next = [item, ...get().items];
    set({ items: next, unreadCount: next.filter((i) => !i.read).length });
  },
  markRead: (ids) => {
    const next = get().items.map((i) => (ids.includes(i._id) ? { ...i, read: true } : i));
    set({ items: next, unreadCount: next.filter((i) => !i.read).length });
  },
}));
