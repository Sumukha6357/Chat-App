import { useAuthStore } from '@/store/authStore';
import { retrySendMessage } from '@/services/socket';
import { Message, useChatStore } from '@/store/chatStore';
import { Avatar } from '../ui/Avatar';
import { HiCheck, HiCheckBadge, HiExclamationCircle, HiArrowPath, HiDocumentDuplicate, HiArrowUturnLeft } from 'react-icons/hi2';
import { useToastStore } from '@/store/toastStore';

interface MessageCardProps {
  message: Message;
  highlighted?: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
}

export function MessageCard({
  message,
  highlighted,
  showAvatar = true,
  isFirstInGroup = true
}: MessageCardProps) {
  const userId = useAuthStore((s) => s.userId);
  const isMine = message.senderId === userId;
  const roomMemberCursors = useChatStore((s) =>
    message.roomId ? s.roomMemberReadCursors[message.roomId] || {} : {},
  );
  const showToast = useToastStore((s) => s.show);

  const status = message.status || 'sent';
  const roomId = message.roomId;
  const clientMessageId = message.clientMessageId;
  const attachments = message.attachments || [];
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const resolveUrl = (url: string) => (url.startsWith('/') ? `${apiBase}${url}` : url);

  const seenCount = isMine
    ? Object.values(roomMemberCursors).filter((cursor) => {
      if (!cursor) return false;
      if (cursor.lastReadAt && message.createdAt) {
        return cursor.lastReadAt >= new Date(message.createdAt).getTime();
      }
      if (cursor.lastReadMessageId && message._id) {
        return cursor.lastReadMessageId >= message._id;
      }
      return false;
    }).length
    : 0;

  const showSeen = status === 'sent' && seenCount > 0;
  const timeStr = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const onCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      showToast('Copied to clipboard', 'info');
    }
  };

  return (
    <div className={`
      group flex gap-3 px-6 py-1 hover:bg-[var(--color-surface-hover)]/50 transition-colors relative
      ${highlighted ? 'bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/10' : ''}
      ${isFirstInGroup ? 'mt-6' : 'mt-0.5'}
    `}>
      {/* Avatar column */}
      <div className="w-10 shrink-0 flex justify-center">
        {showAvatar && !isMine && isFirstInGroup ? (
          <Avatar name={`User ${message.senderId.slice(0, 4)}`} size={36} className="shadow-sm" />
        ) : null}
      </div>

      {/* Content wrapper */}
      <div className={`flex-1 min-w-0 ${isMine ? 'flex flex-col items-end' : ''}`}>
        {isFirstInGroup && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="text-xs font-bold text-[var(--color-text)]">
              {isMine ? 'You' : `User ${message.senderId.slice(0, 6)}`}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] font-bold opacity-60">
              {timeStr}
            </span>
          </div>
        )}

        <div className="relative group/bubble max-w-[85%] sm:max-w-[70%] flex flex-col items-end">
          {/* Action Overlay */}
          <div className={`
            absolute -top-10 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 z-10 flex gap-0.5 p-1 bg-white border border-[var(--color-border)] rounded-lg shadow-premium
            ${isMine ? 'right-0' : 'left-0'}
          `}>
            <button onClick={onCopy} className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors" title="Copy">
              <HiDocumentDuplicate className="w-4 h-4" />
            </button>
            <button className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors opacity-40 cursor-not-allowed" title="Reply">
              <HiArrowUturnLeft className="w-4 h-4" />
            </button>
          </div>

          <div className={`
            relative rounded-[var(--radius-lg)] px-4 py-2.5 shadow-sm text-sm leading-relaxed
            ${isMine
              ? 'bg-[var(--color-primary)] text-white font-medium rounded-tr-none'
              : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-tl-none'
            }
          `}>
            {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <AttachmentPreview key={att.url} att={att} resolveUrl={resolveUrl} isMine={isMine} />
                ))}
              </div>
            )}

            {/* Inline Meta (Mobile style for isMine) */}
            <div className={`
              flex items-center justify-end gap-1 mt-1 -mr-1 -mb-0.5 opacity-80 scale-90
              ${isMine ? 'text-white' : 'text-[var(--color-text-muted)]'}
            `}>
              {!isFirstInGroup && <span className="text-[10px] mr-1 font-bold">{timeStr}</span>}

              {status === 'sending' && <HiArrowPath className="w-3.5 h-3.5 animate-spin" />}
              {status === 'sent' && !showSeen && <HiCheck className="w-4 h-4" />}
              {showSeen && <HiCheckBadge className="w-4 h-4" />}
              {status === 'failed' && (
                <button
                  onClick={() => clientMessageId && retrySendMessage(roomId, clientMessageId)}
                  className="flex items-center gap-1 text-[var(--color-danger)] font-black hover:underline"
                >
                  <HiExclamationCircle className="w-4 h-4" />
                  <span className="text-[10px]">Retry</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unread dot column (optional) */}
      <div className="w-12 shrink-0 hidden sm:flex items-center justify-center">
        {showSeen && seenCount > 0 && (
          <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
            <span className="text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-tighter">Seen by</span>
            <span className="text-xs font-black text-[var(--color-primary)]">{seenCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentPreview({ att, resolveUrl, isMine }: any) {
  const isImage = att.type === 'image' || att.mimeType?.startsWith('image/');

  if (isImage) {
    return (
      <a
        href={resolveUrl(att.url)}
        target="_blank"
        rel="noreferrer"
        className="block group/img overflow-hidden rounded-[var(--radius-md)] border border-black/5"
      >
        <img
          src={resolveUrl(att.url)}
          alt={att.name}
          className="max-h-64 object-cover transition-transform duration-300 group-hover/img:scale-105"
        />
      </a>
    );
  }

  return (
    <a
      href={resolveUrl(att.url)}
      target="_blank"
      rel="noreferrer"
      className={`
        flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] border transition-all
        ${isMine
          ? 'bg-black/10 border-white/20 hover:bg-black/20'
          : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] hover:bg-[var(--color-surface-active)]'
        }
      `}
    >
      <div className="w-8 h-8 rounded bg-black/10 flex items-center justify-center text-[10px] font-black uppercase">
        {att.name.split('.').pop() || 'File'}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-bold truncate max-w-[150px]">{att.name}</span>
        <span className="text-[10px] opacity-60 font-medium">{formatBytes(att.size)}</span>
      </div>
    </a>
  );
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}
