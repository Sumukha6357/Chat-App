import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoomsRepository } from './repositories/rooms.repository';
import { Room } from './schemas/room.schema';
import { RoomMember, RoomMemberDocument } from './schemas/room-member.schema';
import { MessagesService } from '../chat/messages.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomsRepo: RoomsRepository,
    @Inject(forwardRef(() => MessagesService))
    private readonly messages: MessagesService,
    @InjectModel(RoomMember.name) private readonly roomMemberModel: Model<RoomMemberDocument>,
  ) {}

  createRoom(data: Partial<Room>) {
    return this.roomsRepo.create(data);
  }

  findById(id: string) {
    return this.roomsRepo.findById(id);
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
}
