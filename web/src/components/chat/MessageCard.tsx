import { useAuthStore } from '@/store/authStore';
import { retrySendMessage } from '@/services/socket';
import { Message, useChatStore } from '@/store/chatStore';
import { Avatar } from '../ui/Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Attachment = {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  mimeType: string;
};

type AttachmentPreviewProps = {
  att: Attachment;
  resolveUrl: (url: string) => string;
  isMine: boolean;
};
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
  console.log('MessageCard rendering:', message);
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
    <div
      className={cn(
        "group flex gap-4 px-8 py-2 hover:bg-[var(--color-surface-2)]/40 transition-all duration-500 relative",
        highlighted && "bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20",
        isFirstInGroup ? "mt-10" : "mt-1.5"
      )}
    >
      
      {/* Avatar column */}
      <div className="w-12 shrink-0 flex justify-center items-end pb-1.5">
        {showAvatar && !isMine && isFirstInGroup ? (
          <div className="scale-100 opacity-100">
            <Avatar 
              name={`User ${message.senderId.slice(0, 4)}`} 
              size={44} 
              className="shadow-premium ring-2 ring-white/20 border border-black/5" 
            />
          </div>
        ) : null}
      </div>

      {/* Content wrapper */}
      <div className={cn("flex-1 min-w-0", isMine && "flex flex-col items-end")}>
        {isFirstInGroup && (
          <div className="flex items-center gap-2.5 mb-2.5 px-0.5">
            <span className="text-[14px] font-semibold text-[var(--color-text)] tracking-tight">
              {isMine ? 'You' : `User ${message.senderId.slice(0, 6)}`}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium tracking-tight opacity-50">
              {timeStr}
            </span>
          </div>
        )}

        <div className="relative group/bubble max-w-[90%] sm:max-w-[78%] flex flex-col items-end">
          {/* Action Overlay */}
          <div className={cn(
            "absolute -top-12 opacity-0 group-hover/bubble:opacity-100 translate-y-3 group-hover/bubble:translate-y-0 transition-all duration-400 z-20 flex gap-0.5 p-1 glass-morphism rounded-2xl shadow-premium",
            isMine ? "right-0" : "left-0"
          )}>
            {[
              { icon: HiDocumentDuplicate, label: 'Copy', onClick: onCopy },
              { icon: HiArrowUturnLeft, label: 'Reply', onClick: onThreadReply },
              { icon: HiFaceSmile, label: 'React', onClick: () => onReact('👍') },
              ...(isMine ? [
                { icon: HiPencilSquare, label: 'Edit', onClick: onEdit },
                { icon: HiTrash, label: 'Delete', onClick: onDelete, danger: true }
              ] : [])
            ].map((btn, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={btn.onClick}
                className={cn(
                  "p-2.5 rounded-xl text-[var(--color-text-muted)] transition-colors",
                  btn.danger ? "hover:bg-red-500/10 hover:text-red-500" : "hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                )}
                title={btn.label}
              >
                <btn.icon className="w-5 h-5" />
              </motion.button>
            ))}
          </div>

          <div className={cn(
            "relative rounded-3xl px-6 py-4 shadow-surgical text-[15.5px] leading-[1.65] transition-all duration-400",
            isMine
              ? "bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary)] to-[#7c3aed] text-white font-medium rounded-tr-none shadow-primary/20"
              : "glass-morphism text-[var(--color-text)] rounded-tl-none font-medium"
          )}>
            {message.isDeleted ? (
              <p className="italic opacity-50 tracking-tight">This message was removed</p>
            ) : (
              <>
                {message.content && <p className="whitespace-pre-wrap break-words tracking-tight">{message.content}</p>}
                {message.editedAt && <p className="text-[10px] opacity-60 mt-2 font-medium">Edited</p>}
              </>
            )}

            {attachments.length > 0 && !message.isDeleted && (
              <div className="mt-5 flex flex-wrap gap-4">
                {attachments.map((att) => (
                  <AttachmentPreview key={att.url} att={att} resolveUrl={resolveUrl} isMine={isMine} />
                ))}
              </div>
            )}

            <AnimatePresence>
              {reactions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {reactions.map((r) => (
                    <motion.button
                      key={r.emoji}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onReact(r.emoji)}
                      className="px-3 py-1 rounded-full text-xs glass-morphism bg-black/5 hover:bg-black/10 border-transparent transition-all flex items-center gap-1.5"
                    >
                      <span>{r.emoji}</span>
                      <span className="font-bold opacity-70">{r.count}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {threadCount > 0 && (
              <button onClick={onThreadReply} className="mt-3 text-[11px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-1.5 group/thread">
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 group-hover/thread:scale-125 transition-transform" />
                {threadCount} {threadCount === 1 ? 'Reply' : 'Replies'}
              </button>
            )}

            {/* Inline Meta */}
            <div className={cn(
              "flex items-center justify-end gap-2 mt-3 -mr-1 -mb-1 opacity-60 scale-[0.85] origin-right font-medium",
              isMine ? "text-white/90" : "text-[var(--color-text-muted)]"
            )}>
              {!isFirstInGroup && <span className="text-[11px] tracking-tight">{timeStr}</span>}

              {status === 'sending' && <HiArrowPath className="w-4 h-4 animate-spin" />}
              {status === 'sent' && !showSeen && <HiCheck className="w-5 h-5 opacity-70" />}
              {showSeen && <HiCheckBadge className="w-5 h-5 text-sky-300 drop-shadow-sm" />}
              {status === 'failed' && (
                <button
                  onClick={() => clientMessageId && retrySendMessage(roomId, clientMessageId)}
                  className="flex items-center gap-2 text-white font-bold hover:scale-105 active:scale-95 transition-all bg-red-500 px-3 py-1.5 rounded-full shadow-lg"
                >
                  <HiExclamationCircle className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-widest">Retry</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unread dot column */}
      <div className="w-14 shrink-0 hidden sm:flex items-center justify-center">
        {showSeen && seenCount > 0 && (
          <div 
            className="flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-default"
          >
            <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-[0.15em] opacity-80">Read</span>
            <div className="w-8 h-8 rounded-2xl glass-morphism flex items-center justify-center text-[12px] font-bold text-[var(--color-primary)]">
              {seenCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentPreview({ att, resolveUrl, isMine }: AttachmentPreviewProps) {
  const isImage = att.type === 'image' || att.mimeType?.startsWith('image/');

  if (isImage) {
    return (
      <motion.a
        whileHover={{ scale: 1.02, rotate: 0.5 }}
        whileTap={{ scale: 0.98 }}
        href={resolveUrl(att.url)}
        target="_blank"
        rel="noreferrer"
        className="block group/img overflow-hidden rounded-2xl border border-black/5 shadow-premium"
      >
        <img
          src={resolveUrl(att.url)}
          alt={att.name}
          className="max-h-72 w-full object-cover transition-transform duration-500 group-hover/img:scale-110"
        />
      </motion.a>
    );
  }

  return (
    <motion.a
      whileHover={{ x: 4 }}
      href={resolveUrl(att.url)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all shadow-sm",
        isMine
          ? "bg-black/15 border-white/10 hover:bg-black/25"
          : "glass-morphism hover:bg-[var(--color-surface-soft)] border-black/5"
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center text-[11px] font-bold uppercase tracking-widest">
        {att.name.split('.').pop() || 'File'}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[13px] font-bold truncate max-w-[160px]">{att.name}</span>
        <span className="text-[11px] opacity-60 font-medium">{formatBytes(att.size)}</span>
      </div>
    </motion.a>
  );
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

