import { BadRequestException, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { PresenceService } from '../presence/presence.service';
import { RoomsService } from '../rooms/rooms.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('users')
@Roles('user')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly presence: PresenceService,
    private readonly rooms: RoomsService,
  ) { }

  @Get('me')
  async me(@Req() req: any) {
    return this.users.findById(req.user.sub);
  }

  @Get('presence')
  async presenceByIds(@Query('ids') ids: string, @Req() req: any) {
    const list = (ids || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    // TODO: restrict to users sharing a room with requester
    const data = await this.presence.getUsersPresence(list);
    return data;
  }

  @Post(':id/block')
  async blockUser(@Param('id') targetUserId: string, @Req() req: any) {
    const userId = req.user.sub;
    if (!targetUserId || targetUserId === userId) {
      throw new BadRequestException('Invalid user');
    }
    await this.users.blockUser(userId, targetUserId);
    return { ok: true };
  }

  @Post(':id/unblock')
  async unblockUser(@Param('id') targetUserId: string, @Req() req: any) {
    const userId = req.user.sub;
    if (!targetUserId || targetUserId === userId) {
      throw new BadRequestException('Invalid user');
    }
    await this.users.unblockUser(userId, targetUserId);
    return { ok: true };
  }
}
