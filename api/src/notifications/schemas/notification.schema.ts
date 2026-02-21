import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['message_received', 'mention', 'system_alert'] })
  type!: 'message_received' | 'mention' | 'system_alert';

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ default: false })
  read!: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });
