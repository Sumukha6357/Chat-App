import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chat';

const RECOMMENDED = {
  messages: [
    { key: { roomId: 1, createdAt: -1 }, name: 'roomId_1_createdAt_-1' },
    { key: { senderId: 1 }, name: 'senderId_1' },
    { key: { content: 'text' }, name: 'content_text' },
  ],
  rooms: [{ key: { members: 1 }, name: 'members_1' }],
  roommembers: [
    { key: { roomId: 1, userId: 1 }, name: 'roomId_1_userId_1' },
    { key: { userId: 1 }, name: 'userId_1' },
  ],
};

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No db connection');

  await auditCollection(db, 'messages', RECOMMENDED.messages);
  await auditCollection(db, 'rooms', RECOMMENDED.rooms);
  await auditCollection(db, 'roommembers', RECOMMENDED.roommembers);

  await mongoose.disconnect();
}

async function auditCollection(
  db: mongoose.mongo.Db,
  name: string,
  expected: Array<{ key: Record<string, any>; name: string }>,
) {
  const indexes = await db.collection(name).indexes();
  console.log(`\n[${name}] indexes:`);
  indexes.forEach((idx) => {
    console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
  });
  console.log(`[${name}] recommended:`);
  expected.forEach((idx) => {
    const found = indexes.some((i) => JSON.stringify(i.key) === JSON.stringify(idx.key));
    console.log(`- ${idx.name}: ${JSON.stringify(idx.key)} ${found ? 'OK' : 'MISSING'}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
