import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

export class NotificationsRepository {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  create(data: Partial<Notification>) {
    return this.notificationModel.create(data);
  }

  findByUser(userId: string, limit = 50) {
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  markRead(userId: string, ids: string[]) {
    return this.notificationModel.updateMany({ userId, _id: { $in: ids } }, { read: true });
  }
}
