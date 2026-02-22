import { io, Socket } from 'socket.io-client';
import { useChatStore } from '@/store/chatStore';
import { useNotificationStore } from '@/store/notificationStore';
import { updatePresence } from './presence';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000/ws';

let socket: Socket | null = null;
const pending: Array<{ event: string; payload: any; cb?: (...args: any[]) => void }> = [];
const MAX_ATTEMPTS = 5;
let flushing = false;

export function connectSocket(token: string) {
  if (socket && socket.connected) return socket;

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    const activeRoomId = useChatStore.getState().activeRoomId;
    if (activeRoomId) {
      socket?.emit('join_room', { roomId: activeRoomId });
    }
    while (pending.length > 0) {
      const item = pending.shift();
      if (item) socket?.emit(item.event, item.payload, item.cb);
    }
    flushOutboundQueue();
  });

  socket.on('message', (message) => {
    const state = useChatStore.getState();
    const activeRoomId = state.activeRoomId;
    if (message.clientMessageId) {
      const existing = (state.messages[message.roomId] || []).find(
        (m) => m.clientMessageId === message.clientMessageId,
      );
      if (existing) {
        state.updateMessageId(message.roomId, message.clientMessageId, message._id, message.createdAt);
        state.setMessageStatus(message.roomId, message.clientMessageId, 'sent');
        state.dequeueOutbound(message.clientMessageId);
        return;
      }
    }
    state.addMessage(message.roomId, { ...message, status: 'sent' });
    if (activeRoomId !== message.roomId) {
      state.incrementRoomUnread(message.roomId);
    }
  });

  socket.on('message_edited', (payload) => {
    if (!payload?.roomId || !payload?.message?._id) return;
    patchMessageInStore(payload.roomId, payload.message._id, payload.message);
  });

  socket.on('message_deleted', (payload) => {
    if (!payload?.roomId || !payload?.messageId) return;
    patchMessageInStore(payload.roomId, payload.messageId, payload.message || {});
  });

  socket.on('message_reactions', (payload) => {
    if (!payload?.roomId || !payload?.messageId) return;
    patchMessageInStore(payload.roomId, payload.messageId, { reactions: payload.reactions || [] });
  });

  socket.on('thread_reply', (payload) => {
    if (!payload?.message?.roomId) return;
    useChatStore.getState().addMessage(payload.message.roomId, { ...payload.message, status: 'sent' });
  });

  socket.on('typing_start', (payload) => {
    useChatStore.getState().setTyping(payload.roomId, payload.userId, true);
  });

  socket.on('typing_stop', (payload) => {
    useChatStore.getState().setTyping(payload.roomId, payload.userId, false);
  });

  socket.on('presence_update', (payload) => {
    updatePresence(payload.userId, payload.status);
  });

  socket.on('notification', (payload) => {
    useNotificationStore.getState().addItem({
      _id: payload._id || String(Date.now()),
      type: payload.type,
      payload: payload.payload || {},
      read: false,
      createdAt: new Date().toISOString(),
    });
  });

  socket.on('read_state', (payload) => {
    if (!payload?.roomId) return;
    const lastReadAt = payload.lastReadAt ? new Date(payload.lastReadAt).getTime() : undefined;
    useChatStore.getState().setRoomReadCursor(payload.roomId, payload.lastReadMessageId, lastReadAt);
    if (payload.userId) {
      useChatStore.getState().upsertMemberReadCursor(
        payload.roomId,
        payload.userId,
        payload.lastReadMessageId,
        lastReadAt,
      );
    }
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function emitSocket(event: string, payload: any, cb?: (...args: any[]) => void) {
  if (!socket || !socket.connected) {
    pending.push({ event, payload, cb });
    return;
  }
  socket.emit(event, payload, cb);
}

export function emitMarkRead(roomId: string, messageIds: string[]) {
  if (!roomId || messageIds.length === 0) return;
  emitSocket('mark_read', { roomId, messageIds });
}

export function queueSendMessage(payload: {
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
}) {
  useChatStore.getState().enqueueOutbound({
    roomId: payload.roomId,
    clientMessageId: payload.clientMessageId,
    payload,
    enqueuedAt: Date.now(),
    attemptCount: 0,
  });
  flushOutboundQueue();
}

export function retrySendMessage(roomId: string, clientMessageId: string) {
  const state = useChatStore.getState();
  const message = (state.messages[roomId] || []).find(
    (m) => m.clientMessageId === clientMessageId,
  );
  if (!message) return;
  state.setMessageStatus(roomId, clientMessageId, 'sending');
  queueSendMessage({
    roomId,
    content: message.content,
    type: message.type,
    clientMessageId,
    attachments: message.attachments,
  });
}

export function isQueueFlushing() {
  return flushing;
}

export async function flushOutboundQueue() {
  if (flushing || !socket || !socket.connected) return;
  flushing = true;
  try {
    while (socket && socket.connected) {
      const state = useChatStore.getState();
      const queue = state.outboundQueue;
      if (queue.length === 0) break;
      const item = queue[0];
      if (item.attemptCount >= MAX_ATTEMPTS) {
        state.setMessageStatus(item.roomId, item.clientMessageId, 'failed');
        state.dequeueOutbound(item.clientMessageId);
        continue;
      }

      const ack = await sendWithAck(item.payload);
      if (ack?.ok && ack.messageId) {
        state.updateMessageId(item.roomId, item.clientMessageId, ack.messageId, ack.createdAt);
        state.setMessageStatus(item.roomId, item.clientMessageId, 'sent');
        state.dequeueOutbound(item.clientMessageId);
        continue;
      }

      state.incrementOutboundAttempt(item.clientMessageId);
      if (item.attemptCount + 1 >= MAX_ATTEMPTS) {
        state.setMessageStatus(item.roomId, item.clientMessageId, 'failed');
        state.dequeueOutbound(item.clientMessageId);
      }
      break;
    }
  } finally {
    flushing = false;
  }
}

function sendWithAck(payload: any) {
  return new Promise<any>((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ ok: false });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false });
    }, 5000);
    socket.emit('send_message', payload, (ack: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function patchMessageInStore(roomId: string, messageId: string, patch: any) {
  const state = useChatStore.getState();
  const current = state.messages[roomId] || [];
  const next = current.map((m) => (m._id === messageId ? { ...m, ...patch } : m));
  state.mergeServerMessages(roomId, next, 'replace');
}
