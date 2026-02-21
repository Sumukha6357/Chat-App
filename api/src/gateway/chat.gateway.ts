import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { PresenceService } from '../presence/presence.service';
import { UsersService } from '../users/users.service';
import { MessagesService } from '../chat/messages.service';
import { RoomsService } from '../rooms/rooms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../common/utils/rate-limit.service';
import { GatewayService } from './gateway.service';
import { JoinRoomDto } from './dto/join-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { TypingDto } from './dto/typing.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { JwtPayload } from '../auth/auth.service';
import { REDIS_CLIENT } from '../database/database.module';
import { Redis } from 'ioredis';
import { Inject, OnApplicationShutdown, UsePipes, ValidationPipe } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin:
      process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.length > 0
        ? process.env.CORS_ORIGINS.split(',').map((v) => v.trim())
        : false,
    credentials: true,
  },
  maxHttpBufferSize: Number(process.env.WS_MAX_MESSAGE_SIZE || 1_000_000),
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ChatGateway implements OnApplicationShutdown {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly presence: PresenceService,
    private readonly users: UsersService,
    private readonly messages: MessagesService,
    private readonly rooms: RoomsService,
    private readonly notifications: NotificationsService,
    private readonly rateLimit: RateLimitService,
    private readonly gatewayService: GatewayService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  afterInit() {
    this.gatewayService.setServer(this.server);
  }

  async handleConnection(client: Socket) {
    try {
      const payload = await this.validateSocket(client);
      client.data.user = payload;
      await this.presence.addSocket(payload.sub, client.id);
      await this.users.updateStatus(payload.sub, 'online');
      await this.presence.setUserOnline(payload.sub);
      this.server.emit('presence_update', {
        userId: payload.sub,
        status: 'online',
        lastSeenAt: Date.now(),
      });
      await this.redis.incr(`${this.config.get('redisKeyPrefix')}ws:connections`);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const payload = client.data.user as JwtPayload | undefined;
    if (!payload) return;
    await this.presence.removeSocket(payload.sub, client.id);
    const affectedRooms = await this.presence.removeSocketFromAllRooms(client.id, payload.sub);
    for (const roomId of affectedRooms) {
      const onlineCount = await this.presence.getRoomOnlineCount(roomId);
      this.server.to(roomId).emit('room_presence', { roomId, onlineCount });
    }
    const online = await this.presence.isUserOnline(payload.sub);
    if (!online) {
      await this.users.updateStatus(payload.sub, 'offline', new Date());
      await this.presence.setUserOffline(payload.sub);
      this.server.emit('presence_update', {
        userId: payload.sub,
        status: 'offline',
        lastSeenAt: Date.now(),
      });
    }
    await this.redis.decr(`${this.config.get('redisKeyPrefix')}ws:connections`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_room')
  async handleJoinRoom(@MessageBody() body: JoinRoomDto, @ConnectedSocket() client: Socket) {
    const payload = client.data.user as JwtPayload;
    const isMember = await this.rooms.isMember(body.roomId, payload.sub);
    if (!isMember) {
      throw new WsException('Not a room member');
    }
    const room = await this.rooms.findById(body.roomId);
    if (room?.type === 'direct' && Array.isArray(room.members)) {
      const otherId = room.members.find((id: any) => id.toString() !== payload.sub);
      if (otherId) {
        const blockedByOther = await this.users.hasBlocked(otherId.toString(), payload.sub);
        const blockedByMe = await this.users.hasBlocked(payload.sub, otherId.toString());
        if (blockedByOther || blockedByMe) {
          throw new WsException('User is blocked');
        }
      }
    }
    await this.rateLimit.consume(`ws:${payload.sub}:join_room`);
    await client.join(body.roomId);
    await this.presence.addUserToRoom(body.roomId, payload.sub, client.id);
    const onlineCount = await this.presence.getRoomOnlineCount(body.roomId);
    this.server.to(body.roomId).emit('room_presence', { roomId: body.roomId, onlineCount });
    client.emit('room_presence', { roomId: body.roomId, onlineCount });
    return { event: 'joined_room', data: { roomId: body.roomId } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@MessageBody() body: JoinRoomDto, @ConnectedSocket() client: Socket) {
    const payload = client.data.user as JwtPayload;
    const isMember = await this.rooms.isMember(body.roomId, payload.sub);
    if (!isMember) {
      throw new WsException('Not a room member');
    }
    await this.rateLimit.consume(`ws:${payload.sub}:leave_room`);
    await client.leave(body.roomId);
    await this.presence.removeUserFromRoom(body.roomId, payload.sub, client.id);
    const onlineCount = await this.presence.getRoomOnlineCount(body.roomId);
    this.server.to(body.roomId).emit('room_presence', { roomId: body.roomId, onlineCount });
    return { event: 'left_room', data: { roomId: body.roomId } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room_presence_sync')
  async handleRoomPresenceSync(@MessageBody() body: JoinRoomDto, @ConnectedSocket() client: Socket) {
    const payload = client.data.user as JwtPayload;
    const isMember = await this.rooms.isMember(body.roomId, payload.sub);
    if (!isMember) {
      throw new WsException('Not a room member');
    }
    const onlineCount = await this.presence.getRoomOnlineCount(body.roomId);
    client.emit('room_presence', { roomId: body.roomId, onlineCount });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing_start')
  async handleTypingStart(@MessageBody() body: TypingDto, @ConnectedSocket() client: Socket) {
    const payload = client.data.user as JwtPayload;
    const isMember = await this.rooms.isMember(body.roomId, payload.sub);
    if (!isMember) {
      throw new WsException('Not a room member');
    }
    await this.rateLimit.consume(`ws:${payload.sub}:typing`, 1);
    this.server.to(body.roomId).emit('typing_start', { roomId: body.roomId, userId: payload.sub });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing_stop')
  async handleTypingStop(@MessageBody() body: TypingDto, @ConnectedSocket() client: Socket) {
    const payload = client.data.user as JwtPayload;
    const isMember = await this.rooms.isMember(body.roomId, payload.sub);
    if (!isMember) {
      throw new WsException('Not a room member');
    }
    await this.rateLimit.consume(`ws:${payload.sub}:typing`, 1);
    this.server.to(body.roomId).emit('typing_stop', { roomId: body.roomId, userId: payload.sub });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() body: SendMessageDto,
    @ConnectedSocket() client: Socket,
    ack?: (response: unknown) => void,
  ) {
    const payload = client.data.user as JwtPayload;
    try {
      await this.rateLimit.consumeWithLimit(`ws:${payload.sub}:send_message`, 5, 3, 1);

      const room = await this.rooms.findById(body.roomId);
      if (!room) {
        throw new WsException('Room not found');
      }
      const isMember = await this.rooms.isMember(body.roomId, payload.sub);
      if (!isMember) {
        throw new WsException('Not a room member');
      }
      if (room.type === 'direct' && Array.isArray(room.members)) {
        const otherId = room.members.find((id: any) => id.toString() !== payload.sub);
        if (otherId) {
          const blockedByOther = await this.users.hasBlocked(otherId.toString(), payload.sub);
          if (blockedByOther) {
            throw new WsException('User is blocked');
          }
        }
      }

      if (body.clientMessageId) {
        const existing = await this.messages.findByClientMessageId(
          body.roomId,
          payload.sub,
          body.clientMessageId,
        );
        if (existing) {
          ack?.({ ok: true, messageId: (existing as any)._id, deduped: true });
          return;
        }
      }

      const message = await this.messages.sendMessage({
        roomId: body.roomId as any,
        senderId: payload.sub as any,
        content: body.content,
        type: body.type || 'text',
        clientMessageId: body.clientMessageId,
        attachments: body.attachments || [],
      });

      this.server.to(body.roomId).emit('message', message);
      ack?.({ ok: true, messageId: (message as any)._id });
      await this.redis.incr(`${this.config.get('redisKeyPrefix')}metrics:messages:1m`);
      await this.redis.expire(`${this.config.get('redisKeyPrefix')}metrics:messages:1m`, 60);

      const offlineMembers = (room.members || []).filter(
        (member) => member.toString() !== payload.sub,
      );

      await Promise.all(
        offlineMembers.map(async (memberId) => {
          await this.notifications.notifyUser(memberId.toString(), 'message_received', {
            roomId: body.roomId,
            messageId: (message as any)._id,
          });
        }),
      );
    } catch (error: any) {
      const message = error?.message || 'Unexpected error';
      client.emit('error', { message });
      throw error;
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('mark_read')
  async handleMarkRead(@MessageBody() body: MarkReadDto, @ConnectedSocket() client: Socket) {
    const payload = client.data.user as JwtPayload;
    const isMember = await this.rooms.isMember(body.roomId, payload.sub);
    if (!isMember) {
      throw new WsException('Not a room member');
    }
    await this.rateLimit.consume(`ws:${payload.sub}:mark_read`);
    await this.messages.markRead(body.roomId, payload.sub, body.messageIds);
    await this.rooms.upsertReadCursor(
      body.roomId,
      payload.sub,
      body.messageIds[body.messageIds.length - 1],
      new Date().toISOString(),
    );
    this.server.to(body.roomId).emit('read_receipt', {
      roomId: body.roomId,
      userId: payload.sub,
      messageIds: body.messageIds,
    });
    const readStatePayload = {
      roomId: body.roomId,
      userId: payload.sub,
      lastReadMessageId: body.messageIds[body.messageIds.length - 1],
      lastReadAt: new Date().toISOString(),
    };
    client.emit('read_state', readStatePayload);
    this.server.to(body.roomId).emit('read_state', readStatePayload);
  }

  private async validateSocket(client: Socket): Promise<JwtPayload> {
    const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization?.split(' ')[1];
    if (!token) {
      throw new WsException('Missing token');
    }

    const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.get('jwtAccessSecret'),
    });
    if (payload.type !== 'access') {
      throw new WsException('Invalid token');
    }
    return payload;
  }

  onApplicationShutdown() {
    this.server?.disconnectSockets?.(true);
    this.server?.close?.();
  }
}
