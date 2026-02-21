import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function Card({ children, className = '', interactive = false }: CardProps) {
  return (
    <div className={`
      bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]
      shadow-[var(--shadow-premium)]
      ${interactive ? 'transition-all duration-300 hover:shadow-[var(--shadow-premium)] hover:-translate-y-1 cursor-pointer active:scale-[0.98]' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}
