import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserSidebarStateDocument = HydratedDocument<UserSidebarState>;

@Schema({ timestamps: true, collection: 'user_sidebar_state' })
export class UserSidebarState {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: {
      favorites: { type: Boolean, default: false },
      textChannels: { type: Boolean, default: false },
      voice: { type: Boolean, default: true },
      dms: { type: Boolean, default: false },
    },
    default: {},
  })
  sectionCollapsed!: {
    favorites: boolean;
    textChannels: boolean;
    voice: boolean;
    dms: boolean;
  };
}

export const UserSidebarStateSchema = SchemaFactory.createForClass(UserSidebarState);

