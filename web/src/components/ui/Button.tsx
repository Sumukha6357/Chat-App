import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-[var(--radius-sm)]',
    md: 'px-4 py-2 text-sm rounded-[var(--radius-md)]',
    lg: 'px-6 py-3 text-base rounded-[var(--radius-lg)]',
  };

  const styles = {
    primary: 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] shadow-sm hover:shadow-md border border-transparent focus-visible:ring-[var(--color-primary)]/20',
    secondary: 'bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] focus-visible:ring-[var(--color-border)]/50',
    ghost: 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-transparent focus-visible:ring-[var(--color-text-muted)]/20',
    destructive: 'bg-[var(--color-danger)] text-[var(--color-text-on-danger)] hover:opacity-90 shadow-sm border border-transparent focus-visible:ring-[var(--color-danger)]/20',
    outline: 'bg-transparent border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-text-muted)] focus-visible:ring-[var(--color-border)]/50',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
