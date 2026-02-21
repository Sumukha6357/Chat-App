import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoomMemberDocument = HydratedDocument<RoomMember>;

@Schema({ timestamps: true })
export class RoomMember {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', index: true, required: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastReadMessageId?: Types.ObjectId;

  @Prop()
  lastReadAt?: Date;
}

export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);
RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
