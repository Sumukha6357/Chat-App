import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserPreferences, UserPreferencesDocument } from './schemas/user-preferences.schema';
import { UserSidebarState, UserSidebarStateDocument } from './schemas/user-sidebar-state.schema';
import {
  UserChannelFavorite,
  UserChannelFavoriteDocument,
} from './schemas/user-channel-favorite.schema';
import {
  UserWorkspaceOrder,
  UserWorkspaceOrderDocument,
} from './schemas/user-workspace-order.schema';
import { UserLastState, UserLastStateDocument } from './schemas/user-last-state.schema';
import { UserChannelDraft, UserChannelDraftDocument } from './schemas/user-channel-draft.schema';
import {
  UserChannelNotificationSetting,
  UserChannelNotificationSettingDocument,
} from './schemas/user-channel-notification-setting.schema';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectModel(UserPreferences.name)
    private readonly preferencesModel: Model<UserPreferencesDocument>,
    @InjectModel(UserSidebarState.name)
    private readonly sidebarModel: Model<UserSidebarStateDocument>,
    @InjectModel(UserChannelFavorite.name)
    private readonly favoritesModel: Model<UserChannelFavoriteDocument>,
    @InjectModel(UserWorkspaceOrder.name)
    private readonly orderModel: Model<UserWorkspaceOrderDocument>,
    @InjectModel(UserLastState.name)
    private readonly lastStateModel: Model<UserLastStateDocument>,
    @InjectModel(UserChannelDraft.name)
    private readonly draftsModel: Model<UserChannelDraftDocument>,
    @InjectModel(UserChannelNotificationSetting.name)
    private readonly notificationModel: Model<UserChannelNotificationSettingDocument>,
  ) {}

  async getPreferences(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const doc = await this.preferencesModel.findOne({ userId: objectId }).lean();
    if (doc) return doc;
    return this.preferencesModel.create({ userId: objectId });
  }

  async updatePreferences(userId: string, patch: Partial<UserPreferences>) {
    const objectId = new Types.ObjectId(userId);
    return this.preferencesModel
      .findOneAndUpdate({ userId: objectId }, { $set: patch }, { upsert: true, new: true })
      .lean();
  }

  async getSidebarState(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const doc = await this.sidebarModel.findOne({ userId: objectId }).lean();
    if (doc) return doc;
    return this.sidebarModel.create({ userId: objectId });
  }

  async updateSidebarState(
    userId: string,
    patch: {
      sectionCollapsed?: {
        favorites?: boolean;
        textChannels?: boolean;
        voice?: boolean;
        dms?: boolean;
      };
    },
  ) {
    const objectId = new Types.ObjectId(userId);
    const current = await this.sidebarModel.findOne({ userId: objectId }).lean();
    const nextSection = {
      favorites: patch.sectionCollapsed?.favorites ?? current?.sectionCollapsed?.favorites ?? false,
      textChannels:
        patch.sectionCollapsed?.textChannels ?? current?.sectionCollapsed?.textChannels ?? false,
      voice: patch.sectionCollapsed?.voice ?? current?.sectionCollapsed?.voice ?? true,
      dms: patch.sectionCollapsed?.dms ?? current?.sectionCollapsed?.dms ?? false,
    };
    return this.sidebarModel
      .findOneAndUpdate(
        { userId: objectId },
        { $set: { sectionCollapsed: nextSection } },
        { upsert: true, new: true },
      )
      .lean();
  }

  async listFavorites(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const docs = await this.favoritesModel.find({ userId: objectId }).lean();
    return docs.map((d) => d.roomId.toString());
  }

  async addFavorite(userId: string, roomId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const roomObjectId = new Types.ObjectId(roomId);
    await this.favoritesModel.updateOne(
      { userId: userObjectId, roomId: roomObjectId },
      { $setOnInsert: { userId: userObjectId, roomId: roomObjectId } },
      { upsert: true },
    );
    return this.listFavorites(userId);
  }

  async removeFavorite(userId: string, roomId: string) {
    await this.favoritesModel.deleteOne({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(roomId),
    });
    return this.listFavorites(userId);
  }

  async getWorkspaceOrder(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const doc = await this.orderModel.findOne({ userId: objectId }).lean();
    if (doc) return doc.workspaceOrder || [];
    const created = await this.orderModel.create({ userId: objectId, workspaceOrder: [] });
    return created.workspaceOrder;
  }

  async setWorkspaceOrder(userId: string, workspaceOrder: string[]) {
    const objectId = new Types.ObjectId(userId);
    const doc = await this.orderModel
      .findOneAndUpdate(
        { userId: objectId },
        { $set: { workspaceOrder } },
        { upsert: true, new: true },
      )
      .lean();
    return doc?.workspaceOrder || [];
  }

  async getLastState(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const doc = await this.lastStateModel.findOne({ userId: objectId }).lean();
    if (doc) return doc;
    return this.lastStateModel.create({ userId: objectId });
  }

  async updateLastState(userId: string, patch: Partial<UserLastState>) {
    const objectId = new Types.ObjectId(userId);
    return this.lastStateModel
      .findOneAndUpdate({ userId: objectId }, { $set: patch }, { upsert: true, new: true })
      .lean();
  }

  async getDraft(userId: string, roomId: string) {
    return this.draftsModel
      .findOne({
        userId: new Types.ObjectId(userId),
        roomId: new Types.ObjectId(roomId),
      })
      .lean();
  }

  async upsertDraft(userId: string, roomId: string, content: string) {
    const objectId = new Types.ObjectId(userId);
    const roomObjectId = new Types.ObjectId(roomId);
    return this.draftsModel
      .findOneAndUpdate(
        { userId: objectId, roomId: roomObjectId },
        { $set: { content } },
        { upsert: true, new: true },
      )
      .lean();
  }

  async listDrafts(userId: string) {
    return this.draftsModel.find({ userId: new Types.ObjectId(userId) }).lean();
  }

  async listNotificationSettings(userId: string) {
    return this.notificationModel.find({ userId: new Types.ObjectId(userId) }).lean();
  }

  async setNotificationSetting(
    userId: string,
    roomId: string,
    level: 'all' | 'mentions' | 'none',
    quietHoursEnabled: boolean,
  ) {
    return this.notificationModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), roomId: new Types.ObjectId(roomId) },
        { $set: { level, quietHoursEnabled } },
        { upsert: true, new: true },
      )
      .lean();
  }
}
