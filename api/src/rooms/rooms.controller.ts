import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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

@Controller('rooms')
@Roles('user')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) { }

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

  @Post(':id/read')
  async markRead(
    @Param('id') roomId: string,
    @Req() req: any,
    @Body() body: { lastReadMessageId?: string; lastReadAt?: string },
  ) {
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('Invalid room id');
    }
    if (body.lastReadMessageId && !Types.ObjectId.isValid(body.lastReadMessageId)) {
      throw new BadRequestException('Invalid lastReadMessageId');
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

  @Get(':id/read-state')
  async readState(@Param('id') roomId: string, @Req() req: any) {
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
