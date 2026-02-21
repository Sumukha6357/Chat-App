import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export class MessageAttachment {
  url!: string;
  type!: 'image' | 'file';
  name!: string;
  size!: number;
  mimeType!: string;
}

@Schema({ timestamps: true })
export class Message {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', index: true, required: true })
  roomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  senderId!: Types.ObjectId;

  @Prop({ default: '' })
  content!: string;

  @Prop({ required: true, enum: ['text', 'image', 'file', 'system'], default: 'text' })
  type!: 'text' | 'image' | 'file' | 'system';

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  readBy!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  deletedFor!: Types.ObjectId[];

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        type: { type: String, required: true, enum: ['image', 'file'] },
        name: { type: String, required: true },
        size: { type: Number, required: true },
        mimeType: { type: String, required: true },
      },
    ],
    default: [],
  })
  attachments!: MessageAttachment[];

  @Prop()
  expiresAt?: Date;

  @Prop()
  clientMessageId?: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ roomId: 1, createdAt: -1 });
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MessageSchema.index(
  { roomId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $exists: true } } },
);
MessageSchema.index({ content: 'text' });
