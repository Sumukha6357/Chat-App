import { BadRequestException, Injectable } from '@nestjs/common';
import { MessagesRepository, MessageCursor } from './repositories/messages.repository';
import { Message } from './schemas/message.schema';

const MAX_CONTENT_LENGTH = 2000;
const BANNED_WORDS = ['slur1', 'slur2', 'slur3'];

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepo: MessagesRepository) { }

  async sendMessage(data: Partial<Message>) {
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    const raw = (data.content || '').trim();
    if (!raw && attachments.length === 0) {
      throw new BadRequestException('Message is empty');
    }
    if (raw.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException('Message content too large');
    }
    const content = raw ? sanitizeContent(raw) : '';
    const created = await this.messagesRepo.create({ ...data, content, attachments });
    const senderId = (data.senderId as any)?.toString?.() || '';
    const roomId = (data.roomId as any)?.toString?.() || '';
    const messageId = (created as any)?._id?.toString?.() || '';
    if (messageId && senderId && roomId) {
      const mentions = extractMentions(content);
      await this.messagesRepo.saveMentions(messageId, roomId, senderId, mentions);
    }
    return created;
  }

  findByClientMessageId(roomId: string, senderId: string, clientMessageId: string) {
    return this.messagesRepo.findByClientMessageId(roomId, senderId, clientMessageId);
  }

  getMessages(roomId: string, limit = 50, cursor?: MessageCursor) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.messagesRepo.findByRoom(roomId, safeLimit, cursor);
  }

  searchMessages(roomId: string, term: string, limit = 50, cursor?: MessageCursor) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.messagesRepo.searchByRoom(roomId, term, safeLimit, cursor);
  }

  markRead(roomId: string, userId: string, messageIds: string[]) {
    return this.messagesRepo.markRead(roomId, userId, messageIds);
  }

  findById(id: string) {
    return this.messagesRepo.findById(id);
  }

  countByRoom(roomId: string) {
    return this.messagesRepo.countByRoom(roomId);
  }

  countByRoomAfter(roomId: string, lastReadAt: Date) {
    return this.messagesRepo.countByRoomAfter(roomId, lastReadAt);
  }

  deleteByRoom(roomId: string) {
    return this.messagesRepo.deleteByRoom(roomId);
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const existing = await this.messagesRepo.findById(messageId);
    if (!existing) {
      throw new BadRequestException('Message not found');
    }
    if ((existing as any).senderId?.toString?.() !== userId) {
      throw new BadRequestException('Cannot edit this message');
    }
    const nextContent = sanitizeContent((content || '').trim());
    if (!nextContent) {
      throw new BadRequestException('Message is empty');
    }
    await this.messagesRepo.appendEdit(
      messageId,
      userId,
      (existing as any).content || '',
      nextContent,
    );
    return this.messagesRepo.updateMessage(messageId, {
      content: nextContent,
      editedAt: new Date(),
    });
  }

  async softDeleteMessage(messageId: string, userId: string) {
    const existing = await this.messagesRepo.findById(messageId);
    if (!existing) {
      throw new BadRequestException('Message not found');
    }
    if ((existing as any).senderId?.toString?.() !== userId) {
      throw new BadRequestException('Cannot delete this message');
    }
    return this.messagesRepo.updateMessage(messageId, {
      isDeleted: true,
      deletedAt: new Date(),
      content: '',
      attachments: [],
    } as any);
  }

  addReaction(roomId: string, messageId: string, userId: string, emoji: string) {
    return this.messagesRepo.addReaction(roomId, messageId, userId, emoji);
  }

  removeReaction(messageId: string, userId: string, emoji: string) {
    return this.messagesRepo.removeReaction(messageId, userId, emoji);
  }

  listReactions(messageId: string) {
    return this.messagesRepo.listReactions(messageId);
  }

  getThread(roomId: string, messageId: string, limit = 100) {
    return this.messagesRepo.findThread(roomId, messageId, limit);
  }
}

function sanitizeContent(value: string) {
  let sanitized = value;
  BANNED_WORDS.forEach((word) => {
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
    sanitized = sanitized.replace(re, '***');
  });
  return sanitized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMentions(content: string): Array<{ targetType: 'user' | 'channel'; targetId: string }> {
  const mentions: Array<{ targetType: 'user' | 'channel'; targetId: string }> = [];
  const userMatches = content.matchAll(/@([a-zA-Z0-9._-]+)/g);
  for (const match of userMatches) {
    if (match[1]) mentions.push({ targetType: 'user', targetId: match[1] });
  }
  const channelMatches = content.matchAll(/#([a-zA-Z0-9._-]+)/g);
  for (const match of channelMatches) {
    if (match[1]) mentions.push({ targetType: 'channel', targetId: match[1] });
  }
  return mentions;
}
