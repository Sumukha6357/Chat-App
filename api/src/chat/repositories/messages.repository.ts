import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';

export interface MessageCursor {
  createdAt: Date;
  id: string;
}

export class MessagesRepository {
  constructor(@InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>) {}

  create(data: Partial<Message>) {
    return this.messageModel.create(data);
  }

  findByClientMessageId(roomId: string, senderId: string, clientMessageId: string) {
    return this.messageModel
      .findOne({
        roomId: new Types.ObjectId(roomId),
        senderId: new Types.ObjectId(senderId),
        clientMessageId,
      })
      .lean();
  }

  async findByRoom(roomId: string, limit: number, cursor?: MessageCursor) {
    const query: Record<string, unknown> = { roomId: new Types.ObjectId(roomId) };

    if (cursor) {
      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }

    return this.messageModel
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
  }

  async searchByRoom(roomId: string, term: string, limit: number, cursor?: MessageCursor) {
    const query: Record<string, unknown> = {
      roomId: new Types.ObjectId(roomId),
      content: { $regex: term, $options: 'i' },
    };
    if (cursor) {
      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }
    return this.messageModel
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
  }

  markRead(roomId: string, userId: string, messageIds: string[]) {
    return this.messageModel.updateMany(
      { _id: { $in: messageIds }, roomId },
      { $addToSet: { readBy: userId } },
    );
  }

  markDeletedFor(messageId: string, userId: string) {
    return this.messageModel.updateOne(
      { _id: messageId },
      { $addToSet: { deletedFor: userId } },
    );
  }

  countByRoom(roomId: string) {
    return this.messageModel.countDocuments({ roomId });
  }

  countByRoomAfter(roomId: string, lastReadAt: Date) {
    return this.messageModel.countDocuments({
      roomId,
      createdAt: { $gt: lastReadAt },
    });
  }

  findById(id: string) {
    return this.messageModel.findById(id).lean();
  }
}
