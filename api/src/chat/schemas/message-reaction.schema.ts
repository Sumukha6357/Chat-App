import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageReactionDocument = HydratedDocument<MessageReaction>;

@Schema({ timestamps: true, collection: 'message_reactions' })
export class MessageReaction {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: true, index: true })
  messageId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  emoji!: string;
}

export const MessageReactionSchema = SchemaFactory.createForClass(MessageReaction);
MessageReactionSchema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });

