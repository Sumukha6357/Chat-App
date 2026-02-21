import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoomsRepository } from './repositories/rooms.repository';
import { Room } from './schemas/room.schema';
import { RoomMember, RoomMemberDocument } from './schemas/room-member.schema';
import { MessagesService } from '../chat/messages.service';

@Injectable()
export class RoomsService implements OnModuleInit {
  constructor(
    private readonly roomsRepo: RoomsRepository,
    @Inject(forwardRef(() => MessagesService))
    private readonly messages: MessagesService,
    @InjectModel(RoomMember.name) private readonly roomMemberModel: Model<RoomMemberDocument>,
  ) { }

  async onModuleInit() {
    // Migration: populate slugs for existing rooms
    const allRooms = await this.roomsRepo.findAll();
    for (const room of allRooms as any[]) {
      if (!room.slug) {
        const baseSlug = (room.name || 'room').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        let slug = baseSlug || 'room';
        let count = 0;
        let finalSlug = slug;
        while (await this.roomsRepo.findByIdOrSlug(count > 0 ? `${slug}-${count}` : slug)) {
          count++;
          finalSlug = `${slug}-${count}`;
        }
        await this.roomsRepo.update(room._id.toString(), { slug: finalSlug });
      }
    }
  }

  async createRoom(data: Partial<Room>) {
    if (data.name && !data.slug) {
      const baseSlug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      let slug = baseSlug || 'room';
      let count = 0;
      while (await this.roomsRepo.findByIdOrSlug(count > 0 ? `${slug}-${count}` : slug)) {
        count++;
      }
      data.slug = count > 0 ? `${slug}-${count}` : slug;
    }
    return this.roomsRepo.create(data);
  }

  findById(id: string) {
    return this.roomsRepo.findById(id);
  }

  findByIdOrSlug(idOrSlug: string) {
    return this.roomsRepo.findByIdOrSlug(idOrSlug);
  }

  findByMember(userId: string) {
    return this.roomsRepo.findByMember(userId);
  }

  isMember(roomId: string, userId: string) {
    return this.roomsRepo.isMember(roomId, userId);
  }

  async getRoomReadState(roomIds: string[], userId: string) {
    return this.roomMemberModel
      .find({ roomId: { $in: roomIds }, userId: new Types.ObjectId(userId) })
      .lean();
  }

  async upsertReadCursor(
    roomId: string,
    userId: string,
    lastReadMessageId?: string,
    lastReadAt?: string,
  ) {
    const update: Partial<RoomMember> = {};
    if (lastReadMessageId) {
      update.lastReadMessageId = new Types.ObjectId(lastReadMessageId) as any;
    }
    if (lastReadAt) {
      update.lastReadAt = new Date(lastReadAt);
    }
    return this.roomMemberModel.updateOne(
      { roomId: new Types.ObjectId(roomId), userId: new Types.ObjectId(userId) },
      { $set: update },
      { upsert: true },
    );
  }

  async getUnreadCount(roomId: string, lastReadAt?: Date) {
    if (!lastReadAt) {
      return this.messages.countByRoom(roomId);
    }
    return this.messages.countByRoomAfter(roomId, lastReadAt);
  }

  addMember(roomId: string, userId: string) {
    return this.roomsRepo.addMember(roomId, userId);
  }

  removeMember(roomId: string, userId: string) {
    return this.roomsRepo.removeMember(roomId, userId);
  }

  update(id: string, data: Partial<Room>) {
    return this.roomsRepo.update(id, data);
  }
}
