interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  status?: 'online' | 'offline' | 'away';
  className?: string;
}

export function Avatar({ name, src, size = 40, status, className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 w-max ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--color-primary)] text-white font-bold text-sm overflow-hidden border-2 border-[var(--color-surface)] shadow-md">
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {status && (
        <span
          className={`
            absolute bottom-0 right-0 h-[32%] w-[32%] rounded-full border-2 border-[var(--color-surface)] shadow-sm
            ${status === 'online' ? 'bg-[var(--color-success)]' : ''}
            ${status === 'away' ? 'bg-[var(--color-warning)]' : ''}
            ${status === 'offline' ? 'bg-[var(--color-text-muted)]' : ''}
          `}
        />
      )}
    </div>
  );
}
