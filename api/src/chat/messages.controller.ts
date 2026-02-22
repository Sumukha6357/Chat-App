import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoomsService } from '../rooms/rooms.service';
import { MessagesService } from './messages.service';
import { MessageQueryDto } from './dto/message-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GatewayService } from '../gateway/gateway.service';

@Controller('rooms/:roomId/messages')
@Roles('user')
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly rooms: RoomsService,
    private readonly gateway: GatewayService,
  ) {}

  @Get()
  async list(@Param('roomId') roomSlug: string, @Query() query: MessageQueryDto, @Req() req: any) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

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
    @Param('roomId') roomSlug: string,
    @Query('q') q: string,
    @Query() query: MessageQueryDto,
    @Req() req: any,
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

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

  @Patch(':messageId')
  async edit(
    @Param('roomId') roomSlug: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() body: { content: string },
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a room member');
    const message = await this.messages.editMessage(messageId, req.user.sub, body.content);
    this.gateway.emitToRoom(roomId, 'message_edited', { roomId, message });
    return { message };
  }

  @Delete(':messageId')
  async softDelete(
    @Param('roomId') roomSlug: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a room member');
    const message = await this.messages.softDeleteMessage(messageId, req.user.sub);
    this.gateway.emitToRoom(roomId, 'message_deleted', { roomId, messageId, message });
    return { message };
  }

  @Post(':messageId/reactions')
  async addReaction(
    @Param('roomId') roomSlug: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() body: { emoji: string },
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a room member');
    const reactions = await this.messages.addReaction(roomId, messageId, req.user.sub, body.emoji);
    this.gateway.emitToRoom(roomId, 'message_reactions', { roomId, messageId, reactions });
    return { reactions };
  }

  @Delete(':messageId/reactions/:emoji')
  async removeReaction(
    @Param('roomId') roomSlug: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @Req() req: any,
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a room member');
    const reactions = await this.messages.removeReaction(messageId, req.user.sub, emoji);
    this.gateway.emitToRoom(roomId, 'message_reactions', { roomId, messageId, reactions });
    return { reactions };
  }

  @Get(':messageId/reactions')
  async listReactions(
    @Param('roomId') roomSlug: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a room member');
    const reactions = await this.messages.listReactions(messageId);
    return { reactions };
  }

  @Get(':messageId/thread')
  async thread(
    @Param('roomId') roomSlug: string,
    @Param('messageId') messageId: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a room member');
    const items = await this.messages.getThread(roomId, messageId, Number(limit || '100'));
    return { items };
  }

  @Post(':messageId/thread')
  async replyInThread(
    @Param('roomId') roomSlug: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() body: { content: string },
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a room member');
    const message = await this.messages.sendMessage({
      roomId: roomId as any,
      senderId: req.user.sub as any,
      content: body.content,
      type: 'text',
      parentId: messageId as any,
    });
    this.gateway.emitToRoom(roomId, 'thread_reply', { roomId, parentId: messageId, message });
    return { message };
  }

  @Get('search-placeholder')
  async searchPlaceholder() {
    return { enabled: false, hint: 'Full text search ranking can be added later.' };
  }
}
