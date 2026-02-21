import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import '@/styles/globals.css';
import { Toast } from '@/components/ui/Toast';
import { useThemeStore } from '@/store/themeStore';

const inter = Inter({ subsets: ['latin'] });

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
