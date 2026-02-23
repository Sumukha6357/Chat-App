import {
  BadRequestException,
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
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { MessagesService } from '../chat/messages.service';
import { UrlShortenerService } from '../common/utils/url-shortener.service';
import { ConfigService } from '../config/config.service';

@Controller('rooms')
@Roles('user')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly messages: MessagesService,
    private readonly urlShortener: UrlShortenerService,
    private readonly config: ConfigService,
  ) { }

  @Get()
  async list(@Req() req: any) {
    const rooms = await this.rooms.findByMember(req.user.sub);
    const roomIds = rooms.map((r: any) => r._id.toString());
    const readState = await this.rooms.getRoomReadState(roomIds, req.user.sub);
    const readByRoom = new Map<string, any>(
      readState.map((r: any) => [r.roomId.toString(), r]),
    );
    const enriched = await Promise.all(
      rooms.map(async (room: any) => {
        const state = readByRoom.get(room._id.toString());
        const lastReadAt = state?.lastReadAt ? new Date(state.lastReadAt) : undefined;
        const unreadCount = await this.rooms.getUnreadCount(room._id.toString(), lastReadAt);
        return {
          ...room,
          unreadCount,
          lastReadMessageId: state?.lastReadMessageId,
          lastReadAt: state?.lastReadAt,
        };
      }),
    );
    return enriched;
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateRoomDto) {
    const members = dto.members ? Array.from(new Set([...dto.members, req.user.sub])) : [req.user.sub];
    return this.rooms.createRoom({
      name: dto.name,
      nameLower: dto.name.toLowerCase(),
      type: dto.type,
      members: members as any,
      admins: [req.user.sub] as any,
      createdBy: req.user.sub as any,
    });
  }

  @Get('search')
  async search(@Req() req: any, @Query('q') q?: string) {
    const term = (q || '').trim().toLowerCase();
    if (!term) return [];
    const rooms = await this.rooms.findByMember(req.user.sub);
    const filtered = rooms.filter(
      (r: any) => (r.nameLower || r.name?.toLowerCase?.() || '').includes(term),
    );
    const roomIds = filtered.map((r: any) => r._id.toString());
    const readState = await this.rooms.getRoomReadState(roomIds, req.user.sub);
    const readByRoom = new Map<string, any>(readState.map((r: any) => [r.roomId.toString(), r]));
    const enriched = await Promise.all(
      filtered.map(async (room: any) => {
        const state = readByRoom.get(room._id.toString());
        const lastReadAt = state?.lastReadAt ? new Date(state.lastReadAt) : undefined;
        const unreadCount = await this.rooms.getUnreadCount(room._id.toString(), lastReadAt);
        return {
          ...room,
          unreadCount,
          lastReadMessageId: state?.lastReadMessageId,
          lastReadAt: state?.lastReadAt,
        };
      }),
    );
    return enriched;
  }

  @Patch(':id')
  async update(@Param('id') roomSlug: string, @Req() req: any, @Body() body: any) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a member of this room');
    // Simplified: only allow certain fields to be updated
    const update: any = {};
    if (body.name) {
      update.name = body.name;
      update.nameLower = body.name.toLowerCase();
    }
    if (body.topic !== undefined) update.topic = body.topic;
    if (body.description !== undefined) update.description = body.description;
    if (body.image !== undefined) update.image = body.image;
    return this.rooms.update(roomId, update);
  }

  @Post(':id/leave')
  async leave(@Param('id') roomSlug: string, @Req() req: any) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new BadRequestException('Not a member of this room');
    await this.rooms.removeMember(roomId, req.user.sub);
    return { success: true };
  }

  @Delete(':id/messages')
  async clearMessages(@Param('id') roomSlug: string, @Req() req: any) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a member of this room');
    await this.messages.deleteByRoom(roomId);
    return { success: true };
  }

  @Get(':id')
  async getRoom(@Param('id') id: string, @Req() req: any): Promise<any> {
    const room = await this.rooms.findByIdOrSlug(id);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const state = await this.rooms.getRoomReadState([roomId], req.user.sub);
    const lastReadAt = state[0]?.lastReadAt ? new Date(state[0].lastReadAt) : undefined;
    const unreadCount = await this.rooms.getUnreadCount(roomId, lastReadAt);

    return {
      ...room,
      unreadCount,
      lastReadMessageId: state[0]?.lastReadMessageId,
      lastReadAt: state[0]?.lastReadAt,
    };
  }

  @Post(':id/read')
  async markRead(
    @Param('id') roomSlug: string,
    @Req() req: any,
    @Body() body: { lastReadMessageId?: string; lastReadAt?: string },
  ) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

    // Guard: ignore invalid message IDs (prevents 400 for temporal client-side IDs)
    if (body.lastReadMessageId && !Types.ObjectId.isValid(body.lastReadMessageId)) {
      return { roomId, ok: true, ignored: true };
    }

    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) {
      return { ok: false };
    }
    await this.rooms.upsertReadCursor(
      roomId,
      req.user.sub,
      body.lastReadMessageId,
      body.lastReadAt,
    );
    return { roomId, lastReadMessageId: body.lastReadMessageId, lastReadAt: body.lastReadAt };
  }

  @Post(':id/invite-link')
  async createInviteLink(@Param('id') roomSlug: string, @Req() req: any) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();
    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const shareId = room.slug || roomId;
    const longUrl = `${this.config.get('inviteBaseUrl')}/rooms/${shareId}?invite=1`;
    const alias = `chat-${shareId}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 28);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const shortUrl = await this.urlShortener.shorten(longUrl, alias, expiresAt);
    return {
      feature: 'invite-links',
      roomId,
      longUrl,
      shortUrl,
    };
  }

  @Get(':id/read-state')
  async readState(@Param('id') roomSlug: string, @Req() req: any) {
    const room = await this.rooms.findByIdOrSlug(roomSlug);
    if (!room) throw new NotFoundException('Room not found');
    const roomId = room._id.toString();

    const isMember = await this.rooms.isMember(roomId, req.user.sub);
    if (!isMember) {
      return { members: [] };
    }
    const members = await this.rooms.getRoomReadState([roomId], req.user.sub);
    return {
      members: members
        .filter((m: any) => m.userId.toString() !== req.user.sub)
        .map((m: any) => ({
          userId: m.userId.toString(),
          lastReadMessageId: m.lastReadMessageId,
          lastReadAt: m.lastReadAt,
        })),
    };
  }
}
