import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Sidebar } from '@/components/layout/Sidebar';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiRequest, markRoomRead, fetchRoomReadState, fetchUsersPresence, searchRoomMessages } from '@/services/api';
import { connectSocket, emitSocket } from '@/services/socket';
import {
  attachPresenceListeners,
  subscribeToRoomPresence,
  unsubscribeFromRoomPresence,
} from '@/services/presence';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useNotificationStore } from '@/store/notificationStore';
import { fetchNotifications } from '@/services/notifications';

export default function RoomPage() {
  const router = useRouter();
  const roomId = router.query.id as string | undefined;
  const auth = useAuthStore();
  const rooms = useChatStore((s) => s.rooms);
  const messages = useChatStore((s) => (roomId ? s.messages[roomId] || [] : []));
  const typingUsers = useChatStore((s) => (roomId ? s.typingUsers[roomId] || [] : []));
  const setRooms = useChatStore((s) => s.setRooms);
  const mergeServerMessages = useChatStore((s) => s.mergeServerMessages);
  const setRoomUnread = useChatStore((s) => s.setRoomUnread);
  const setRoomReadCursor = useChatStore((s) => s.setRoomReadCursor);
  const setRoomMemberReadCursors = useChatStore((s) => s.setRoomMemberReadCursors);
  const upsertUserPresence = useChatStore((s) => s.upsertUserPresence);
  const setActiveRoom = useChatStore((s) => s.setActiveRoom);
  const setNotifications = useNotificationStore((s) => s.setItems);

  const [cursor, setCursor] = useState<{ id: string; createdAt: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | undefined>(undefined);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevLenRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMarkRef = useRef(0);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      router.replace('/');
      return;
    }
    if (auth.accessToken) {
      connectSocket(auth.accessToken);
    }
  }, [auth.isAuthenticated, auth.accessToken, router]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    apiRequest<any[]>('/rooms', { auth: true }).then((data) => {
      setRooms(data);
      data.forEach((room: any) => {
        if (typeof room.unreadCount === 'number') {
          setRoomUnread(room._id, room.unreadCount);
        }
        if (room.lastReadMessageId || room.lastReadAt) {
          setRoomReadCursor(
            room._id,
            room.lastReadMessageId,
            room.lastReadAt ? new Date(room.lastReadAt).getTime() : undefined,
          );
        }
      });
    });
    fetchNotifications().then((data: any) => setNotifications(data));
  }, [auth.isAuthenticated, setRooms, setNotifications]);

  useEffect(() => {
    if (!roomId || roomId === 'new') return;
    setActiveRoom(roomId);
    setLoading(true);
    apiRequest<{ items: any[]; nextCursor: any }>(`/rooms/${roomId}/messages?limit=30`, { auth: true })
      .then((data) => {
        mergeServerMessages(roomId, data.items, 'replace');
        setCursor(data.nextCursor);
        const latest = data.items[0];
        if (latest) {
          markRead(latest._id, latest.createdAt);
        } else {
          setRoomUnread(roomId, 0);
        }
      })
      .finally(() => setLoading(false));
    const current = rooms.find((r) => r._id === roomId);
    if (current?.type === 'direct' && Array.isArray(current.members)) {
      const otherIds = current.members.filter((id: string) => id !== auth.userId);
      if (otherIds.length > 0) {
        fetchUsersPresence(otherIds).then((presence) => {
          const map: Record<string, { status: 'online' | 'offline' | 'away'; lastSeenAt?: number }> = {};
          Object.entries(presence).forEach(([userId, data]) => {
            map[userId] = {
              status: data.status,
              lastSeenAt: data.lastSeenAt ? Number(data.lastSeenAt) : undefined,
            };
          });
          useChatStore.getState().bulkUpsertUserPresence(map);
        });
      }
    }
    fetchRoomReadState(roomId).then((data) => {
      const members = (data?.members || []).map((m) => ({
        userId: m.userId,
        lastReadMessageId: m.lastReadMessageId,
        lastReadAt: m.lastReadAt ? new Date(m.lastReadAt).getTime() : undefined,
      }));
      setRoomMemberReadCursors(roomId, members);
    });
    return () => {
      setActiveRoom(undefined);
    };
  }, [roomId, mergeServerMessages, setActiveRoom, rooms, auth.userId, upsertUserPresence, setRoomMemberReadCursors]);

  useEffect(() => {
    if (!roomId || roomId === 'new') return;
    if (!auth.accessToken) return;
    attachPresenceListeners();
    subscribeToRoomPresence(roomId);
    return () => {
      unsubscribeFromRoomPresence(roomId);
    };
  }, [roomId, auth.accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!roomId) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
      if (atBottom) {
        const latest = messages[messages.length - 1];
        if (latest) markRead(latest._id, latest.createdAt);
        setHasNewMessages(false);
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [roomId, messages]);

  useEffect(() => {
    if (!roomId) return;
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
    if (atBottom) {
      const latest = messages[messages.length - 1];
      if (latest) markRead(latest._id, latest.createdAt);
      setHasNewMessages(false);
    }
  }, [roomId, messages.length]);

  useEffect(() => {
    if (!roomId) return;
    const prevLen = prevLenRef.current;
    const nextLen = messages.length;
    prevLenRef.current = nextLen;
    if (nextLen <= prevLen) return;
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasNewMessages(false);
    } else {
      setHasNewMessages(true);
    }
  }, [messages.length, roomId]);

  const markRead = (lastReadMessageId?: string, lastReadAt?: string) => {
    if (!roomId || !lastReadMessageId || !lastReadAt) return;
    const now = Date.now();
    if (now - lastMarkRef.current < 2000) return;
    lastMarkRef.current = now;
    emitSocket('mark_read', { roomId, messageIds: [lastReadMessageId] });
    markRoomRead(roomId, lastReadMessageId, lastReadAt).finally(() => {
      setRoomReadCursor(roomId, lastReadMessageId, new Date(lastReadAt).getTime());
    });
  };

  const loadMore = async () => {
    if (!roomId || !cursor) return;
    const qs = `?limit=30&cursorId=${cursor.id}&cursorCreatedAt=${encodeURIComponent(cursor.createdAt)}`;
    const data = await apiRequest<{ items: any[]; nextCursor: any }>(
      `/rooms/${roomId}/messages${qs}`,
      { auth: true },
    );
    mergeServerMessages(roomId, data.items, 'append');
    setCursor(data.nextCursor);
  };

  const onSearch = async () => {
    if (!roomId) return;
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    const data = await searchRoomMessages(roomId, term, undefined, 20);
    setSearchResults(data.items || []);
  };

  const onSelectResult = (id: string) => {
    setHighlightedId(id);
    setTimeout(() => setHighlightedId(undefined), 2500);
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    const room = await apiRequest<any>('/rooms', { method: 'POST', auth: true, body: { name: roomName, type: 'group' } });
    setRooms([...rooms, room]);
    router.push(`/rooms/${room._id}`);
  };

  if (roomId === 'new') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6">
        <Card className="w-full max-w-md p-8 shadow-premium animate-in zoom-in-95 fade-in duration-500">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[var(--color-primary)] rounded-2xl flex items-center justify-center text-white text-3xl font-black mx-auto mb-4 shadow-lg shadow-[var(--color-primary)]/20">
              P
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Create a new room</h2>
            <p className="text-sm text-[var(--color-text-muted)] font-medium mt-1">Spaces are where your team communicates.</p>
          </div>

          <div className="space-y-6">
            <Input
              label="Room name"
              placeholder="e.g. general, marketing, random"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            />

            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                className="w-full h-12 text-base font-bold shadow-lg"
                onClick={createRoom}
                disabled={!roomName.trim()}
              >
                Create Room
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const currentRoom = rooms.find((r) => r._id === roomId);

  return (
    <AppShell
      sidebar={<Sidebar />}
      rightPanel={<NotificationPanel />}
    >
      <div className="flex flex-col h-full min-w-0">
        <Header title={currentRoom?.name || 'Room'} subtitle={currentRoom?.type} />

        <div className="flex-1 overflow-y-auto bg-[var(--color-bg)]/50 backdrop-blur-md relative" ref={scrollRef}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/20 z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
            </div>
          )}

          <div className="max-w-4xl mx-auto w-full">
            <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 sticky top-0 z-10 flex items-center justify-between">
              <button
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                onClick={() => setSearchOpen((v) => !v)}
              >
                {searchOpen ? 'Close search' : 'Search in this chat'}
              </button>

              {cursor && (
                <Button variant="ghost" size="sm" onClick={loadMore}>Load earlier messages</Button>
              )}
            </div>

            {searchOpen && (
              <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md sticky top-[37px] z-10 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 rounded-b-2xl mx-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Search messages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                      className="!bg-[var(--color-bg)]"
                    />
                  </div>
                  <Button variant="primary" size="md" onClick={onSearch} className="px-6">Search</Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-4 max-h-60 overflow-y-auto p-2 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] shadow-inner space-y-1">
                    {searchResults.map((m) => (
                      <button
                        key={m._id}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-surface)] hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-[var(--color-border)] group"
                        onClick={() => onSelectResult(m._id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[var(--color-text)] text-xs">User {m.senderId.slice(0, 6)}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{new Date(m.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[var(--color-text)] opacity-80 line-clamp-2">{m.content}</p>
                      </button>
                    ))}
                  </div>
                )}
                {searchTerm && searchResults.length === 0 && !loading && (
                  <div className="mt-4 py-8 text-center bg-[var(--color-bg)] rounded-xl border border-dashed border-[var(--color-border)]">
                    <p className="text-sm text-[var(--color-text-muted)] font-medium">No messages found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>
            )}

            <MessageList messages={messages} highlightedMessageId={highlightedId} />
            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {hasNewMessages && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
            <Button
              size="sm"
              className="rounded-full shadow-lg animate-bounce"
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              New messages ↓
            </Button>
          </div>
        )}

        <div className="bg-[var(--color-surface)]/80 backdrop-blur-md border-t border-[var(--color-border)] z-10">
          <TypingIndicator users={typingUsers} />
          <div className="p-4 max-w-4xl mx-auto w-full">
            <Footer>
              <MessageInput roomId={roomId || ''} />
            </Footer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

