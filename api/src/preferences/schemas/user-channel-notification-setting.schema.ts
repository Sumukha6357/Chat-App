import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserChannelNotificationSettingDocument = HydratedDocument<UserChannelNotificationSetting>;

@Schema({ timestamps: true, collection: 'user_channel_notification_settings' })
export class UserChannelNotificationSetting {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;

  @Prop({ enum: ['all', 'mentions', 'none'], default: 'all' })
  level!: 'all' | 'mentions' | 'none';

  @Prop({ default: false })
  quietHoursEnabled!: boolean;
}

export const UserChannelNotificationSettingSchema = SchemaFactory.createForClass(
  UserChannelNotificationSetting,
);
UserChannelNotificationSettingSchema.index({ userId: 1, roomId: 1 }, { unique: true });

