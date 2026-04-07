import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useChatStore } from '@/store/chatStore';
import { resyncRoomPresence } from '@/services/presence';
import { flushOutboundQueue, isQueueFlushing } from '@/services/socket';
import { useToastStore } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiRequest, blockUser, unblockUser } from '@/services/api';
import { RoomSettings } from './RoomSettings';
import {
  HiArrowPath, HiNoSymbol, HiExclamationTriangle, HiChevronLeft, HiCog6Tooth,
  HiEllipsisVertical, HiMagnifyingGlass, HiPhone, HiVideoCamera, HiTrash,
  HiArrowRightOnRectangle, HiInformationCircle
} from 'react-icons/hi2';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSearchToggle: () => void;
  searchOpen: boolean;
}

export function Header({ title, subtitle, onBack, onSearchToggle, searchOpen }: HeaderProps) {
  const router = useRouter();
  const roomId = router.query.id as string | undefined;
  const roomPresence = useChatStore((s) => s.roomPresence);
  const rooms = useChatStore((s) => s.rooms);
  const userPresence = useChatStore((s) => s.userPresence);
  const me = useAuthStore((s) => s.userId);
  const failedMessages = useChatStore((s) => (roomId ? s.getFailedMessages(roomId) : []));
  const retryAllFailed = useChatStore((s) => s.retryAllFailed);
  const presence = roomId ? roomPresence[roomId] : undefined;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const cooldownRef = useRef(0);
  const showToast = useToastStore((s) => s.show);

  const currentRoom = rooms.find((r) => r._id === roomId);
  const isDirect = currentRoom?.type === 'direct';
  const otherUserId = isDirect ? currentRoom?.members?.find((id) => id !== me) : undefined;
  const otherPresence = otherUserId ? userPresence[otherUserId] : undefined;

  useEffect(() => {
    if (!isDirect || !otherUserId) return;
    apiRequest<{ blockedUserIds: string[] }>('/users/me', { auth: true }).then(meData => {
      const blocked = Array.isArray(meData?.blockedUserIds) ? meData.blockedUserIds.includes(otherUserId) : false;
      setIsBlocked(blocked);
    }).catch(() => setIsBlocked(false));
  }, [isDirect, otherUserId]);

  useEffect(() => {
    setTopic(currentRoom?.topic || '');
  }, [currentRoom]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const onRefresh = () => {
    if (!roomId) return;
    const now = Date.now();
    if (now - cooldownRef.current < 2000) return;
    cooldownRef.current = now;
    setIsRefreshing(true);
    resyncRoomPresence(roomId);
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  const onRetryAll = () => {
    if (!roomId || failedMessages.length === 0 || isQueueFlushing()) return;
    setIsRetrying(true);
    retryAllFailed(roomId);
    flushOutboundQueue().finally(() => setIsRetrying(true));
    setTimeout(() => setIsRetrying(false), 1500);
  };

  const onToggleBlock = async () => {
    if (!otherUserId || isBlocking) return;
    setIsBlocking(true);
    try {
      if (isBlocked) {
        await unblockUser(otherUserId);
        setIsBlocked(false);
        showToast('User unblocked', 'info');
      } else {
        await blockUser(otherUserId);
        setIsBlocked(true);
        showToast('User blocked', 'warning');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Action failed';
      showToast(message, 'error');
    } finally {
      setIsBlocking(false);
    }
  };

  const onClearChat = async () => {
    if (!roomId) return;
    if (!confirm('Clear all messages history?')) return;
    try {
      await apiRequest(`/rooms/${roomId}/messages`, { method: 'DELETE', auth: true });
      useChatStore.getState().mergeServerMessages(roomId, [], 'replace');
      showToast('Chat history cleared', 'info');
      setMenuOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      showToast(message, 'error');
    }
  };

  const onExitRoom = async () => {
    if (!roomId) return;
    if (!confirm('Leave this conversation?')) return;
    try {
      await apiRequest(`/rooms/${roomId}/leave`, { method: 'POST', auth: true });
      showToast('You have left the chat', 'info');
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to exit';
      showToast(message, 'error');
    }
  };

  const onlineCount = presence?.onlineCount ?? 0;
  const presenceText = isDirect && otherPresence
    ? formatLastSeen(otherPresence)
    : onlineCount > 1
      ? `${onlineCount} agents active`
      : onlineCount === 1 ? '1 agent active' : null;

  return (
    <>
      <header className="flex items-center gap-6 px-8 py-5 glass-morphism border-b-[0.5px] border-[var(--color-border)] sticky top-0 z-40 transition-all duration-500 overflow-hidden">
        {/* Entrance Light Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/5 via-transparent to-transparent pointer-events-none" />

        {onBack && (
          <motion.button 
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack} 
            className="md:hidden -ml-2 p-2.5 rounded-full hover:bg-[var(--color-surface-2)] transition-all"
          >
            <HiChevronLeft className="w-6 h-6" />
          </motion.button>
        )}

        <motion.button
          layoutId={`avatar-${roomId}`}
          onClick={() => setRoomSettingsOpen(true)}
          className="relative shrink-0 group"
          title="Profile & Settings"
        >
          <div className="relative">
            <Avatar
              name={title}
              status={isDirect ? otherPresence?.status : undefined}
              size={52}
              className="shadow-premium ring-2 ring-white/10 group-hover:ring-[var(--color-primary)]/30 transition-all duration-500"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              whileHover={{ opacity: 1, scale: 1 }}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex items-center justify-center shadow-premium"
            >
              <HiCog6Tooth className="w-4 h-4 text-[var(--color-primary)] animate-spin-slow" />
            </motion.div>
          </div>
        </motion.button>

        <div className="min-w-0 flex-1">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-[19px] font-bold text-[var(--color-text)] tracking-tight truncate leading-tight flex items-center gap-2">
              {title}
              {isDirect && otherPresence?.status === 'online' && (
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
              )}
            </h1>
            <div className="text-[11px] text-[var(--color-text-muted)] truncate flex items-center gap-2.5 font-bold uppercase tracking-[0.1em] mt-1 opacity-70">
              {presenceText && (
                <span className="flex items-center gap-2">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isDirect && otherPresence?.status === 'online' ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]/40"
                  )} />
                  {presenceText}
                </span>
              )}

              {(subtitle || topic) && presenceText && <span className="opacity-20">|</span>}
              {topic ? (
                <span className="normal-case tracking-tight font-medium text-[12px] opacity-80">{topic}</span>
              ) : subtitle ? (
                <span className="opacity-60">{subtitle}</span>
              ) : null}
            </div>
          </motion.div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          {/* Action Toolbar */}
          <div className="hidden sm:flex items-center gap-1 p-1 bg-[var(--color-surface-2)]/50 rounded-2xl border border-[var(--color-border)]/50">
            {[
              { icon: HiPhone, label: 'Voice', disabled: !isDirect, onClick: () => showToast('Voice link encrypted...', 'info') },
              { icon: HiVideoCamera, label: 'Video', disabled: !isDirect, onClick: () => showToast('Video stream initializing...', 'info') },
              { icon: HiMagnifyingGlass, label: 'Search', active: searchOpen, onClick: onSearchToggle }
            ].map((btn, i) => (
              <motion.button
                key={i}
                disabled={btn.disabled}
                whileHover={!btn.disabled ? { scale: 1.05, backgroundColor: 'var(--color-surface-pure)' } : {}}
                whileTap={!btn.disabled ? { scale: 0.95 } : {}}
                onClick={btn.onClick}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-300 relative",
                  btn.active ? "text-[var(--color-primary)] bg-[var(--color-surface-pure)] shadow-premium" : "text-[var(--color-text-muted)] opacity-60 hover:opacity-100",
                  btn.disabled && "opacity-10"
                )}
                title={btn.label}
              >
                <btn.icon className="w-5 h-5" />
                {btn.active && (
                  <motion.div layoutId="header-active-tab" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                )}
              </motion.button>
            ))}
          </div>

          {failedMessages.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRetryAll}
              disabled={isRetrying}
              className="flex items-center gap-2.5 bg-red-500 text-white px-5 py-2.5 rounded-2xl text-[12px] font-bold shadow-premium shadow-red-500/20"
            >
              <HiExclamationTriangle className={cn("w-4 h-4", isRetrying && "animate-bounce")} />
              <span>Retry {failedMessages.length}</span>
            </motion.button>
          )}

          {/* Menu */}
          <div className="relative" ref={menuRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "p-3 rounded-2xl transition-all shadow-premium",
                menuOpen ? "bg-[var(--color-primary)] text-white" : "glass-morphism text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              )}
            >
              <HiEllipsisVertical className="w-6 h-6" />
            </motion.button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute right-0 mt-4 w-64 glass-morphism rounded-[24px] shadow-premium overflow-hidden z-50 p-2"
                >
                  <div className="space-y-1">
                    {[
                      { icon: HiInformationCircle, label: 'Room Intelligence', onClick: () => { setRoomSettingsOpen(true); setMenuOpen(false); }, primary: true },
                      { icon: HiArrowPath, label: 'Sync Presence', onClick: onRefresh, loading: isRefreshing },
                      ...(isDirect ? [{ icon: HiNoSymbol, label: isBlocked ? 'Unblock Identity' : 'Secure Block', onClick: onToggleBlock, danger: !isBlocked, warning: isBlocked }] : []),
                      { type: 'separator' as const },
                      { icon: HiTrash, label: 'Wipe History', onClick: onClearChat, danger: true },
                      { icon: HiArrowRightOnRectangle, label: isDirect ? 'Close Session' : 'Depart Group', onClick: onExitRoom, danger: true }
                    ].map((item, i) => (
                      item.type === 'separator' ? (
                        <div key={i} className="h-px bg-[var(--color-border)]/50 my-2 mx-3" />
                      ) : (
                        <button
                          key={i}
                          onClick={item.onClick}
                          className={cn(
                            "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-[14px] font-semibold transition-all group",
                            item.danger ? "text-red-500 hover:bg-red-500/10" : "text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg transition-colors group-hover:shadow-inner",
                            item.danger ? "bg-red-500/10" : item.primary ? "bg-[var(--color-primary)]/10" : "bg-[var(--color-surface-2)]"
                          )}>
                            <item.icon className={cn("w-5 h-5", item.loading && "animate-spin")} />
                          </div>
                          <span>{item.label}</span>
                        </button>
                      )
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {roomSettingsOpen && currentRoom && (
        <RoomSettings room={currentRoom} onClose={() => setRoomSettingsOpen(false)} />
      )}
    </>
  );
}

function formatLastSeen(presence?: { status: 'online' | 'offline' | 'away'; lastSeenAt?: number }) {
  if (!presence) return null;
  if (presence.status === 'online') return 'Active Now';
  if (!presence.lastSeenAt) return 'Last seen recently';
  const last = new Date(presence.lastSeenAt);
  const now = new Date();
  const diff = now.getTime() - last.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (last.toDateString() === now.toDateString()) {
    return `Active at ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `Active on ${last.toLocaleDateString([], { day: '2-digit', month: 'short' })}`;
}
