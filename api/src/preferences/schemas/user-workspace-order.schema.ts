import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserWorkspaceOrderDocument = HydratedDocument<UserWorkspaceOrder>;

@Schema({ timestamps: true, collection: 'user_workspace_order' })
export class UserWorkspaceOrder {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  workspaceOrder!: string[];
}

export const UserWorkspaceOrderSchema = SchemaFactory.createForClass(UserWorkspaceOrder);

