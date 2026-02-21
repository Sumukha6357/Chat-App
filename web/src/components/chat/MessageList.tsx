import { Message } from '@/store/chatStore';
import { MessageCard } from './MessageCard';

export function MessageList({
  messages,
  highlightedMessageId,
}: {
  messages: Message[];
  highlightedMessageId?: string;
}) {
  const items: Array<{ type: 'separator'; label: string } | { type: 'message'; msg: Message; isFirstInGroup: boolean }> = [];

  let lastDateKey = '';
  let lastSenderId = '';
  let lastTime: number = 0;

  messages.forEach((m) => {
    const date = new Date(m.createdAt);
    const dateKey = date.toDateString();

    // Add date separator
    if (dateKey !== lastDateKey) {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let label = date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
      if (dateKey === today.toDateString()) label = 'Today';
      else if (dateKey === yesterday.toDateString()) label = 'Yesterday';

      items.push({ type: 'separator', label });
      lastDateKey = dateKey;
      lastSenderId = ''; // Reset group on new day
    }

    // Determine if it's the start of a new group (sender or time gap > 5m)
    const time = date.getTime();
    const isNewGroup = m.senderId !== lastSenderId || (time - lastTime > 300000);

    items.push({
      type: 'message',
      msg: m,
      isFirstInGroup: isNewGroup
    });

    lastSenderId = m.senderId;
    lastTime = time;
  });

  return (
    <div className="flex flex-col py-8 pb-32">
      {items.map((item, idx) =>
        item.type === 'separator' ? (
          <div key={`sep-${idx}`} className="flex items-center gap-4 my-8 px-6 group/sep">
            <div className="h-px flex-1 bg-[var(--color-border)] group-hover/sep:bg-[var(--color-primary)]/20 transition-colors" />
            <div className="px-4 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                {item.label}
              </span>
            </div>
            <div className="h-px flex-1 bg-[var(--color-border)] group-hover/sep:bg-[var(--color-primary)]/20 transition-colors" />
          </div>
        ) : (
          <MessageCard
            key={item.msg._id || item.msg.clientMessageId}
            message={item.msg}
            highlighted={item.msg._id === highlightedMessageId}
            isFirstInGroup={item.isFirstInGroup}
          />
        ),
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] flex items-center justify-center mb-6 shadow-inner">
            <div className="w-10 h-10 rounded-full border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] animate-spin-slow" />
          </div>
          <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">No messages yet</h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xs">This is the start of your conservation. Say hello!</p>
        </div>
      )}
    </div>
  );
}
