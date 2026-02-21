import { io, Socket } from 'socket.io-client';
import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const WS_URL = process.env.WS_URL || 'http://localhost:3001/ws';

const USER_A = { email: 'userA@example.com', password: 'Password123!' };
const USER_B = { email: 'userB@example.com', password: 'Password123!' };

async function login(user: { email: string; password: string }) {
  const res = await request(API_URL).post('/auth/login').send(user);
  expect(res.status).toBe(201);
  const data = res.body.data || res.body;
  return { accessToken: data.accessToken as string, userId: data.userId as string };
}

async function getRooms(token: string) {
  const res = await request(API_URL)
    .get('/rooms')
    .set('authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  const data = res.body.data || res.body;
  return data as Array<any>;
}

function connectSocket(token: string) {
  return io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
}

function waitForEvent<T = any>(
  socket: Socket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      cleanup();
      resolve(payload);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, handler);
    };
    socket.on(event, handler);
  });
}

describe('WebSocket E2E', () => {
  jest.setTimeout(30000);

  let tokenA: string;
  let tokenB: string;
  let userA: string;
  let userB: string;
  let roomId: string;
  let socketA: Socket;
  let socketB: Socket;

  beforeAll(async () => {
    const a = await login(USER_A);
    const b = await login(USER_B);
    tokenA = a.accessToken;
    tokenB = b.accessToken;
    userA = a.userId;
    userB = b.userId;
    const rooms = await getRooms(tokenA);
    const dm = rooms.find((r) => r.type === 'direct') || rooms[0];
    roomId = dm._id;
  });

  afterEach(async () => {
    socketA?.disconnect();
    socketB?.disconnect();
  });

  it('Join room, send message, receive, room_presence, read_state', async () => {
    socketA = connectSocket(tokenA);
    socketB = connectSocket(tokenB);

    await new Promise<void>((resolve) => socketA.on('connect', () => resolve()));
    await new Promise<void>((resolve) => socketB.on('connect', () => resolve()));

    socketA.emit('join_room', { roomId });
    socketB.emit('join_room', { roomId });

    const roomPresence = await waitForEvent(socketA, 'room_presence');
    expect(roomPresence.roomId).toBe(roomId);

    const messagePromise = waitForEvent(socketB, 'message');
    socketA.emit('send_message', { roomId, content: 'hello ws', clientMessageId: 'ws-1' });
    const msg = await messagePromise;
    expect(msg.roomId).toBe(roomId);
    expect(msg.content).toBe('hello ws');

    const readStatePromise = waitForEvent(socketA, 'read_state');
    socketB.emit('mark_read', { roomId, messageIds: [msg._id] });
    const readState = await readStatePromise;
    expect(readState.roomId).toBe(roomId);
    expect(readState.userId).toBeDefined();
  });

  it('Rate limit triggers for send_message', async () => {
    socketA = connectSocket(tokenA);
    await new Promise<void>((resolve) => socketA.on('connect', () => resolve()));
    socketA.emit('join_room', { roomId });

    const errorPromise = waitForEvent(socketA, 'error', 7000);
    for (let i = 0; i < 7; i++) {
      socketA.emit('send_message', {
        roomId,
        content: `spam ${i}`,
        clientMessageId: `spam-${i}`,
      });
    }
    const err = await errorPromise;
    expect(err).toHaveProperty('message');
  });

  it('Block user prevents message send', async () => {
    const adminToken = tokenA;
    await request(API_URL)
      .post(`/users/${userB}/block`)
      .set('authorization', `Bearer ${adminToken}`);

    socketB = connectSocket(tokenB);
    await new Promise<void>((resolve) => socketB.on('connect', () => resolve()));

    const errorPromise = waitForEvent(socketB, 'error', 7000);
    socketB.emit('send_message', {
      roomId,
      content: 'should be blocked',
      clientMessageId: 'blocked-1',
    });
    const err = await errorPromise;
    expect(err).toHaveProperty('message');

    await request(API_URL)
      .post(`/users/${userB}/unblock`)
      .set('authorization', `Bearer ${adminToken}`);
  });
});
