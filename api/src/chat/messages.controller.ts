import { Controller, ForbiddenException, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoomsService } from '../rooms/rooms.service';
import { MessagesService } from './messages.service';
import { MessageQueryDto } from './dto/message-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('rooms/:roomId/messages')
@Roles('user')
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly rooms: RoomsService,
  ) { }

  @Get()
  async list(@Param('roomId') roomId: string, @Query() query: MessageQueryDto, @Req() req: any) {
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) {
      throw new ForbiddenException('Not a room member');
    }

    const cursor = query.cursorId && query.cursorCreatedAt
      ? { id: query.cursorId, createdAt: new Date(query.cursorCreatedAt) }
      : undefined;
    const items = await this.messages.getMessages(roomId, query.limit || 50, cursor);
    const last = items[items.length - 1] as any;
    const nextCursor = last
      ? { id: last._id?.toString?.() || last._id, createdAt: last.createdAt }
      : null;
    return { items, nextCursor };
  }

  @Get('search')
  async search(
    @Param('roomId') roomId: string,
    @Query('q') q: string,
    @Query() query: MessageQueryDto,
    @Req() req: any,
  ) {
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) {
      throw new ForbiddenException('Not a room member');
    }
    const term = (q || '').trim();
    if (!term) return { items: [], nextCursor: null };
    const cursor = query.cursorId && query.cursorCreatedAt
      ? { id: query.cursorId, createdAt: new Date(query.cursorCreatedAt) }
      : undefined;
    const items = await this.messages.searchMessages(roomId, term, query.limit || 50, cursor);
    const last = items[items.length - 1] as any;
    const nextCursor = last
      ? { id: last._id?.toString?.() || last._id, createdAt: last.createdAt }
      : null;
    return { items, nextCursor };
  }
}
