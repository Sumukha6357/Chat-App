import { create } from 'zustand';

export type ToastType = 'info' | 'error' | 'success';

interface ToastState {
  message?: string;
  type?: ToastType;
  visible: boolean;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: undefined,
  type: 'info',
  visible: false,
  show: (message, type = 'info') => set({ message, type, visible: true }),
  hide: () => set({ visible: false }),
}));
