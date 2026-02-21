import { create } from 'zustand';

export type ToastType = 'info' | 'error' | 'success' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  // Legacy compat
  message?: string;
  type?: ToastType;
  visible: boolean;
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  message: undefined,
  type: 'info',
  visible: false,
  show: (message, type = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    set({ toasts: [...get().toasts, { id, message, type }], message, type, visible: true });
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  hide: () => set({ visible: false }),
}));
