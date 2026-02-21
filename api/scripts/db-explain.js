const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/chat';

(async () => {
  await mongoose.connect(uri);
  const messages = mongoose.connection.collection('messages');
  const rooms = mongoose.connection.collection('rooms');

  const roomId = process.env.EXPLAIN_ROOM_ID;
  if (roomId) {
    const explain = await messages
      .find({ roomId: new mongoose.Types.ObjectId(roomId) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(20)
      .explain('executionStats');
    console.log(JSON.stringify(explain, null, 2));
  }

  const explainRooms = await rooms
    .find({})
    .limit(10)
    .explain('executionStats');
  console.log(JSON.stringify(explainRooms, null, 2));

  await mongoose.disconnect();
})();
