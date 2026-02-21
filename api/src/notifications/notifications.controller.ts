import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';

@Controller('notifications')
@Roles('user')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) { }

  @Get()
  list(@Req() req: any, @Query('limit') limit?: string) {
    const take = limit ? Number(limit) : 50;
    return this.notifications.listForUser(req.user.sub, take);
  }

  @Post('mark-read')
  markRead(@Req() req: any, @Body() dto: MarkNotificationsReadDto) {
    return this.notifications.markRead(req.user.sub, dto.ids);
  }
}
