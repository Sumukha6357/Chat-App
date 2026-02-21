import * as dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { hash } from 'bcrypt';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import { Room, RoomSchema } from '../src/rooms/schemas/room.schema';
import { Message, MessageSchema } from '../src/chat/schemas/message.schema';
import { Notification, NotificationSchema } from '../src/notifications/schemas/notification.schema';

dotenv.config();

const USER_A = {
  email: 'userA@example.com',
  username: 'userA',
  password: 'Password123!',
};
const USER_B = {
  email: 'userB@example.com',
  username: 'userB',
  password: 'Password123!',
};

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chat';
  await mongoose.connect(mongoUri);

  const UserModel =
    mongoose.models.User || mongoose.model<User>(User.name, UserSchema);
  const RoomModel =
    mongoose.models.Room || mongoose.model<Room>(Room.name, RoomSchema);
  const MessageModel =
    mongoose.models.Message || mongoose.model<Message>(Message.name, MessageSchema);
  const NotificationModel =
    mongoose.models.Notification ||
    mongoose.model<Notification>(Notification.name, NotificationSchema);

  const userA = await upsertUser(UserModel, USER_A);
  const userB = await upsertUser(UserModel, USER_B);

  const dmRoom = await upsertDirectRoom(RoomModel, userA._id, userB._id);
  const groupRoom = await upsertGroupRoom(RoomModel, userA._id, userB._id);

  await ensureMessages(MessageModel, dmRoom._id, userA._id, userB._id);
  await ensureMessages(MessageModel, groupRoom._id, userA._id, userB._id);

  await ensureNotification(NotificationModel, userA._id);
  await ensureNotification(NotificationModel, userB._id);

  await mongoose.disconnect();
  console.log('Seed complete');
}

async function upsertUser(model: mongoose.Model<User>, data: typeof USER_A) {
  const existing = await model.findOne({ email: data.email });
  if (existing) return existing;
  const passwordHash = await hash(data.password, 12);
  return model.create({
    email: data.email,
    username: data.username,
    passwordHash,
    roles: ['user'],
  });
}

async function upsertDirectRoom(
  model: mongoose.Model<Room>,
  userA: Types.ObjectId,
  userB: Types.ObjectId,
) {
  const existing = await model.findOne({
    type: 'direct',
    members: { $all: [userA, userB], $size: 2 },
  });
  if (existing) return existing;
  const name = 'userA & userB';
  return model.create({
    name,
    nameLower: name.toLowerCase(),
    type: 'direct',
    members: [userA, userB],
    admins: [userA],
    createdBy: userA,
  });
}

async function upsertGroupRoom(
  model: mongoose.Model<Room>,
  userA: Types.ObjectId,
  userB: Types.ObjectId,
) {
  const name = 'Seed Group';
  const existing = await model.findOne({ type: 'group', name });
  if (existing) return existing;
  return model.create({
    name,
    nameLower: name.toLowerCase(),
    type: 'group',
    members: [userA, userB],
    admins: [userA],
    createdBy: userA,
  });
}

async function ensureMessages(
  model: mongoose.Model<Message>,
  roomId: Types.ObjectId,
  userA: Types.ObjectId,
  userB: Types.ObjectId,
) {
  const count = await model.countDocuments({ roomId });
  if (count >= 5) return;
  const now = Date.now();
  const messages = Array.from({ length: 5 }).map((_, i) => {
    const createdAt = new Date(now - (5 - i) * 60_000);
    return {
      roomId,
      senderId: i % 2 === 0 ? userA : userB,
      content: `Seed message ${i + 1}`,
      type: 'text',
      createdAt,
      updatedAt: createdAt,
    };
  });
  await model.insertMany(messages);
}

async function ensureNotification(
  model: mongoose.Model<Notification>,
  userId: Types.ObjectId,
) {
  const existing = await model.findOne({ userId });
  if (existing) return;
  await model.create({
    userId,
    type: 'system_alert',
    payload: { message: 'Welcome to Chat App' },
    read: false,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
