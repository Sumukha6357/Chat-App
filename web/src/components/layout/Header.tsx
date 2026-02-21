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
import { HiArrowPath, HiNoSymbol, HiExclamationTriangle, HiChevronLeft, HiCog6Tooth } from 'react-icons/hi2';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function Header({ title, subtitle, onBack }: HeaderProps) {
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

        <div className="flex items-center gap-2">
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

          {/* Settings button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRoomSettingsOpen(true)}
            className="rounded-full w-9 h-9 p-0"
            title="Room settings"
          >
            <HiCog6Tooth className="w-4 h-4" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`rounded-full w-9 h-9 p-0 ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh presence"
          >
            <HiArrowPath className="w-4 h-4" />
          </Button>

          {isDirect && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleBlock}
              disabled={isBlocking}
              className={`rounded-full w-9 h-9 p-0 ${isBlocked ? 'text-[var(--color-danger)] border-[var(--color-danger)]/20' : ''}`}
              title={isBlocked ? 'Unblock user' : 'Block user'}
            >
              <HiNoSymbol className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Room settings slide-in */}
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
