import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageMentionDocument = HydratedDocument<MessageMention>;

@Schema({ timestamps: true, collection: 'message_mentions' })
export class MessageMention {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: true, index: true })
  messageId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'channel'] })
  targetType!: 'user' | 'channel';

  @Prop({ required: true })
  targetId!: string;
}

export const MessageMentionSchema = SchemaFactory.createForClass(MessageMention);
MessageMentionSchema.index({ messageId: 1, userId: 1, targetType: 1, targetId: 1 }, { unique: true });

