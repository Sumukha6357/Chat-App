import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserLastStateDocument = HydratedDocument<UserLastState>;

@Schema({ timestamps: true, collection: 'user_last_state' })
export class UserLastState {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop()
  lastWorkspaceId?: string;

  @Prop()
  lastChannelId?: string;
}

export const UserLastStateSchema = SchemaFactory.createForClass(UserLastState);

