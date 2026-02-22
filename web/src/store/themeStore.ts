import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';
type ExtendedTheme = Theme | 'midnight';

interface ThemeStore {
    theme: ExtendedTheme;
    toggleTheme: () => void;
    setTheme: (t: ExtendedTheme) => void;
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: 'dark',
            toggleTheme: () =>
                set((s) => ({
                    theme: s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'midnight' : 'dark',
                })),
            setTheme: (theme) => set({ theme }),
        }),
        { name: 'pulse-theme' }
    )
);
