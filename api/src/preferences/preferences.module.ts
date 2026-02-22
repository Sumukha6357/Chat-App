import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { UserPreferences, UserPreferencesSchema } from './schemas/user-preferences.schema';
import { UserSidebarState, UserSidebarStateSchema } from './schemas/user-sidebar-state.schema';
import {
  UserChannelFavorite,
  UserChannelFavoriteSchema,
} from './schemas/user-channel-favorite.schema';
import {
  UserWorkspaceOrder,
  UserWorkspaceOrderSchema,
} from './schemas/user-workspace-order.schema';
import { UserLastState, UserLastStateSchema } from './schemas/user-last-state.schema';
import { UserChannelDraft, UserChannelDraftSchema } from './schemas/user-channel-draft.schema';
import {
  UserChannelNotificationSetting,
  UserChannelNotificationSettingSchema,
} from './schemas/user-channel-notification-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserPreferences.name, schema: UserPreferencesSchema },
      { name: UserSidebarState.name, schema: UserSidebarStateSchema },
      { name: UserChannelFavorite.name, schema: UserChannelFavoriteSchema },
      { name: UserWorkspaceOrder.name, schema: UserWorkspaceOrderSchema },
      { name: UserLastState.name, schema: UserLastStateSchema },
      { name: UserChannelDraft.name, schema: UserChannelDraftSchema },
      { name: UserChannelNotificationSetting.name, schema: UserChannelNotificationSettingSchema },
    ]),
  ],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}

