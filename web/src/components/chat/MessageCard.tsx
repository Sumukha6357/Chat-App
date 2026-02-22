import { useAuthStore } from '@/store/authStore';
import { retrySendMessage } from '@/services/socket';
import { Message, useChatStore } from '@/store/chatStore';
import { Avatar } from '../ui/Avatar';
import {
  HiCheck,
  HiCheckBadge,
  HiExclamationCircle,
  HiArrowPath,
  HiDocumentDuplicate,
  HiArrowUturnLeft,
  HiPencilSquare,
  HiTrash,
  HiFaceSmile,
} from 'react-icons/hi2';
import { useToastStore } from '@/store/toastStore';
import {
  addMessageReaction,
  deleteMessage,
  editMessage,
  fetchThread,
  listMessageReactions,
  replyInThread,
  removeMessageReaction,
} from '@/services/api';
import { useEffect, useState } from 'react';

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
  const [reactions, setReactions] = useState<Array<{ emoji: string; count: number; userIds: string[] }>>(
    message.reactions || [],
  );
  const [threadCount, setThreadCount] = useState(0);
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

  useEffect(() => {
    if (!roomId || !message._id) return;
    listMessageReactions(roomId, message._id)
      .then((data) => setReactions(data.reactions || []))
      .catch(() => null);
    fetchThread(roomId, message._id)
      .then((data) => setThreadCount((data.items || []).length))
      .catch(() => null);
  }, [message._id, roomId]);

  const onEdit = async () => {
    const next = prompt('Edit message', message.content);
    if (next === null) return;
    const data = await editMessage(roomId, message._id, next);
    const updated = data.message;
    const current = useChatStore.getState().messages[roomId] || [];
    useChatStore.getState().mergeServerMessages(
      roomId,
      current.map((m) => (m._id === message._id ? { ...m, ...updated } : m)),
      'replace',
    );
  };

  const onDelete = async () => {
    if (!confirm('Delete this message?')) return;
    const data = await deleteMessage(roomId, message._id);
    const updated = data.message;
    const current = useChatStore.getState().messages[roomId] || [];
    useChatStore.getState().mergeServerMessages(
      roomId,
      current.map((m) => (m._id === message._id ? { ...m, ...updated } : m)),
      'replace',
    );
  };

  const onReact = async (emoji: string) => {
    const mine = reactions.find((r) => r.emoji === emoji)?.userIds?.includes(userId || '');
    const data = mine
      ? await removeMessageReaction(roomId, message._id, emoji)
      : await addMessageReaction(roomId, message._id, emoji);
    setReactions(data.reactions || []);
  };

  const onThreadReply = async () => {
    const text = prompt('Reply in thread');
    if (!text) return;
    await replyInThread(roomId, message._id, text);
    const data = await fetchThread(roomId, message._id);
    setThreadCount((data.items || []).length);
    showToast('Reply added to thread', 'success');
  };

  return (
    <div className={`
      group flex gap-3 px-6 py-1.5 hover:bg-[var(--color-surface-hover)]/30 transition-all duration-300 relative
      ${highlighted ? 'bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20' : ''}
      ${isFirstInGroup ? 'mt-8' : 'mt-1'}
    `}>
      {/* Avatar column */}
      <div className="w-12 shrink-0 flex justify-center items-end pb-1">
        {showAvatar && !isMine && isFirstInGroup ? (
          <Avatar name={`User ${message.senderId.slice(0, 4)}`} size={40} className="shadow-lg ring-2 ring-white/10" />
        ) : null}
      </div>

      {/* Content wrapper */}
      <div className={`flex-1 min-w-0 ${isMine ? 'flex flex-col items-end' : ''}`}>
        {isFirstInGroup && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[13px] font-black text-[var(--color-text)] tracking-tight">
              {isMine ? 'You' : `User ${message.senderId.slice(0, 6)}`}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest opacity-40">
              {timeStr}
            </span>
          </div>
        )}

        <div className="relative group/bubble max-w-[88%] sm:max-w-[75%] flex flex-col items-end">
          {/* Action Overlay */}
          <div className={`
            absolute -top-11 opacity-0 group-hover/bubble:opacity-100 translate-y-2 group-hover/bubble:translate-y-0 transition-all duration-300 z-10 flex gap-1 p-1.5 glass-morphism rounded-2xl shadow-premium
            ${isMine ? 'right-0' : 'left-0'}
          `}>
            <button onClick={onCopy} className="p-2 hover:bg-[var(--color-primary)]/10 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all active:scale-90" title="Copy">
              <HiDocumentDuplicate className="w-5 h-5" />
            </button>
            <button onClick={onThreadReply} className="p-2 hover:bg-[var(--color-primary)]/10 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all" title="Reply in thread">
              <HiArrowUturnLeft className="w-5 h-5" />
            </button>
            <button onClick={() => onReact('👍')} className="p-2 hover:bg-[var(--color-primary)]/10 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all" title="React">
              <HiFaceSmile className="w-5 h-5" />
            </button>
            {isMine && (
              <>
                <button onClick={onEdit} className="p-2 hover:bg-[var(--color-primary)]/10 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all" title="Edit">
                  <HiPencilSquare className="w-5 h-5" />
                </button>
                <button onClick={onDelete} className="p-2 hover:bg-[var(--color-danger)]/10 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all" title="Delete">
                  <HiTrash className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          <div className={`
            relative rounded-[20px] px-5 py-3 shadow-premium text-[15px] leading-[1.6] transition-all duration-300
            ${isMine
              ? 'bg-gradient-to-br from-[var(--color-primary)] to-[#818cf8] text-white font-medium rounded-tr-none'
              : 'glass-morphism text-[var(--color-text)] rounded-tl-none font-medium'
            }
          `}>
            {message.isDeleted ? (
              <p className="italic opacity-60">This message was deleted.</p>
            ) : (
              <>
                {message.content && <p className="whitespace-pre-wrap break-words tracking-tight">{message.content}</p>}
                {message.editedAt && <p className="text-[10px] opacity-70 mt-1">(edited)</p>}
              </>
            )}

            {attachments.length > 0 && !message.isDeleted && (
              <div className="mt-4 flex flex-wrap gap-3">
                {attachments.map((att) => (
                  <AttachmentPreview key={att.url} att={att} resolveUrl={resolveUrl} isMine={isMine} />
                ))}
              </div>
            )}

            {reactions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reactions.map((r) => (
                  <button
                    key={r.emoji}
                    onClick={() => onReact(r.emoji)}
                    className="px-2 py-0.5 rounded-full text-xs bg-black/10 hover:bg-black/20"
                  >
                    {r.emoji} {r.count}
                  </button>
                ))}
              </div>
            )}
            {threadCount > 0 && (
              <button onClick={onThreadReply} className="mt-2 text-xs underline underline-offset-2 opacity-80 hover:opacity-100">
                {threadCount} thread repl{threadCount === 1 ? 'y' : 'ies'}
              </button>
            )}

            {/* Inline Meta (Mobile style for isMine) */}
            <div className={`
              flex items-center justify-end gap-1.5 mt-2 -mr-1 -mb-0.5 opacity-70 scale-[0.85] origin-right
              ${isMine ? 'text-white' : 'text-[var(--color-text-muted)]'}
            `}>
              {!isFirstInGroup && <span className="text-[11px] mr-1 font-black tracking-widest uppercase">{timeStr}</span>}

              {status === 'sending' && <HiArrowPath className="w-4 h-4 animate-spin" />}
              {status === 'sent' && !showSeen && <HiCheck className="w-5 h-5" />}
              {showSeen && <HiCheckBadge className="w-5 h-5 text-sky-400" />}
              {status === 'failed' && (
                <button
                  onClick={() => clientMessageId && retrySendMessage(roomId, clientMessageId)}
                  className="flex items-center gap-1.5 text-white/90 font-black hover:scale-105 active:scale-95 transition-all bg-red-500 px-2.5 py-1 rounded-full shadow-lg"
                >
                  <HiExclamationCircle className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-widest">Retry</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unread dot column */}
      <div className="w-14 shrink-0 hidden sm:flex items-center justify-center">
        {showSeen && seenCount > 0 && (
          <div className="flex flex-col items-center gap-1.5 opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-500 pointer-events-none">
            <span className="text-[9px] font-black text-[var(--color-primary)] uppercase tracking-[0.2em] opacity-60">Seen</span>
            <div className="w-7 h-7 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center text-[11px] font-black text-[var(--color-primary)] shadow-inner">
              {seenCount}
            </div>
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
