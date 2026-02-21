import { create } from 'zustand';

export interface Room {
  _id: string;
  name: string;
  slug?: string;
  type: 'direct' | 'group';
  members: string[];
  unreadCount?: number;
}

export interface Message {
  _id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  createdAt: string;
  clientMessageId?: string;
  status?: 'sending' | 'sent' | 'failed';
  attachments?: Array<{
    url: string;
    type: 'image' | 'file';
    name: string;
    size: number;
    mimeType: string;
  }>;
}

export interface OutboundQueueItem {
  roomId: string;
  clientMessageId: string;
  payload: {
    roomId: string;
    content: string;
    type?: string;
    clientMessageId: string;
    attachments?: Array<{
      url: string;
      type: 'image' | 'file';
      name: string;
      size: number;
      mimeType: string;
    }>;
  };
  enqueuedAt: number;
  attemptCount: number;
}

export interface ChatState {
  rooms: Room[];
  messages: Record<string, Message[]>;
  outboundQueue: OutboundQueueItem[];
  typingUsers: Record<string, string[]>;
  presence: Record<string, 'online' | 'offline' | 'away'>;
  roomPresence: Record<string, { onlineCount: number; lastUpdated: number }>;
  roomReadState: Record<string, { lastReadMessageId?: string; lastReadAt?: number; unreadCount: number }>;
  userPresence: Record<string, { status: 'online' | 'offline' | 'away'; lastSeenAt?: number }>;
  roomMemberReadCursors: Record<string, Record<string, { lastReadMessageId?: string; lastReadAt?: number }>>;
  activeRoomId?: string;
  getFailedMessages: (roomId: string) => Message[];
  setRooms: (rooms: Room[]) => void;
  addMessage: (roomId: string, message: Message) => void;
  mergeServerMessages: (
    roomId: string,
    messages: Message[],
    mode?: 'replace' | 'append',
  ) => void;
  setTyping: (roomId: string, userId: string, typing: boolean) => void;
  setPresence: (userId: string, status: 'online' | 'offline' | 'away') => void;
  setRoomOnlineCount: (roomId: string, onlineCount: number) => void;
  clearRoomPresence: (roomId?: string) => void;
  updateMessageId: (
    roomId: string,
    clientMessageId: string,
    newId: string,
    createdAt?: string,
  ) => void;
  setMessageStatus: (roomId: string, clientMessageId: string, status: 'sending' | 'sent' | 'failed') => void;
  enqueueOutbound: (item: OutboundQueueItem) => void;
  dequeueOutbound: (clientMessageId: string) => void;
  incrementOutboundAttempt: (clientMessageId: string) => void;
  retryAllFailed: (roomId: string) => void;
  setRoomUnread: (roomId: string, count: number) => void;
  incrementRoomUnread: (roomId: string) => void;
  setRoomReadCursor: (roomId: string, lastReadMessageId?: string, lastReadAt?: number) => void;
  upsertMemberReadCursor: (
    roomId: string,
    userId: string,
    lastReadMessageId?: string,
    lastReadAt?: number,
  ) => void;
  setRoomMemberReadCursors: (
    roomId: string,
    members: Array<{ userId: string; lastReadMessageId?: string; lastReadAt?: number }>,
  ) => void;
  upsertUserPresence: (
    userId: string,
    status: 'online' | 'offline' | 'away',
    lastSeenAt?: number,
  ) => void;
  bulkUpsertUserPresence: (
    map: Record<string, { status: 'online' | 'offline' | 'away'; lastSeenAt?: number }>,
  ) => void;
  setActiveRoom: (roomId?: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  messages: {},
  outboundQueue: [],
  typingUsers: {},
  presence: {},
  roomPresence: {},
  roomReadState: {},
  userPresence: {},
  roomMemberReadCursors: {},
  activeRoomId: undefined,
  getFailedMessages: (roomId) => {
    const current = get().messages[roomId] || [];
    return current
      .filter((m) => m.status === 'failed')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },
  setRooms: (rooms) => set({ rooms }),
  addMessage: (roomId, message) => {
    const current = get().messages[roomId] || [];
    const existsById = current.some((m) => m._id === message._id);
    if (existsById) return;
    if (message.clientMessageId) {
      const idx = current.findIndex((m) => m.clientMessageId === message.clientMessageId);
      if (idx >= 0) {
        const next = [...current];
        next[idx] = { ...current[idx], ...message, status: 'sent' };
        set({ messages: { ...get().messages, [roomId]: next } });
        return;
      }
    }
    set({ messages: { ...get().messages, [roomId]: [...current, message] } });
  },
  mergeServerMessages: (roomId, messages, mode = 'replace') => {
    const current = get().messages[roomId] || [];
    const byId = new Map(current.map((m) => [m._id, m]));
    const byClientId = new Map(
      current.filter((m) => m.clientMessageId).map((m) => [m.clientMessageId as string, m]),
    );
    const matchedIds = new Set<string>();
    const matchedClientIds = new Set<string>();

    const mergedServer = messages.map((m) => {
      const existing =
        byId.get(m._id) || (m.clientMessageId ? byClientId.get(m.clientMessageId) : undefined);
      if (m._id) matchedIds.add(m._id);
      if (m.clientMessageId) matchedClientIds.add(m.clientMessageId);
      return { ...existing, ...m, status: 'sent' as const };
    });

    const remainingOptimistic = current.filter((m) => {
      if (m.status === 'sent') return false;
      if (m._id && matchedIds.has(m._id)) return false;
      if (m.clientMessageId && matchedClientIds.has(m.clientMessageId)) return false;
      return true;
    });

    let next: Message[] = [];
    if (mode === 'replace') {
      next = [...mergedServer, ...remainingOptimistic];
    } else {
      const existingFiltered = current.filter((m) => {
        if (m._id && matchedIds.has(m._id)) return false;
        if (m.clientMessageId && matchedClientIds.has(m.clientMessageId)) return false;
        return true;
      });
      next = [...existingFiltered, ...mergedServer];
    }

    set({ messages: { ...get().messages, [roomId]: next } });
  },
  setTyping: (roomId, userId, typing) => {
    const current = new Set(get().typingUsers[roomId] || []);
    if (typing) current.add(userId);
    else current.delete(userId);
    set({ typingUsers: { ...get().typingUsers, [roomId]: Array.from(current) } });
  },
  setPresence: (userId, status) => {
    set({ presence: { ...get().presence, [userId]: status } });
  },
  setRoomOnlineCount: (roomId, onlineCount) => {
    set({
      roomPresence: {
        ...get().roomPresence,
        [roomId]: { onlineCount, lastUpdated: Date.now() },
      },
    });
  },
  clearRoomPresence: (roomId) => {
    if (roomId) {
      const next = { ...get().roomPresence };
      delete next[roomId];
      set({ roomPresence: next });
      return;
    }
    set({ roomPresence: {} });
  },
  updateMessageId: (roomId, clientMessageId, newId, createdAt) => {
    const current = get().messages[roomId] || [];
    set({
      messages: {
        ...get().messages,
        [roomId]: current.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, _id: newId, status: 'sent', createdAt: createdAt || m.createdAt }
            : m,
        ),
      },
    });
  },
  setMessageStatus: (roomId, clientMessageId, status) => {
    const current = get().messages[roomId] || [];
    set({
      messages: {
        ...get().messages,
        [roomId]: current.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status } : m,
        ),
      },
    });
  },
  enqueueOutbound: (item) => {
    const current = get().outboundQueue;
    const exists = current.some((q) => q.clientMessageId === item.clientMessageId);
    if (exists) return;
    set({ outboundQueue: [...current, item] });
  },
  dequeueOutbound: (clientMessageId) => {
    set({ outboundQueue: get().outboundQueue.filter((q) => q.clientMessageId !== clientMessageId) });
  },
  incrementOutboundAttempt: (clientMessageId) => {
    set({
      outboundQueue: get().outboundQueue.map((q) =>
        q.clientMessageId === clientMessageId
          ? { ...q, attemptCount: q.attemptCount + 1 }
          : q,
      ),
    });
  },
  retryAllFailed: (roomId) => {
    const state = get();
    const failed = state.getFailedMessages(roomId);
    if (failed.length === 0) return;
    const existing = new Set(state.outboundQueue.map((q) => q.clientMessageId));
    const toEnqueue: OutboundQueueItem[] = [];
    failed.forEach((m) => {
      if (!m.clientMessageId || existing.has(m.clientMessageId)) return;
      toEnqueue.push({
        roomId,
        clientMessageId: m.clientMessageId,
        payload: {
          roomId,
          content: m.content,
          type: m.type,
          clientMessageId: m.clientMessageId,
          attachments: m.attachments,
        },
        enqueuedAt: Date.now(),
        attemptCount: 0,
      });
    });
    if (toEnqueue.length === 0) return;
    set({ outboundQueue: [...state.outboundQueue, ...toEnqueue] });
  },
  setRoomUnread: (roomId, count) => {
    const current = get().roomReadState[roomId] || { unreadCount: 0 };
    set({
      roomReadState: {
        ...get().roomReadState,
        [roomId]: { ...current, unreadCount: Math.max(0, count) },
      },
    });
  },
  incrementRoomUnread: (roomId) => {
    const current = get().roomReadState[roomId] || { unreadCount: 0 };
    set({
      roomReadState: {
        ...get().roomReadState,
        [roomId]: { ...current, unreadCount: (current.unreadCount || 0) + 1 },
      },
    });
  },
  setRoomReadCursor: (roomId, lastReadMessageId, lastReadAt) => {
    const current = get().roomReadState[roomId] || { unreadCount: 0 };
    set({
      roomReadState: {
        ...get().roomReadState,
        [roomId]: {
          ...current,
          lastReadMessageId,
          lastReadAt,
          unreadCount: 0,
        },
      },
    });
  },
  upsertUserPresence: (userId, status, lastSeenAt) => {
    const current = get().userPresence[userId];
    set({
      userPresence: {
        ...get().userPresence,
        [userId]: {
          status,
          lastSeenAt: lastSeenAt || current?.lastSeenAt,
        },
      },
    });
  },
  bulkUpsertUserPresence: (map) => {
    const next = { ...get().userPresence };
    Object.entries(map).forEach(([userId, data]) => {
      next[userId] = {
        status: data.status,
        lastSeenAt: data.lastSeenAt,
      };
    });
    set({ userPresence: next });
  },
  upsertMemberReadCursor: (roomId, userId, lastReadMessageId, lastReadAt) => {
    const currentRoom = get().roomMemberReadCursors[roomId] || {};
    set({
      roomMemberReadCursors: {
        ...get().roomMemberReadCursors,
        [roomId]: {
          ...currentRoom,
          [userId]: { lastReadMessageId, lastReadAt },
        },
      },
    });
  },
  setRoomMemberReadCursors: (roomId, members) => {
    const map: Record<string, { lastReadMessageId?: string; lastReadAt?: number }> = {};
    members.forEach((m) => {
      map[m.userId] = { lastReadMessageId: m.lastReadMessageId, lastReadAt: m.lastReadAt };
    });
    set({
      roomMemberReadCursors: {
        ...get().roomMemberReadCursors,
        [roomId]: map,
      },
    });
  },
  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
}));
