import { Body, Controller, Delete, Get, Param, Patch, Put, Req } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PreferencesService } from './preferences.service';

@Controller()
@Roles('user')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get('me/preferences')
  getPreferences(@Req() req: any) {
    return this.preferences.getPreferences(req.user.sub);
  }

  @Patch('me/preferences')
  patchPreferences(
    @Req() req: any,
    @Body()
    body: {
      theme?: 'dark' | 'light' | 'midnight';
      density?: 'compact' | 'comfortable' | 'cozy';
      fontSize?: 'sm' | 'md' | 'lg';
      sidebarCollapsed?: boolean;
    },
  ) {
    return this.preferences.updatePreferences(req.user.sub, body);
  }

  @Get('me/sidebar-state')
  getSidebarState(@Req() req: any) {
    return this.preferences.getSidebarState(req.user.sub);
  }

  @Patch('me/sidebar-state')
  patchSidebarState(
    @Req() req: any,
    @Body()
    body: {
      sectionCollapsed?: {
        favorites?: boolean;
        textChannels?: boolean;
        voice?: boolean;
        dms?: boolean;
      };
    },
  ) {
    return this.preferences.updateSidebarState(req.user.sub, body);
  }

  @Get('me/workspace-order')
  async getWorkspaceOrder(@Req() req: any) {
    return { workspaceOrder: await this.preferences.getWorkspaceOrder(req.user.sub) };
  }

  @Put('me/workspace-order')
  async setWorkspaceOrder(@Req() req: any, @Body() body: { workspaceOrder: string[] }) {
    return {
      workspaceOrder: await this.preferences.setWorkspaceOrder(req.user.sub, body.workspaceOrder || []),
    };
  }

  @Get('me/last-state')
  getLastState(@Req() req: any) {
    return this.preferences.getLastState(req.user.sub);
  }

  @Patch('me/last-state')
  patchLastState(
    @Req() req: any,
    @Body() body: { lastWorkspaceId?: string; lastChannelId?: string },
  ) {
    return this.preferences.updateLastState(req.user.sub, body);
  }

  @Get('me/favorites')
  async getFavorites(@Req() req: any) {
    return { roomIds: await this.preferences.listFavorites(req.user.sub) };
  }

  @Put('me/favorites/:roomId')
  async addFavorite(@Req() req: any, @Param('roomId') roomId: string) {
    return { roomIds: await this.preferences.addFavorite(req.user.sub, roomId) };
  }

  @Delete('me/favorites/:roomId')
  async removeFavorite(@Req() req: any, @Param('roomId') roomId: string) {
    return { roomIds: await this.preferences.removeFavorite(req.user.sub, roomId) };
  }

  @Get('drafts')
  listDrafts(@Req() req: any) {
    return this.preferences.listDrafts(req.user.sub);
  }

  @Get('drafts/:roomId')
  getDraft(@Req() req: any, @Param('roomId') roomId: string) {
    return this.preferences.getDraft(req.user.sub, roomId);
  }

  @Put('drafts/:roomId')
  upsertDraft(@Req() req: any, @Param('roomId') roomId: string, @Body() body: { content: string }) {
    return this.preferences.upsertDraft(req.user.sub, roomId, body.content || '');
  }

  @Get('notification-settings')
  listNotificationSettings(@Req() req: any) {
    return this.preferences.listNotificationSettings(req.user.sub);
  }

  @Put('notification-settings/:roomId')
  setNotificationSetting(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Body() body: { level: 'all' | 'mentions' | 'none'; quietHoursEnabled?: boolean },
  ) {
    return this.preferences.setNotificationSetting(
      req.user.sub,
      roomId,
      body.level || 'all',
      Boolean(body.quietHoursEnabled),
    );
  }
}

