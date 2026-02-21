import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../schemas/room.schema';

export class RoomsRepository {
  constructor(@InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>) {}

  create(data: Partial<Room>) {
    return this.roomModel.create(data);
  }

  findById(id: string) {
    return this.roomModel.findById(id).lean();
  }

  findByMember(userId: string) {
    const ids: Array<string | Types.ObjectId> = [userId];
    if (Types.ObjectId.isValid(userId)) {
      ids.unshift(new Types.ObjectId(userId));
    }
    return this.roomModel.find({ members: { $in: ids } }).lean();
  }

  isMember(roomId: string, userId: string) {
    const ids: Array<string | Types.ObjectId> = [userId];
    if (Types.ObjectId.isValid(userId)) {
      ids.unshift(new Types.ObjectId(userId));
    }
    return this.roomModel.exists({ _id: roomId, members: { $in: ids } });
  }

  addMember(roomId: string, userId: string) {
    const member = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
    return this.roomModel.updateOne({ _id: roomId }, { $addToSet: { members: member } });
  }

  removeMember(roomId: string, userId: string) {
    const ids: Array<string | Types.ObjectId> = [userId];
    if (Types.ObjectId.isValid(userId)) {
      ids.unshift(new Types.ObjectId(userId));
    }
    return this.roomModel.updateOne({ _id: roomId }, { $pull: { members: { $in: ids } } });
  }
}
