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
    return this.messagesRepo.create({ ...data, content, attachments });
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
