import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import '@/styles/globals.css';
import { Toast } from '@/components/ui/Toast';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { getPreferences } from '@/services/api';

const inter = Inter({ subsets: ['latin'] });

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeStoreTheme = useThemeStore((s) => s.theme);
  const setThemeStoreTheme = useThemeStore((s) => s.setTheme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    theme,
    density,
    fontSize,
    setTheme,
    setDensity,
    setFontSize,
    setSidebarCollapsed,
    hydrated,
    setHydrated,
  } = usePreferencesStore();

  useEffect(() => {
    if (!isAuthenticated || hydrated) return;
    getPreferences()
      .then((prefs) => {
        if (prefs.theme) {
          setTheme(prefs.theme);
          setThemeStoreTheme(prefs.theme);
        }
        if (prefs.density) setDensity(prefs.density);
        if (prefs.fontSize) setFontSize(prefs.fontSize);
        if (typeof prefs.sidebarCollapsed === 'boolean') {
          setSidebarCollapsed(prefs.sidebarCollapsed);
        }
      })
      .finally(() => setHydrated(true));
  }, [
    isAuthenticated,
    hydrated,
    setDensity,
    setFontSize,
    setHydrated,
    setSidebarCollapsed,
    setTheme,
    setThemeStoreTheme,
  ]);

  useEffect(() => {
    if (theme !== themeStoreTheme) {
      setThemeStoreTheme(theme);
    }
  }, [theme, setThemeStoreTheme, themeStoreTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [theme, density, fontSize]);

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <main className={inter.className}>
        <Component {...pageProps} />
        <Toast />
      </main>
    </ThemeProvider>
  );
}
