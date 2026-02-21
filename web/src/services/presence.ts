import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { connectSocket, emitSocket } from './socket';

export function updatePresence(userId: string, status: 'online' | 'offline' | 'away') {
  useChatStore.getState().setPresence(userId, status);
}

let listenersAttached = false;
let activeRoomId: string | undefined;
let socketRef: ReturnType<typeof connectSocket> | null = null;

let onPresenceUpdate:
  | ((
      payload:
        | { roomId?: string; onlineCount?: number; count?: number; room?: string }
        | { userId?: string; status?: 'online' | 'offline' | 'away' },
    ) => void)
  | null = null;
let onRoomPresence:
  | ((payload: { roomId?: string; onlineCount?: number; count?: number; room?: string }) => void)
  | null = null;
let onReconnect: (() => void) | null = null;

const INCOMING_EVENT = 'presence_update';
const SUBSCRIBE_EVENT = 'join_room';
const UNSUBSCRIBE_EVENT = 'leave_room';

export function attachPresenceListeners() {
  if (listenersAttached) return;
  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  socketRef = connectSocket(token);
  if (!socketRef) return;

  onPresenceUpdate = (payload) => {
    if (!payload) return;
    if ('userId' in payload && payload.userId && payload.status) {
      updatePresence(payload.userId, payload.status);
      const lastSeenAt =
        typeof (payload as any).lastSeenAt === 'number'
          ? (payload as any).lastSeenAt
          : (payload as any).lastSeenAt
            ? new Date((payload as any).lastSeenAt).getTime()
            : undefined;
      useChatStore.getState().upsertUserPresence(payload.userId, payload.status, lastSeenAt);
    }
    const roomId =
      'roomId' in payload && payload.roomId
        ? payload.roomId
        : 'room' in payload && payload.room
          ? payload.room
          : undefined;
    const onlineCount =
      'onlineCount' in payload && typeof payload.onlineCount === 'number'
        ? payload.onlineCount
        : 'count' in payload && typeof payload.count === 'number'
          ? payload.count
          : undefined;
    if (roomId && typeof onlineCount === 'number') {
      useChatStore.getState().setRoomOnlineCount(roomId, onlineCount);
    }
  };

  onRoomPresence = (payload) => {
    if (!payload) return;
    const roomId =
      payload.roomId || payload.room || undefined;
    const onlineCount =
      typeof payload.onlineCount === 'number'
        ? payload.onlineCount
        : typeof payload.count === 'number'
          ? payload.count
          : undefined;
    if (roomId && typeof onlineCount === 'number' && Number.isFinite(onlineCount)) {
      useChatStore.getState().setRoomOnlineCount(roomId, onlineCount);
    }
  };

  onReconnect = () => {
    if (activeRoomId) {
      emitSocket(SUBSCRIBE_EVENT, { roomId: activeRoomId });
    }
  };

  socketRef.off(INCOMING_EVENT, onPresenceUpdate);
  socketRef.on(INCOMING_EVENT, onPresenceUpdate);
  socketRef.off('room_presence', onRoomPresence);
  socketRef.on('room_presence', onRoomPresence);
  socketRef.off('connect', onReconnect);
  socketRef.on('connect', onReconnect);
  listenersAttached = true;
}

export function detachPresenceListeners() {
  if (!listenersAttached || !socketRef) {
    listenersAttached = false;
    return;
  }
  if (onPresenceUpdate) socketRef.off(INCOMING_EVENT, onPresenceUpdate);
  if (onRoomPresence) socketRef.off('room_presence', onRoomPresence);
  if (onReconnect) socketRef.off('connect', onReconnect);
  listenersAttached = false;
  onPresenceUpdate = null;
  onRoomPresence = null;
  onReconnect = null;
}

export function subscribeToRoomPresence(roomId: string) {
  activeRoomId = roomId;
  emitSocket(SUBSCRIBE_EVENT, { roomId });
}

export function unsubscribeFromRoomPresence(roomId: string) {
  emitSocket(UNSUBSCRIBE_EVENT, { roomId });
  if (activeRoomId === roomId) {
    activeRoomId = undefined;
  }
}

export function resyncRoomPresence(roomId?: string) {
  if (!roomId) return;
  emitSocket('room_presence_sync', { roomId });
}
