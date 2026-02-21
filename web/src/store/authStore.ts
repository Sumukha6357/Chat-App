import { create } from 'zustand';

export interface AuthState {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  username?: string;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string, userId: string, username?: string) => void;
  clear: () => void;
}

const readStorage = () => {
  if (typeof window === 'undefined') return {};
  const accessToken = window.localStorage.getItem('accessToken') || undefined;
  const refreshToken = window.localStorage.getItem('refreshToken') || undefined;
  const userId = window.localStorage.getItem('userId') || undefined;
  const username = window.localStorage.getItem('username') || undefined;
  return { accessToken, refreshToken, userId, username };
};

export const useAuthStore = create<AuthState>((set) => {
  const initial = readStorage();
  return {
    accessToken: initial.accessToken,
    refreshToken: initial.refreshToken,
    userId: initial.userId,
    username: initial.username,
    isAuthenticated: Boolean(initial.accessToken),
    setTokens: (accessToken, refreshToken, userId, username) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('accessToken', accessToken);
        window.localStorage.setItem('refreshToken', refreshToken);
        window.localStorage.setItem('userId', userId);
        if (username) window.localStorage.setItem('username', username);
      }
      set({ accessToken, refreshToken, userId, username, isAuthenticated: true });
    },
    clear: () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('accessToken');
        window.localStorage.removeItem('refreshToken');
        window.localStorage.removeItem('userId');
        window.localStorage.removeItem('username');
      }
      set({ accessToken: undefined, refreshToken: undefined, userId: undefined, username: undefined, isAuthenticated: false });
    },
  };
});
