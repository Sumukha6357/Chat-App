import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).lean();
  }

  findByUsername(username: string) {
    return this.userModel.findOne({ username }).lean();
  }

  findById(id: string) {
    return this.userModel.findById(id).lean();
  }

  updateStatus(userId: string, status: User['status'], lastSeen?: Date) {
    return this.userModel.updateOne(
      { _id: userId },
      { status, lastSeen: lastSeen || new Date() },
    );
  }

  async hasBlocked(userId: string, targetUserId: string) {
    const result = await this.userModel
      .exists({ _id: userId, blockedUserIds: targetUserId })
      .lean();
    return Boolean(result);
  }

  blockUser(userId: string, targetUserId: string) {
    return this.userModel.updateOne(
      { _id: userId },
      { $addToSet: { blockedUserIds: targetUserId } },
    );
  }

  unblockUser(userId: string, targetUserId: string) {
    return this.userModel.updateOne(
      { _id: userId },
      { $pull: { blockedUserIds: targetUserId } },
    );
  }
}
