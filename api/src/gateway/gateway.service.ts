import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PresenceService } from '../presence/presence.service';

@Injectable()
export class GatewayService {
  private server?: Server;

  constructor(private readonly presence: PresenceService) {}

  setServer(server: Server) {
    this.server = server;
  }

  async emitNotificationToUser(userId: string, payload: unknown) {
    if (!this.server) return;
    const sockets = await this.presence.getUserSockets(userId);
    sockets.forEach((socketId) => this.server?.to(socketId).emit('notification', payload));
  }
}
