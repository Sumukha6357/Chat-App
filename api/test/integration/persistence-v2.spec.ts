import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';
import { RoomsService } from '../../src/rooms/rooms.service';
import { MessagesService } from '../../src/chat/messages.service';
import { REDIS_CLIENT } from '../../src/database/database.module';
import { Types } from 'mongoose';

jest.setTimeout(60000);

describe('Persistence (V2)', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'test_access';
    process.env.JWT_REFRESH_SECRET = 'test_refresh';
    process.env.WS_REDIS_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        on: jest.fn(),
        status: 'ready',
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
  });

  it('should verify room persistence with slug generation', async () => {
    const rooms = app.get(RoomsService);
    const userId = new Types.ObjectId();

    // Test Case: Create room without slug
    const room = await rooms.createRoom({
      name: 'Titanium Base',
      nameLower: 'titanium base',
      type: 'group',
      members: [userId],
      admins: [userId],
      createdBy: userId,
    });

    expect(room._id).toBeDefined();
    expect(room.slug).toBe('titanium-base');

    // Test Case: Create room with same name (slug collision)
    const room2 = await rooms.createRoom({
      name: 'Titanium Base',
      nameLower: 'titanium base',
      type: 'group',
      members: [userId],
      admins: [userId],
      createdBy: userId,
    });
    expect(room2.slug).toBe('titanium-base-1');
  });

  it('should verify message persistence and retrieval', async () => {
    const rooms = app.get(RoomsService);
    const messages = app.get(MessagesService);
    const userId = new Types.ObjectId();

    const room = await rooms.createRoom({
      name: 'Audit Room',
      nameLower: 'audit room',
      type: 'group',
      members: [userId],
      admins: [userId],
      createdBy: userId,
    });

    // Send messages with forced timestamps
    const m1 = await messages.sendMessage({
      roomId: room._id.toString() as any,
      senderId: userId.toString() as any,
      content: 'Hello first',
      type: 'text',
    });

    // Simulate delay for timestamp difference if needed, or just let them be naturally sequential
    const m2 = await messages.sendMessage({
      roomId: room._id.toString() as any,
      senderId: userId.toString() as any,
      content: 'Hello second',
      type: 'text',
    });

    expect(m1._id).toBeDefined();
    expect(m2._id).toBeDefined();

    // Find by room (should be descending by default in repo)
    const list = await messages.getMessages(room._id.toString());
    expect(list.length).toBeGreaterThanOrEqual(2);
    // Repository findByRoom sorts by { createdAt: -1 }
    expect(list[0].content).toBe('Hello second');
    expect(list[1].content).toBe('Hello first');
  });
});
