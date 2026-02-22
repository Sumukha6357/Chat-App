import mongoose from 'mongoose';

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pulse';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Mongo DB connection is not ready');
  }

  await db.collection('rooms').updateMany(
    { topic: { $exists: false } },
    { $set: { topic: '', description: '' } },
  );

  await db.collection('messages').updateMany(
    { parentId: { $exists: false } },
    { $set: { parentId: null, editedAt: null } },
  );

  await db.collection('user_preferences').createIndex({ userId: 1 }, { unique: true });
  await db.collection('user_sidebar_state').createIndex({ userId: 1 }, { unique: true });
  await db.collection('user_workspace_order').createIndex({ userId: 1 }, { unique: true });
  await db.collection('user_last_state').createIndex({ userId: 1 }, { unique: true });
  await db.collection('user_channel_favorites').createIndex(
    { userId: 1, roomId: 1 },
    { unique: true },
  );
  await db.collection('user_channel_drafts').createIndex({ userId: 1, roomId: 1 }, { unique: true });
  await db.collection('user_channel_notification_settings').createIndex(
    { userId: 1, roomId: 1 },
    { unique: true },
  );
  await db.collection('message_reactions').createIndex(
    { messageId: 1, userId: 1, emoji: 1 },
    { unique: true },
  );
  await db.collection('message_mentions').createIndex(
    { messageId: 1, userId: 1, targetType: 1, targetId: 1 },
    { unique: true },
  );

  await mongoose.disconnect();
}

run()
  .then(() => {
    process.stdout.write('UI persistence migration complete\n');
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(`Migration failed: ${err?.message || err}\n`);
    process.exit(1);
  });
