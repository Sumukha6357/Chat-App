import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useChatStore } from '@/store/chatStore';
import { useThemeStore } from '@/store/themeStore';
import { patchPreferences } from '@/services/api';

export function CommandPalette() {
  const router = useRouter();
  const rooms = useChatStore((s) => s.rooms);
  const { theme, toggleTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const actions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base: Array<{ key: string; label: string; run: () => void }> = [
      {
        key: 'toggle-theme',
        label: `Toggle theme (current: ${theme})`,
        run: async () => {
          toggleTheme();
          const next = theme === 'dark' ? 'light' : theme === 'light' ? 'midnight' : 'dark';
          await patchPreferences({ theme: next }).catch(() => null);
        },
      },
      {
        key: 'create-channel',
        label: 'Create channel',
        run: () => router.push('/rooms/new'),
      },
    ];
    rooms.forEach((room) => {
      base.push({
        key: `room-${room._id}`,
        label: `Jump to #${room.name}`,
        run: () => router.push(`/rooms/${room._id}`),
      });
    });
    if (!term) return base;
    return base.filter((a) => a.label.toLowerCase().includes(term));
  }, [query, rooms, router, theme, toggleTheme]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto mt-16 w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-premium)]"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commands..."
          className="w-full border-b border-[var(--color-border)] bg-transparent px-4 py-3 outline-none"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={() => {
                action.run();
                setOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--color-surface-hover)]"
            >
              {action.label}
            </button>
          ))}
          {actions.length === 0 && (
            <div className="px-4 py-3 text-sm text-[var(--color-text-muted)]">No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}

