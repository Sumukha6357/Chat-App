import { create } from 'zustand';

type Theme = 'dark' | 'light' | 'midnight';
type Density = 'compact' | 'comfortable' | 'cozy';
type FontSize = 'sm' | 'md' | 'lg';

interface PreferencesState {
  theme: Theme;
  density: Density;
  fontSize: FontSize;
  sidebarCollapsed: boolean;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setFontSize: (fontSize: FontSize) => void;
  setSidebarCollapsed: (sidebarCollapsed: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  theme: 'dark',
  density: 'comfortable',
  fontSize: 'md',
  sidebarCollapsed: false,
  hydrated: false,
  setHydrated: (hydrated) => set({ hydrated }),
  setTheme: (theme) => set({ theme }),
  setDensity: (density) => set({ density }),
  setFontSize: (fontSize) => set({ fontSize }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));

