import { useEffect } from 'react';
import { useToastStore } from '@/store/toastStore';
import { HiCheckCircle, HiExclamationCircle, HiInformationCircle, HiXMark } from 'react-icons/hi2';

export function Toast() {
  const { message, type, visible, hide } = useToastStore();

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => hide(), 5000);
    return () => clearTimeout(id);
  }, [visible, hide]);

  if (!visible || !message) return null;

  const styles = {
    error: 'bg-[var(--color-danger)] text-white ring-[var(--color-danger)]/10',
    success: 'bg-[var(--color-success)] text-white ring-[var(--color-success)]/10',
    info: 'bg-[var(--color-primary)] text-white ring-[var(--color-primary)]/10',
  };

  const Icon = type === 'error' ? HiExclamationCircle : type === 'success' ? HiCheckCircle : HiInformationCircle;

  return (
    <div className="fixed bottom-8 right-8 z-[200] animate-in slide-in-from-bottom-4 slide-in-from-right-4 duration-300">
      <div className={`
        flex items-center gap-3 px-5 py-3.5 rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] ring-4
        ${styles[type || 'info']}
      `}>
        <Icon className="shrink-0 w-6 h-6" />
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-sm font-bold tracking-tight">{message}</p>
        </div>
        <button
          onClick={hide}
          className="shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <HiXMark className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
