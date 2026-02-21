import { useNotificationStore } from '@/store/notificationStore';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { HiBell, HiChatBubbleLeft, HiInformationCircle } from 'react-icons/hi2';

export function NotificationPanel() {
  const items = useNotificationStore((s) => s.items);
  if (!items.length) return null;

  return (
    <div className="fixed right-6 top-24 z-40 w-80 animate-in slide-in-from-right-8 duration-300">
      <Card className="flex flex-col shadow-[var(--shadow-premium)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/30">
          <div className="flex items-center gap-2">
            <HiBell className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-black uppercase tracking-widest">Notifications</h3>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto bg-[var(--color-surface)] scrollbar-hide divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <div key={item._id} className="p-4 hover:bg-[var(--color-surface-hover)] transition-colors group">
              <div className="flex gap-3">
                <div className="shrink-0 pt-0.5">
                  {item.type === 'message' ? (
                    <HiChatBubbleLeft className="w-4 h-4 text-[var(--color-primary)]" />
                  ) : (
                    <HiInformationCircle className="w-4 h-4 text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--color-text)] mb-0.5">
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed group-hover:text-[var(--color-text)] transition-colors">
                    {typeof item.payload === 'string'
                      ? item.payload
                      : String((item.payload as any)?.content || JSON.stringify(item.payload))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 text-center">
          <button className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)] hover:underline">
            Clear all
          </button>
        </div>
      </Card>
    </div>
  );
}
