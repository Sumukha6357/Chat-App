import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useChatStore } from '@/store/chatStore';
import { resyncRoomPresence } from '@/services/presence';
import { flushOutboundQueue, isQueueFlushing } from '@/services/socket';
import { useToastStore } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
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
  const setMessages = useChatStore((s) => (roomId: string, msgs: any[]) => {
    // Note: I might need a more direct way to clear messages in the store if mergeServerMessages isn't enough
    // For now I'll assume we can use a store action to clear
  });
  const presence = roomId ? roomPresence[roomId] : undefined;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cooldownRef = useRef(0);
  const showToast = useToastStore((s) => s.show);
  const activeRoomRef = useRef<string | undefined>(roomId);

  useEffect(() => { activeRoomRef.current = roomId; }, [roomId]);

  const currentRoom = rooms.find((r) => r._id === roomId);
  const isDirect = currentRoom?.type === 'direct';
  const otherUserId = isDirect ? currentRoom?.members?.find((id) => id !== me) : undefined;
  const otherPresence = otherUserId ? userPresence[otherUserId] : undefined;

  useEffect(() => {
    if (!isDirect || !otherUserId) return;
    apiRequest<any>('/users/me', { auth: true }).then(meData => {
      const blocked = Array.isArray(meData?.blockedUserIds) ? meData.blockedUserIds.includes(otherUserId) : false;
      setIsBlocked(blocked);
    }).catch(() => setIsBlocked(false));
  }, [isDirect, otherUserId]);

  // Handle outside click for menu
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
    flushOutboundQueue().finally(() => setIsRetrying(false));
  };

  const onToggleBlock = async () => {
    if (!otherUserId || isBlocking) return;
    setIsBlocking(true);
    try {
      if (isBlocked) {
        await unblockUser(otherUserId);
        setIsBlocked(false);
        showToast('User unblocked', 'success');
      } else {
        await blockUser(otherUserId);
        setIsBlocked(true);
        showToast('User blocked', 'success');
      }
    } catch (e: any) {
      showToast(e?.message || 'Action failed', 'error');
    } finally {
      setIsBlocking(false);
    }
  };

  const onClearChat = async () => {
    if (!roomId) return;
    if (!confirm('Are you sure you want to clear all messages in this chat? This cannot be undone.')) return;
    try {
      await apiRequest(`/rooms/${roomId}/messages`, { method: 'DELETE', auth: true });
      useChatStore.getState().mergeServerMessages(roomId, [], 'replace');
      showToast('Chat cleared', 'success');
      setMenuOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to clear chat', 'error');
    }
  };

  const onExitRoom = async () => {
    if (!roomId) return;
    const msg = isDirect ? 'Are you sure you want to close this chat?' : 'Are you sure you want to leave this group?';
    if (!confirm(msg)) return;
    try {
      await apiRequest(`/rooms/${roomId}/leave`, { method: 'POST', auth: true });
      showToast('Exited room', 'success');
      router.push('/');
    } catch (err: any) {
      showToast(err.message || 'Failed to exit', 'error');
    }
  };

  // Presence text — only show meaningful info
  const onlineCount = presence?.onlineCount ?? 0;
  const presenceText = isDirect && otherPresence
    ? formatLastSeen(otherPresence)
    : onlineCount > 0
      ? `${onlineCount} online`
      : null; // null = show nothing for groups with no one online

  return (
    <>
      <header className="flex items-center gap-4 px-6 py-3 bg-[var(--color-surface)]/90 border-b border-[var(--color-border)] sticky top-0 z-30 shadow-sm backdrop-blur-md">
        {onBack && (
          <Button variant="ghost" onClick={onBack} size="sm" className="md:hidden -ml-2 rounded-full w-9 h-9 p-0">
            <HiChevronLeft className="w-5 h-5" />
          </Button>
        )}

        {/* Clickable avatar → room settings */}
        <button
          onClick={() => setRoomSettingsOpen(true)}
          className="relative shrink-0 group"
          title="Room settings"
        >
          <Avatar
            name={title}
            status={isDirect ? otherPresence?.status : undefined}
            size={44}
            className="shadow-sm group-hover:ring-2 group-hover:ring-[var(--color-primary)]/40 transition-all"
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[var(--color-surface)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
            <HiCog6Tooth className="w-3 h-3 text-[var(--color-primary)]" />
          </div>
        </button>

        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--color-text)] truncate leading-none mb-0.5">
            {title}
          </h1>
          <div className="text-xs text-[var(--color-text-muted)] truncate flex items-center gap-2 font-medium">
            {/* Presence — only show if meaningful */}
            {isDirect && otherPresence ? (
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${otherPresence?.status === 'online' ? 'bg-[var(--color-success)]' : 'bg-slate-400'}`} />
                {presenceText}
              </span>
            ) : onlineCount > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                {presenceText}
              </span>
            ) : null}

            {subtitle && presenceText && <span className="w-1 h-1 rounded-full bg-slate-300 mx-0.5" />}
            {subtitle && <span className="uppercase tracking-widest text-[9px] font-bold opacity-70">{subtitle}</span>}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Call buttons (enabled only for direct) */}
          <Button
            variant="ghost"
            size="sm"
            disabled={!isDirect}
            className="rounded-full w-9 h-9 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-30"
            title="Voice Call"
            onClick={() => showToast('Calling feature coming soon...', 'info')}
          >
            <HiPhone className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!isDirect}
            className="rounded-full w-9 h-9 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-30"
            title="Video Call"
            onClick={() => showToast('Video call feature coming soon...', 'info')}
          >
            <HiVideoCamera className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-[var(--color-border)] mx-1" />

          {failedMessages.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRetryAll}
              disabled={isRetrying || isQueueFlushing()}
              className="gap-2 rounded-full px-4"
            >
              <HiExclamationTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Retry ({failedMessages.length})</span>
            </Button>
          )}

          <Button
            variant={searchOpen ? "primary" : "ghost"}
            size="sm"
            onClick={onSearchToggle}
            className={`rounded-full w-9 h-9 p-0 ${!searchOpen ? 'text-[var(--color-text-muted)]' : ''}`}
            title="Search"
          >
            <HiMagnifyingGlass className="w-4 h-4" />
          </Button>

          {/* 3-dots Menu */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-full w-9 h-9 p-0 text-[var(--color-text-muted)]"
              title="More options"
            >
              <HiEllipsisVertical className="w-5 h-5" />
            </Button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-premium)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50">
                <div className="py-1">
                  <button
                    onClick={() => { setRoomSettingsOpen(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <HiInformationCircle className="w-4 h-4 text-[var(--color-primary)]" />
                    <span>Room Info</span>
                  </button>

                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <HiArrowPath className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh Presence</span>
                  </button>

                  {isDirect && (
                    <button
                      onClick={onToggleBlock}
                      disabled={isBlocking}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <HiNoSymbol className={`w-4 h-4 ${isBlocked ? 'text-[var(--color-danger)]' : ''}`} />
                      <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                    </button>
                  )}

                  <div className="h-px bg-[var(--color-border)] my-1" />

                  <button
                    onClick={onClearChat}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-colors"
                  >
                    <HiTrash className="w-4 h-4" />
                    <span>Clear Chat</span>
                  </button>

                  <button
                    onClick={onExitRoom}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-colors"
                  >
                    <HiArrowRightOnRectangle className="w-4 h-4" />
                    <span>{isDirect ? 'Close Chat' : 'Exit Group'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {roomSettingsOpen && currentRoom && (
        <RoomSettings
          room={currentRoom}
          onClose={() => setRoomSettingsOpen(false)}
        />
      )}
    </>
  );
}

function formatLastSeen(presence?: { status: 'online' | 'offline' | 'away'; lastSeenAt?: number }) {
  if (!presence) return null;
  if (presence.status === 'online') return 'Online';
  if (!presence.lastSeenAt) return 'Last seen recently';
  const last = new Date(presence.lastSeenAt);
  const now = new Date();
  const diff = now.getTime() - last.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (last.toDateString() === now.toDateString()) {
    return `Last seen ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `Last seen ${last.toLocaleDateString([], { day: '2-digit', month: 'short' })}`;
}
