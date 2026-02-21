import { useToastStore, ToastItem } from '@/store/toastStore';
import { HiCheckCircle, HiExclamationCircle, HiInformationCircle, HiExclamationTriangle, HiXMark } from 'react-icons/hi2';

const CONFIG = {
  error: { icon: HiExclamationCircle, bar: 'bg-[var(--color-danger)]', ring: 'ring-[var(--color-danger)]/20', bg: 'bg-[var(--color-surface)] border-l-4 border-[var(--color-danger)]', label: 'bg-[var(--color-danger)]' },
  success: { icon: HiCheckCircle, bar: 'bg-[var(--color-success)]', ring: 'ring-[var(--color-success)]/20', bg: 'bg-[var(--color-surface)] border-l-4 border-[var(--color-success)]', label: 'bg-[var(--color-success)]' },
  info: { icon: HiInformationCircle, bar: 'bg-[var(--color-primary)]', ring: 'ring-[var(--color-primary)]/20', bg: 'bg-[var(--color-surface)] border-l-4 border-[var(--color-primary)]', label: 'bg-[var(--color-primary)]' },
  warning: { icon: HiExclamationTriangle, bar: 'bg-[var(--color-warning)]', ring: 'ring-[var(--color-warning)]/20', bg: 'bg-[var(--color-surface)] border-l-4 border-[var(--color-warning)]', label: 'bg-[var(--color-warning)]' },
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const cfg = CONFIG[toast.type] || CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl ring-2 min-w-[280px] max-w-[360px]
        ${cfg.bg} ${cfg.ring}
        animate-in slide-in-from-bottom-4 duration-300 ease-out
      `}
    >
      <Icon className={`shrink-0 w-5 h-5 mt-0.5 ${toast.type === 'error' ? 'text-[var(--color-danger)]' : toast.type === 'success' ? 'text-[var(--color-success)]' : toast.type === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-primary)]'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text)] leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        className="shrink-0 p-1 rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors"
      >
        <HiXMark className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} />
        </div>
      ))}
    </div>
  );
}
