import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { MessageReaction, MessageReactionDocument } from '../schemas/message-reaction.schema';
import { MessageEdit, MessageEditDocument } from '../schemas/message-edit.schema';
import { MessageMention, MessageMentionDocument } from '../schemas/message-mention.schema';

export interface MessageCursor {
  createdAt: Date;
  id: string;
}

export class MessagesRepository {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(MessageReaction.name)
    private readonly reactionModel: Model<MessageReactionDocument>,
    @InjectModel(MessageEdit.name) private readonly editModel: Model<MessageEditDocument>,
    @InjectModel(MessageMention.name) private readonly mentionModel: Model<MessageMentionDocument>,
  ) {}

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

  deleteByRoom(roomId: string) {
    return this.messageModel.deleteMany({ roomId: new Types.ObjectId(roomId) });
  }

  updateMessage(messageId: string, patch: Partial<Message>) {
    return this.messageModel
      .findByIdAndUpdate(new Types.ObjectId(messageId), { $set: patch }, { new: true })
      .lean();
  }

  async appendEdit(messageId: string, editedBy: string, previousContent: string, newContent: string) {
    return this.editModel.create({
      messageId: new Types.ObjectId(messageId),
      editedBy: new Types.ObjectId(editedBy),
      previousContent,
      newContent,
    });
  }

  async addReaction(roomId: string, messageId: string, userId: string, emoji: string) {
    await this.reactionModel.updateOne(
      {
        messageId: new Types.ObjectId(messageId),
        userId: new Types.ObjectId(userId),
        emoji,
      },
      {
        $setOnInsert: {
          roomId: new Types.ObjectId(roomId),
          messageId: new Types.ObjectId(messageId),
          userId: new Types.ObjectId(userId),
          emoji,
        },
      },
      { upsert: true },
    );
    return this.listReactions(messageId);
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    await this.reactionModel.deleteOne({
      messageId: new Types.ObjectId(messageId),
      userId: new Types.ObjectId(userId),
      emoji,
    });
    return this.listReactions(messageId);
  }

  async listReactions(messageId: string) {
    const rows = await this.reactionModel.find({ messageId: new Types.ObjectId(messageId) }).lean();
    const grouped = new Map<string, { emoji: string; count: number; userIds: string[] }>();
    rows.forEach((r) => {
      const key = r.emoji;
      if (!grouped.has(key)) {
        grouped.set(key, { emoji: r.emoji, count: 0, userIds: [] });
      }
      const entry = grouped.get(key)!;
      entry.count += 1;
      entry.userIds.push(r.userId.toString());
    });
    return Array.from(grouped.values());
  }

  findThread(roomId: string, parentId: string, limit = 100) {
    return this.messageModel
      .find({
        roomId: new Types.ObjectId(roomId),
        parentId: new Types.ObjectId(parentId),
      })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
  }

  async saveMentions(
    messageId: string,
    roomId: string,
    userId: string,
    mentions: Array<{ targetType: 'user' | 'channel'; targetId: string }>,
  ) {
    if (!mentions.length) return;
    const docs = mentions.map((m) => ({
      messageId: new Types.ObjectId(messageId),
      roomId: new Types.ObjectId(roomId),
      userId: new Types.ObjectId(userId),
      targetType: m.targetType,
      targetId: m.targetId,
    }));
    await this.mentionModel.insertMany(docs, { ordered: false }).catch(() => null);
  }
}
