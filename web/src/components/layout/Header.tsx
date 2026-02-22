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
  const [topic, setTopic] = useState('');
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

  useEffect(() => {
    setTopic((currentRoom as any)?.topic || '');
  }, [currentRoom]);

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

  const onEditTopic = async () => {
    if (!roomId) return;
    const next = prompt('Channel topic', topic || '');
    if (next === null) return;
    try {
      const updated = await apiRequest<any>(`/rooms/${roomId}`, {
        method: 'PATCH',
        auth: true,
        body: { topic: next },
      });
      useChatStore.getState().setRooms(
        useChatStore
          .getState()
          .rooms.map((r: any) => (r._id === roomId ? { ...r, ...(updated || {}), topic: next } : r)),
      );
      setTopic(next);
      showToast('Topic updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update topic', 'error');
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
      <header className="flex items-center gap-5 px-6 py-4 bg-[var(--color-bg)]/60 backdrop-blur-2xl border-b border-[var(--color-border)] sticky top-0 z-40 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="md:hidden -ml-2 p-2 rounded-full hover:bg-[var(--color-surface-2)] active:scale-90 transition-all">
            <HiChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Clickable avatar → room settings */}
        <button
          onClick={() => setRoomSettingsOpen(true)}
          className="relative shrink-0 active:scale-95 transition-transform group"
          title="Room settings"
        >
          <Avatar
            name={title}
            status={isDirect ? otherPresence?.status : undefined}
            size={48}
            className="shadow-md ring-2 ring-transparent group-hover:ring-[var(--color-primary)]/20 transition-all"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--color-surface)] rounded-full border border-[var(--color-border)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md">
            <HiCog6Tooth className="w-3.5 h-3.5 text-[var(--color-primary)] animate-spin-slow" />
          </div>
        </button>

        <div className="min-w-0">
          <h1 className="text-lg font-black text-[var(--color-text)] tracking-tight truncate leading-none mb-1">
            {title}
          </h1>
          <div className="text-[11px] text-[var(--color-text-muted)] truncate flex items-center gap-2 font-bold uppercase tracking-wider">
            {/* Presence — only show if meaningful */}
            {isDirect && otherPresence ? (
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ring-2 ring-[var(--color-surface)] shadow-sm ${otherPresence?.status === 'online' ? 'bg-[var(--color-success)]' : 'bg-slate-400 opacity-50'}`} />
                {presenceText}
              </span>
            ) : onlineCount > 0 ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-surface)] shadow-sm" />
                {presenceText}
              </span>
            ) : null}

            {subtitle && presenceText && <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />}
            {subtitle && <span className="opacity-60">{subtitle}</span>}
            {topic && <span className="opacity-80 normal-case tracking-normal text-[11px]">• {topic}</span>}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Call buttons (enabled only for direct) */}
          <button
            disabled={!isDirect}
            className="p-2.5 rounded-2xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:scale-110 active:scale-90 disabled:opacity-20 transition-all shadow-sm group"
            title="Voice Call"
            onClick={() => showToast('Calling feature coming soon...', 'info')}
          >
            <HiPhone className="w-5 h-5 group-hover:shake" />
          </button>

          <button
            disabled={!isDirect}
            className="p-2.5 rounded-2xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:scale-110 active:scale-90 disabled:opacity-20 transition-all shadow-sm"
            title="Video Call"
            onClick={() => showToast('Video call feature coming soon...', 'info')}
          >
            <HiVideoCamera className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-[var(--color-border)] mx-1" />

          {failedMessages.length > 0 && (
            <button
              onClick={onRetryAll}
              disabled={isRetrying || isQueueFlushing()}
              className="flex items-center gap-2 bg-[var(--color-danger)] text-white px-4 py-2 rounded-2xl text-xs font-black shadow-lg shadow-danger/20 hover:scale-105 active:scale-95 transition-all"
            >
              <HiExclamationTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Retry ({failedMessages.length})</span>
            </button>
          )}

          <button
            onClick={onSearchToggle}
            className={`p-2.5 rounded-2xl transition-all hover:scale-110 active:scale-90 shadow-sm ${searchOpen ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-primary/20' : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'}`}
            title="Search"
          >
            <HiMagnifyingGlass className="w-5 h-5" />
          </button>

          <button
            onClick={onEditTopic}
            className="p-2.5 rounded-2xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:scale-110 active:scale-90 transition-all shadow-sm"
            title="Edit topic"
          >
            <HiInformationCircle className="w-5 h-5" />
          </button>

          {/* 3-dots Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2.5 rounded-2xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:scale-110 active:scale-90 transition-all shadow-sm ${menuOpen ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : ''}`}
              title="More options"
            >
              <HiEllipsisVertical className="w-6 h-6" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-3 w-56 glass-morphism rounded-2xl shadow-[var(--shadow-premium)] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200 z-50">
                <div className="py-2">
                  <button
                    onClick={() => { setRoomSettingsOpen(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-4 px-5 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-all"
                  >
                    <div className="p-2 rounded-lg bg-[var(--color-primary)]/10">
                      <HiInformationCircle className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <span>Room Info</span>
                  </button>

                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="w-full flex items-center gap-4 px-5 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-all"
                  >
                    <div className="p-2 rounded-lg bg-[var(--color-surface-2)]">
                      <HiArrowPath className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </div>
                    <span>Refresh Presence</span>
                  </button>

                  {isDirect && (
                    <button
                      onClick={onToggleBlock}
                      disabled={isBlocking}
                      className="w-full flex items-center gap-4 px-5 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-all"
                    >
                      <div className={`p-2 rounded-lg ${isBlocked ? 'bg-[var(--color-danger)]/10' : 'bg-[var(--color-surface-2)]'}`}>
                        <HiNoSymbol className={`w-5 h-5 ${isBlocked ? 'text-[var(--color-danger)]' : ''}`} />
                      </div>
                      <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                    </button>
                  )}

                  <div className="h-px bg-[var(--glass-border)] my-2" />

                  <button
                    onClick={onClearChat}
                    className="w-full flex items-center gap-4 px-5 py-3 text-sm font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-all"
                  >
                    <div className="p-2 rounded-lg bg-[var(--color-danger)]/10">
                      <HiTrash className="w-5 h-5 text-[var(--color-danger)]" />
                    </div>
                    <span>Clear Chat</span>
                  </button>

                  <button
                    onClick={onExitRoom}
                    className="w-full flex items-center gap-4 px-5 py-3 text-sm font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-all"
                  >
                    <div className="p-2 rounded-lg bg-[var(--color-danger)]/10">
                      <HiArrowRightOnRectangle className="w-5 h-5 text-[var(--color-danger)]" />
                    </div>
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
