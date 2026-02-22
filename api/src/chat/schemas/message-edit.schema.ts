import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageEditDocument = HydratedDocument<MessageEdit>;

@Schema({ timestamps: true, collection: 'message_edits' })
export class MessageEdit {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: true, index: true })
  messageId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  editedBy!: Types.ObjectId;

  @Prop({ required: true })
  previousContent!: string;

  @Prop({ required: true })
  newContent!: string;
}

export const MessageEditSchema = SchemaFactory.createForClass(MessageEdit);

