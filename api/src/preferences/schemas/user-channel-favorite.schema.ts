import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserChannelFavoriteDocument = HydratedDocument<UserChannelFavorite>;

@Schema({ timestamps: true, collection: 'user_channel_favorites' })
export class UserChannelFavorite {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId!: Types.ObjectId;
}

export const UserChannelFavoriteSchema = SchemaFactory.createForClass(UserChannelFavorite);
UserChannelFavoriteSchema.index({ userId: 1, roomId: 1 }, { unique: true });

