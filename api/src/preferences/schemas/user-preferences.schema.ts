import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserPreferencesDocument = HydratedDocument<UserPreferences>;

@Schema({ timestamps: true, collection: 'user_preferences' })
export class UserPreferences {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ enum: ['dark', 'light', 'midnight'], default: 'dark' })
  theme!: 'dark' | 'light' | 'midnight';

  @Prop({ enum: ['compact', 'comfortable', 'cozy'], default: 'comfortable' })
  density!: 'compact' | 'comfortable' | 'cozy';

  @Prop({ enum: ['sm', 'md', 'lg'], default: 'md' })
  fontSize!: 'sm' | 'md' | 'lg';

  @Prop({ default: false })
  sidebarCollapsed!: boolean;
}

export const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);

