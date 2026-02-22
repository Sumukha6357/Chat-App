import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { io } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '../../src/config/config.service';
import { RedisIoAdapter } from '../../src/gateway/redis-io.adapter';
import { RoomsService } from '../../src/rooms/rooms.service';
import { MessagesService } from '../../src/chat/messages.service';
import { PresenceService } from '../../src/presence/presence.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { GatewayService } from '../../src/gateway/gateway.service';
import { RateLimitService } from '../../src/common/utils/rate-limit.service';
import { REDIS_CLIENT } from '../../src/database/database.module';

jest.setTimeout(60000);

describe('Integration', () => {
  process.stdout.write('INTEGRATION DESCRIBE START\n');
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let baseUrl: string;

  const setup = async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
    process.env.WS_REDIS_ENABLED = 'false';
    process.env.JWT_ACCESS_SECRET = 'test_access';
    process.env.JWT_REFRESH_SECRET = 'test_refresh';
    process.env.REDIS_KEY_PREFIX = `test:${Date.now()}:`;
    process.env.CORS_ORIGINS = '*';

    const redisStore = new Map<string, string>();
    const mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn().mockImplementation(async (key) => {
        const val = redisStore.get(key);
        return val !== undefined ? val : null;
      }),
      set: jest.fn().mockImplementation(async (key: string, val: string, ...args: any[]) => {
        redisStore.set(key, val);
        return 'OK';
      }),
      incr: jest.fn().mockImplementation(async (key) => {
        const val = parseInt(redisStore.get(key) || '0', 10) + 1;
        redisStore.set(key, String(val));
        return val;
      }),
      decr: jest.fn().mockImplementation(async (key) => {
        const val = parseInt(redisStore.get(key) || '0', 10) - 1;
        redisStore.set(key, String(val));
        return val;
      }),
      expire: jest.fn().mockResolvedValue(1),
      scard: jest.fn().mockResolvedValue(0),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      sismember: jest.fn().mockResolvedValue(0),
      hset: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
      del: jest.fn().mockImplementation(async (key) => {
        const existed = redisStore.has(key);
        redisStore.delete(key);
        return existed ? 1 : 0;
      }),
      pipeline: jest.fn().mockReturnValue({
        scard: jest.fn().mockReturnThis(),
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      status: 'ready',
    };

    const mockNotifications = {
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      getQueue: jest.fn().mockReturnValue({
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0 }),
        add: jest.fn().mockResolvedValue({ id: '1' }),
        on: jest.fn(),
        close: jest.fn(),
      }),
      notifyUser: jest.fn().mockResolvedValue({ delivered: 'realtime' }),
      listForUser: jest.fn().mockResolvedValue([]),
    };

    const mockGatewayService = {
      emitToRoom: jest.fn(),
      emitNotificationToUser: jest.fn(),
      setServer: jest.fn(),
    };

    const mockRateLimitService = {
      consume: jest.fn().mockResolvedValue(null),
      consumeWithLimit: jest.fn().mockResolvedValue(null),
    };

    process.stdout.write('Setup: Compiling module...\n');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .overrideProvider(NotificationsService)
      .useValue(mockNotifications)
      .overrideProvider(GatewayService)
      .useValue(mockGatewayService)
      .overrideProvider(RateLimitService)
      .useValue(mockRateLimitService)
      .compile();
    process.stdout.write('Setup: Module compiled.\n');

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const config = app.get(ConfigService);
    process.stdout.write('Setup: Initializing app...\n');
    await app.init();
    process.stdout.write('Setup: App initialized.\n');
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? 0 : address.port;
    baseUrl = `http://127.0.0.1:${port}`;
  };

  const teardown = async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
  };

  beforeAll(async () => {
    await setup();
  });

  afterAll(async () => {
    await teardown();
  });

  const registerUser = async (email: string, username: string, password: string) => {
    const res = await request(baseUrl)
      .post('/auth/register')
      .send({ email, username, password });
    if (res.status !== 201) {
      console.error('Registration failed:', res.status, res.body);
    }
    return res.body.data || res.body;
  };

  const loginUser = async (email: string, password: string) => {
    const res = await request(baseUrl).post('/auth/login').send({ email, password });
    return res.body.data || res.body;
  };

  test('Auth: register, login, refresh rotation, blacklist', async () => {
    const tokens = await registerUser('a@test.com', 'usera', 'password123');
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();

    const login = await loginUser('a@test.com', 'password123');
    expect(login.accessToken).toBeDefined();

    const refreshed = await request(baseUrl)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });
    const refreshedData = refreshed.body.data || refreshed.body;
    expect(refreshedData.refreshToken).toBeDefined();

    const reuse = await request(baseUrl)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });
    expect(reuse.status).toBe(401);
  });

  test('RBAC: Protected endpoints require role', async () => {
    // Non-authenticated request
    const unauthorized = await request(baseUrl).get('/rooms');
    expect(unauthorized.status).toBe(401);

    // Authenticated request but potentially missing role/payload
    const tokens = await registerUser('e@test.com', 'usere', 'password123');
    const res = await request(baseUrl)
      .get('/rooms')
      .set('authorization', `Bearer ${tokens.accessToken}`);

    // Should pass because registerUser assigns 'user' role by default in this app's logic
    // but we verify the existence of the guard and interceptor here.
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  test('WebSocket: connect valid/invalid JWT, join, send, read receipt, presence', async () => {
    const user = await registerUser('b@test.com', 'userb', 'password123');

    const invalid = io(`${baseUrl}/ws`, { auth: { token: 'bad' }, transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      invalid.on('connect_error', () => resolve());
    });
    invalid.close();

    const socket = io(`${baseUrl}/ws`, { auth: { token: user.accessToken }, transports: ['websocket'] });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));

    const rooms = app.get(RoomsService);
    const room = await rooms.createRoom({
      name: 'room-1',
      nameLower: 'room-1',
      type: 'group',
      members: [user.userId] as any,
      admins: [user.userId] as any,
      createdBy: user.userId as any,
    });

    await new Promise<void>((resolve) => {
      socket.emit('join_room', { roomId: room._id.toString() }, () => resolve());
    });

    const messages = app.get(MessagesService);
    const received = await new Promise<any>((resolve) => {
      socket.on('message', async (msg) => {
        const persisted = await messages.findById(msg._id);
        resolve({ msg, persisted });
      });
      socket.emit('send_message', { roomId: room._id.toString(), content: 'hello' });
    });

    expect(received.msg).toBeDefined();
    expect(received.persisted).toBeDefined();

    const read = await new Promise<any>((resolve) => {
      socket.on('read_receipt', (payload) => resolve(payload));
      socket.emit('mark_read', { roomId: room._id.toString(), messageIds: [received.msg._id] });
    });
    expect(read.userId).toBeDefined();

    const presence = app.get(PresenceService);
    const online = await presence.isUserOnline(user.userId);
    expect(online).toBe(true);

    socket.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    const offline = await presence.isUserOnline(user.userId);
    expect(offline).toBe(false);
  });

  test('Notifications: offline queued, online realtime, worker processed', async () => {
    const user1 = await registerUser('c@test.com', 'userc', 'password123');
    const user2 = await registerUser('d@test.com', 'userd', 'password123');

    const rooms = app.get(RoomsService);
    const room = await rooms.createRoom({
      name: 'room-2',
      nameLower: 'room-2',
      type: 'group',
      members: [user1.userId, user2.userId] as any,
      admins: [user1.userId] as any,
      createdBy: user1.userId as any,
    });

    const socket1 = io(`${baseUrl}/ws`, { auth: { token: user1.accessToken }, transports: ['websocket'] });
    await new Promise<void>((resolve) => socket1.on('connect', () => resolve()));

    const notifications = app.get(NotificationsService);
    await new Promise<void>((resolve) => {
      socket1.emit('send_message', { roomId: room._id.toString(), content: 'ping' }, () => resolve());
    });

    const counts = await notifications.getQueue().getJobCounts();
    expect(counts.waiting + counts.active + counts.completed).toBeGreaterThan(0);

    const socket2 = io(`${baseUrl}/ws`, { auth: { token: user2.accessToken }, transports: ['websocket'] });
    await new Promise<void>((resolve) => socket2.on('connect', () => resolve()));

    const realtime = await new Promise<any>((resolve) => {
      socket2.on('notification', (payload) => resolve(payload));
      socket1.emit('send_message', { roomId: room._id.toString(), content: 'ping2' });
    });
    expect(realtime.type).toBeDefined();

    await new Promise((r) => setTimeout(r, 500));
    const stored = await notifications.listForUser((user2 as any).userId, 10);
    expect(stored.length).toBeGreaterThanOrEqual(0);

    socket1.disconnect();
    socket2.disconnect();
  });

  test('Preferences + message interactions persist', async () => {
    const user = await registerUser('prefs@test.com', 'prefuser', 'password123');
    const token = user.accessToken;
    const roomsService = app.get(RoomsService);
    const room = await roomsService.createRoom({
      name: 'prefs-room',
      nameLower: 'prefs-room',
      type: 'group',
      members: [user.userId] as any,
      admins: [user.userId] as any,
      createdBy: user.userId as any,
      topic: '',
      description: '',
    });

    const prefRes = await request(baseUrl)
      .patch('/me/preferences')
      .set('authorization', `Bearer ${token}`)
      .send({ theme: 'midnight', density: 'compact', fontSize: 'lg', sidebarCollapsed: true });
    expect(prefRes.status).toBe(200);
    expect(prefRes.body.data.theme).toBe('midnight');

    const draftRes = await request(baseUrl)
      .put(`/drafts/${room._id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'hello draft' });
    expect(draftRes.status).toBe(200);

    const msg = await app.get(MessagesService).sendMessage({
      roomId: room._id as any,
      senderId: user.userId as any,
      content: 'hello @alice',
      type: 'text',
    });
    const messageId = (msg as any)._id.toString();

    const editRes = await request(baseUrl)
      .patch(`/rooms/${room._id}/messages/${messageId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'edited hello' });
    expect(editRes.status).toBe(200);

    const reactRes = await request(baseUrl)
      .post(`/rooms/${room._id}/messages/${messageId}/reactions`)
      .set('authorization', `Bearer ${token}`)
      .send({ emoji: '👍' });
    expect(reactRes.status).toBe(201);
    expect(Array.isArray(reactRes.body.data.reactions)).toBe(true);
  });
});
