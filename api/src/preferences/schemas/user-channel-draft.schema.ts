import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserChannelDraftDocument = HydratedDocument<UserChannelDraft>;

@Schema({ timestamps: true, collection: 'user_channel_drafts' })
export class UserChannelDraft {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;

  @Prop({ default: '' })
  content!: string;
}

export const UserChannelDraftSchema = SchemaFactory.createForClass(UserChannelDraft);
UserChannelDraftSchema.index({ userId: 1, roomId: 1 }, { unique: true });

