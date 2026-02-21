import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-tight px-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full rounded-[var(--radius-md)] border border-[var(--color-border)] 
          bg-[var(--color-surface)] px-4 py-2.5 text-sm 
          transition-all duration-200 shadow-sm
          placeholder:text-[var(--color-text-muted)]/70
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]
          disabled:bg-[var(--color-surface-2)] disabled:cursor-not-allowed
          ${error ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20 focus:border-[var(--color-danger)]' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-[10px] text-[var(--color-danger)] font-bold px-1">{error}</span>}
    </div>
  );
}
