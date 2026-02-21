import type { ReactNode } from 'react';

export function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center ${className}`}>{children}</span>;
}
