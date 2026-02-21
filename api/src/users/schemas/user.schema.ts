import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  _id!: Types.ObjectId;

  @Prop({ unique: true, index: true, required: true })
  email!: string;

  @Prop({ unique: true, index: true, required: true })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop()
  avatar?: string;

  @Prop({ default: 'offline' })
  status!: 'online' | 'offline' | 'away';

  @Prop()
  lastSeen?: Date;

  @Prop({ type: [String], default: ['user'] })
  roles!: string[];

  @Prop({ type: [String], default: [] })
  blockedUserIds!: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
