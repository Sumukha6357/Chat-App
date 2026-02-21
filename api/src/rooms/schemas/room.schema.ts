import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;

@Schema({ timestamps: true })
export class Room {
  _id!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, index: true })
  nameLower!: string;

  @Prop({ required: true, enum: ['direct', 'group'], index: true })
  type!: 'direct' | 'group';

  @Prop({ type: [Types.ObjectId], ref: 'User', index: true })
  members!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User' })
  admins!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
