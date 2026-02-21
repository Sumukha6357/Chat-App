import type { ReactNode } from 'react';

export function Footer({ children }: { children?: ReactNode }) {
  return <footer className="border-t border-[var(--color-border)] bg-white p-3">{children}</footer>;
}
