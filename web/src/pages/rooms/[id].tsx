import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Sidebar } from '@/components/layout/Sidebar';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { Footer } from '@/components/layout/Footer';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest, markRoomRead, fetchRoomReadState, fetchUsersPresence, searchRoomMessages, updateLastState } from '@/services/api';
import { connectSocket, emitSocket } from '@/services/socket';
import {
  attachPresenceListeners,
  subscribeToRoomPresence,
  unsubscribeFromRoomPresence,
} from '@/services/presence';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, Room, Message } from '@/store/chatStore';
import { useNotificationStore } from '@/store/notificationStore';
import { fetchNotifications } from '@/services/notifications';
import { HiMagnifyingGlass, HiXMark, HiChevronDown } from 'react-icons/hi2';

export default function RoomPage() {
  const router = useRouter();
  const slugOrId = router.query.id as string | undefined;
  console.log('RoomPage rendering, slugOrId:', slugOrId);
  const auth = useAuthStore();
  const rooms = useChatStore((s) => s.rooms);

  const currentRoom = rooms.find((r) => r._id === slugOrId || r.slug === slugOrId);
  const roomId = currentRoom?._id || (slugOrId && slugOrId.length === 24 ? slugOrId : undefined);
  
  console.log('Room data:', { slugOrId, currentRoom, roomId, rooms: rooms.length });

  const messages = useChatStore((s) => (roomId ? s.messages[roomId] || [] : []));
  console.log('Current messages for room:', roomId, messages);
  const typingUsers = useChatStore((s) => (roomId ? s.typingUsers[roomId] || [] : []));
  const setRooms = useChatStore((s) => s.setRooms);
  const mergeServerMessages = useChatStore((s) => s.mergeServerMessages);
  const setRoomUnread = useChatStore((s) => s.setRoomUnread);
  const setRoomReadCursor = useChatStore((s) => s.setRoomReadCursor);
  const setRoomMemberReadCursors = useChatStore((s) => s.setRoomMemberReadCursors);
  const upsertUserPresence = useChatStore((s) => s.upsertUserPresence);
  const setActiveRoom = useChatStore((s) => s.setActiveRoom);
  const migrateMessages = useChatStore((s) => s.migrateMessages);
  const setNotifications = useNotificationStore((s) => s.setItems);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ _id: string; content: string; createdAt: string }>>([]);
  const [highlightedId, setHighlightedId] = useState<string | undefined>(undefined);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevLenRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchTerm('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

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
    console.log('Fetching rooms...');
    apiRequest<Room[]>('/rooms', { auth: true }).then((data) => {
      console.log('Rooms fetched:', data);
      setRooms(data);
      data.forEach((room) => {
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
    }).catch((error) => {
      console.error('Error fetching rooms:', error);
    });
    fetchNotifications().then((data) => setNotifications(data));
  }, [auth.isAuthenticated, setRooms, setNotifications, setRoomUnread, setRoomReadCursor]);

  const markRead = (lastReadMessageId?: string, lastReadAt?: string) => {
    if (!roomId || !lastReadMessageId || !lastReadAt) return;
    if (lastReadMessageId.startsWith('msg_')) return;
    const now = Date.now();
    if (now - lastMarkRef.current < 2000) return;
    lastMarkRef.current = now;
    emitSocket('mark_read', { roomId, messageIds: [lastReadMessageId] });
    markRoomRead(roomId, lastReadMessageId, lastReadAt).finally(() => {
      setRoomReadCursor(roomId, lastReadMessageId, new Date(lastReadAt).getTime());
    });
  };

  useEffect(() => {
    if (!roomId || roomId === 'new') return;
    updateLastState(undefined, roomId).catch(() => null);
    setActiveRoom(roomId);
    setTimeout(() => setLoading(true), 0);
    apiRequest<{ items: Message[]; nextCursor: { id?: string; createdAt?: string } | null }>(`/rooms/${roomId}/messages?limit=40`, { auth: true })
      .then((data) => {
        console.log('Messages fetched from API:', data);
        mergeServerMessages(roomId, data.items, 'replace');
        console.log('Messages after merge:', messages);
        const latest = data.items[0];
        if (latest) {
          markRead(latest._id, latest.createdAt);
        } else {
          setRoomUnread(roomId, 0);
        }
      })
      .finally(() => setLoading(false));

    if (currentRoom?.type === 'direct' && Array.isArray(currentRoom.members)) {
      const otherIds = currentRoom.members.filter((id: string) => id !== auth.userId);
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
    if (slugOrId && roomId && slugOrId !== roomId) {
      migrateMessages(slugOrId, roomId);
    }
  }, [slugOrId, roomId, migrateMessages]);

  useEffect(() => {
    if (slugOrId && !currentRoom && slugOrId !== 'new') {
      apiRequest<Room>(`/rooms/${slugOrId}`, { auth: true }).then((data) => {
        setRooms([...rooms, data]);
      }).catch(() => { });
    }
  }, [slugOrId, currentRoom, rooms, setRooms]);

  useEffect(() => {
    if (!roomId || roomId === 'new') return;
    if (!auth.accessToken) return;
    attachPresenceListeners();
    subscribeToRoomPresence(roomId);
    
    // Join the room via WebSocket
    emitSocket('join_room', { roomId });
    
    return () => {
      unsubscribeFromRoomPresence(roomId);
      emitSocket('leave_room', { roomId });
    };
  }, [roomId, auth.accessToken]);

  useEffect(() => {
    if (!roomId) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 32;
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
    const prevLen = prevLenRef.current;
    const nextLen = messages.length;
    prevLenRef.current = nextLen;
    if (nextLen <= prevLen) return;
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 32;
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => setHasNewMessages(false), 0);
    } else {
      setTimeout(() => setHasNewMessages(true), 0);
    }
  }, [messages.length, roomId]);

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
    setTimeout(() => setHighlightedId(undefined), 3000);
  };

  const createRoom = async () => {
    console.log('createRoom function called!');
    if (!roomName.trim()) {
      console.log('Room name is empty, returning');
      return;
    }
    console.log('Creating room with name:', roomName);
    console.log('About to call API...');
    
    try {
      console.log('Calling POST /rooms...');
      const room = await apiRequest<Room>('/rooms', { method: 'POST', auth: true, body: { name: roomName, type: 'group' } });
      console.log('Room created successfully:', room);
      setRooms([...rooms, room]);
      router.push(`/rooms/${room._id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Check console for details.');
    }
  };

  if (roomId === 'new') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md"
        >
          <Card className="p-10 shadow-premium border border-[var(--color-border)]/50 glass-morphism overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-primary)]/40 via-[var(--color-primary)] to-[var(--color-primary)]/40 animate-pulse" />
            
            <div className="text-center mb-10">
              <motion.div 
                whileHover={{ rotate: 5, scale: 1.05 }}
                className="w-20 h-20 bg-gradient-to-br from-[var(--color-primary)] to-[#7c3aed] rounded-3xl flex items-center justify-center text-white text-4xl font-black mx-auto mb-6 shadow-premium"
              >
                P
              </motion.div>
              <h2 className="text-3xl font-bold text-[var(--color-text)] tracking-tight">New Space</h2>
              <p className="text-[13px] text-[var(--color-text-muted)] font-bold uppercase tracking-[0.15em] mt-2 opacity-60">Establish your communication hub</p>
            </div>

            <div className="space-y-8">
              <Input
                label="Space Designation"
                placeholder="e.g. core-engine, architecture, general"
                value={roomName}
                onChange={(e) => {
                  console.log('Input changed:', e.target.value);
                  setRoomName(e.target.value);
                }}
                onKeyDown={(e) => {
                  console.log('Key pressed:', e.key, 'roomName:', roomName);
                  if (e.key === 'Enter') createRoom();
                }}
                className="bg-black/5 border-none h-14"
              />
              
              {/* DEBUG: Show current roomName */}
              <div className="text-xs text-gray-500">
                DEBUG: roomName = "{roomName}" (trimmed: "{roomName.trim()}")
              </div>

              <div className="flex flex-col gap-4">
                <Button
                  variant="primary"
                  className="w-full h-14 text-[15px] font-bold shadow-premium rounded-[20px]"
                  onClick={() => {
                    console.log('Initialize Room button clicked!');
                    createRoom();
                  }}
                  disabled={!roomName.trim()}
                >
                  Initialize Room {!roomName.trim() && '(disabled)'}
                </Button>
                
                {/* TEST: Simple test button */}
                <button
                  className="w-full h-12 text-sm font-bold text-red-500 hover:text-red-700 border border-red-500 rounded"
                  onClick={() => {
                    console.log('Test button clicked!');
                    alert('Test button works!');
                  }}
                >
                  Test Button
                </button>
                
                <button
                  className="w-full h-12 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  onClick={() => router.back()}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Handle case where room doesn't exist yet
  if (!currentRoom && slugOrId && slugOrId !== 'new') {
    return (
      <AppShell sidebar={<Sidebar />}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-[var(--color-surface-2)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent animate-spin"></div>
            </div>
            <p className="text-[var(--color-text-muted)] mb-4">Loading room...</p>
            <Button onClick={() => router.push('/rooms/new')} className="mx-auto">
              Create New Room
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell sidebar={<Sidebar />}>
      <CommandPalette />
      <div className="flex flex-col h-full min-w-0 bg-[var(--color-bg)] relative z-10">
        <Header
          title={currentRoom?.name || 'Session'}
          subtitle={currentRoom?.type}
          searchOpen={searchOpen}
          onSearchToggle={() => setSearchOpen(!searchOpen)}
        />

        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          <AnimatePresence>
            {searchOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-[var(--color-border)]/50 glass-morphism overflow-hidden z-30"
                ref={searchRef}
              >
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 relative group">
                    <HiMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors pointer-events-none" />
                    <input
                      autoFocus
                      className="w-full bg-black/5 hover:bg-black/10 focus:bg-white/5 border-none rounded-2xl pl-12 pr-10 py-3 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] opacity-80 outline-none transition-all"
                      placeholder="Audit intelligence logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => { setSearchTerm(''); setSearchResults([]); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-[var(--color-danger)]/10 text-[var(--color-text-muted)] hover:text-red-500 transition-all"
                      >
                        <HiXMark className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {searchTerm && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-4xl mx-auto px-6 pb-6"
                    >
                      {searchResults.length > 0 ? (
                        <div className="max-h-80 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                          {searchResults.map((m) => (
                            <motion.button
                              whileHover={{ x: 4, backgroundColor: 'rgba(var(--color-primary-rgb), 0.05)' }}
                              key={m._id}
                              className="w-full px-5 py-4 text-left rounded-2xl border border-transparent hover:border-[var(--color-primary)]/10 transition-all group glass-morphism"
                              onClick={() => { onSelectResult(m._id); setSearchOpen(false); }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-[var(--color-primary)] text-[11px] uppercase tracking-widest opacity-80">Message {m._id.slice(-8)}</span>
                                <span className="text-[10px] text-[var(--color-text-muted)] font-black uppercase">{new Date(m.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[var(--color-text)] text-sm opacity-90 leading-relaxed">{m.content}</p>
                            </motion.button>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center bg-black/5 rounded-3xl border border-dashed border-[var(--color-border)]">
                          <p className="text-[13px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest opacity-40">Intelligence search pending...</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <div 
            className="flex-1 overflow-y-auto relative py-4 modern-scroll" 
            ref={scrollRef}
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          >
            {/* TEST: Direct test in container */}
            <div className="bg-blue-500 text-white p-4 m-4 rounded">
              CONTAINER TEST: Messages should appear here
            </div>
            
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-8">
              {/* TEST: Direct test before MessageList */}
              <div style={{ backgroundColor: 'orange', color: 'white', padding: '20px', margin: '10px', borderRadius: '5px' }}>
                DIRECT TEST: About to render MessageList with {messages.length} messages
              </div>
              
              {/* TEST: Try rendering messages directly */}
              {messages.map((msg, index) => (
                <div key={msg._id || msg.clientMessageId || index} style={{ backgroundColor: 'yellow', color: 'black', padding: '10px', margin: '5px', borderRadius: '3px' }}>
                  DIRECT MESSAGE: {msg.content} (from {msg.senderId})
                </div>
              ))}
              
              <MessageList messages={messages} highlightedMessageId={highlightedId} />
              <div ref={bottomRef} className="h-8" />
            </div>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/40 backdrop-blur-[2px] z-10">
                <div className="w-12 h-12 rounded-2xl border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] animate-spin" />
              </div>
            )}
          </div>

          <AnimatePresence>
            {hasNewMessages && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40"
              >
                <button
                  onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-3 bg-[var(--color-primary)] text-white px-6 py-3 rounded-full font-bold text-xs shadow-premium hover:scale-105 active:scale-95 transition-all group"
                >
                  <span className="uppercase tracking-widest">Unread Sync</span>
                  <HiChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-[var(--color-bg)]/80 backdrop-blur-2xl border-t-[0.5px] border-[var(--color-border)] z-20">
            <TypingIndicator users={typingUsers} />
            <div className="max-w-4xl mx-auto w-full">
              <Footer>
                <MessageInput roomId={roomId || ''} />
              </Footer>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
