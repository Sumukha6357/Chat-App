import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../database/database.module';
import { ConfigService } from '../config/config.service';

// TTL policy:
// - socket/user/room sets are short-lived and refreshed on activity
// - user presence hash is short for online and longer but bounded for offline
const SOCKET_SET_TTL_SECONDS = 3600; // 1 hour
const ONLINE_PRESENCE_TTL_SECONDS = 60 * 5; // 5 minutes
const OFFLINE_PRESENCE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class PresenceService {
  private readonly prefix: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.prefix = config.get('redisKeyPrefix');
  }

  private userSocketsKey(userId: string) {
    return `${this.prefix}user:${userId}:sockets`;
  }

  private onlineUsersKey() {
    return `${this.prefix}online_users`;
  }

  private roomUsersKey(roomId: string) {
    // Unique users online in a room
    return `${this.prefix}presence:room:${roomId}:users`;
  }

  private roomSocketsKey(roomId: string) {
    // All sockets connected to a room
    return `${this.prefix}presence:room:${roomId}:sockets`;
  }

  private roomUserSocketsKey(roomId: string, userId: string) {
    // Sockets for a user within a room (dedupe multi-tab)
    return `${this.prefix}presence:room:${roomId}:user:${userId}:sockets`;
  }

  private socketRoomsKey(socketId: string) {
    // Rooms a socket is currently in
    return `${this.prefix}presence:socket:${socketId}:rooms`;
  }

  private userPresenceKey(userId: string) {
    return `${this.prefix}presence:user:${userId}`;
  }

  async addSocket(userId: string, socketId: string) {
    const key = this.userSocketsKey(userId);
    await this.redis.sadd(key, socketId);
    await this.redis.expire(key, SOCKET_SET_TTL_SECONDS);
    await this.redis.sadd(this.onlineUsersKey(), userId);
  }

  async removeSocket(userId: string, socketId: string) {
    const key = this.userSocketsKey(userId);
    await this.redis.srem(key, socketId);
    const remaining = await this.redis.scard(key);
    if (remaining === 0) {
      await this.redis.srem(this.onlineUsersKey(), userId);
    }
  }

  async addUserToRoom(roomId: string, userId: string, socketId?: string) {
    if (socketId) {
      await this.redis.sadd(this.roomSocketsKey(roomId), socketId);
      await this.redis.sadd(this.roomUserSocketsKey(roomId, userId), socketId);
      await this.redis.sadd(this.socketRoomsKey(socketId), roomId);
      await this.redis.expire(this.roomUserSocketsKey(roomId, userId), SOCKET_SET_TTL_SECONDS);
      await this.redis.expire(this.roomSocketsKey(roomId), SOCKET_SET_TTL_SECONDS);
      await this.redis.expire(this.socketRoomsKey(socketId), SOCKET_SET_TTL_SECONDS);
    }
    await this.redis.sadd(this.roomUsersKey(roomId), userId);
    await this.redis.expire(this.roomUsersKey(roomId), SOCKET_SET_TTL_SECONDS);
  }

  async removeUserFromRoom(roomId: string, userId: string, socketId?: string) {
    if (socketId) {
      await this.redis.srem(this.roomSocketsKey(roomId), socketId);
      await this.redis.srem(this.roomUserSocketsKey(roomId, userId), socketId);
      await this.redis.srem(this.socketRoomsKey(socketId), roomId);
      const remaining = await this.redis.scard(this.roomUserSocketsKey(roomId, userId));
      if (remaining === 0) {
        await this.redis.srem(this.roomUsersKey(roomId), userId);
      }
      return;
    }
    await this.redis.srem(this.roomUsersKey(roomId), userId);
  }

  async getUserSockets(userId: string) {
    return this.redis.smembers(this.userSocketsKey(userId));
  }

  async isUserOnline(userId: string) {
    const isMember = await this.redis.sismember(this.onlineUsersKey(), userId);
    return isMember === 1;
  }

  async getRoomOnlineMembers(roomId: string) {
    return this.redis.smembers(this.roomUsersKey(roomId));
  }

  async getRoomOnlineCount(roomId: string) {
    await this.cleanupRoomUsers(roomId);
    return this.redis.scard(this.roomUsersKey(roomId));
  }

  async removeSocketFromAllRooms(socketId: string, userId: string) {
    const rooms = await this.redis.smembers(this.socketRoomsKey(socketId));
    if (rooms.length === 0) return [];
    const affected: string[] = [];
    for (const roomId of rooms) {
      await this.removeUserFromRoom(roomId, userId, socketId);
      affected.push(roomId);
    }
    await this.redis.del(this.socketRoomsKey(socketId));
    return affected;
  }

  private async cleanupRoomUsers(roomId: string) {
    const users = await this.redis.smembers(this.roomUsersKey(roomId));
    if (users.length === 0) return;
    const pipeline = this.redis.pipeline();
    users.forEach((userId) => {
      pipeline.scard(this.roomUserSocketsKey(roomId, userId));
    });
    const results = await pipeline.exec();
    if (!results) return;
    const staleUsers: string[] = [];
    results.forEach(([, count], idx) => {
      if (typeof count === 'number' && count === 0) {
        staleUsers.push(users[idx]);
      }
    });
    if (staleUsers.length > 0) {
      await this.redis.srem(this.roomUsersKey(roomId), ...staleUsers);
    }
  }

  async setUserOnline(userId: string) {
    const key = this.userPresenceKey(userId);
    const lastSeenAt = Date.now();
    await this.redis.hset(key, {
      status: 'online',
      lastSeenAt: String(lastSeenAt),
    });
    await this.redis.expire(key, ONLINE_PRESENCE_TTL_SECONDS);
  }

  async setUserOffline(userId: string) {
    const key = this.userPresenceKey(userId);
    const lastSeenAt = Date.now();
    await this.redis.hset(key, {
      status: 'offline',
      lastSeenAt: String(lastSeenAt),
    });
    await this.redis.expire(key, OFFLINE_PRESENCE_TTL_SECONDS);
  }

  async getUserPresence(userId: string) {
    const data = await this.redis.hgetall(this.userPresenceKey(userId));
    if (!data || Object.keys(data).length === 0) return null;
    return {
      status: data.status as 'online' | 'offline' | 'away',
      lastSeenAt: data.lastSeenAt,
    };
  }

  async getUsersPresence(userIds: string[]) {
    if (userIds.length === 0) return {};
    const pipeline = this.redis.pipeline();
    userIds.forEach((id) => pipeline.hgetall(this.userPresenceKey(id)));
    const results = await pipeline.exec();
    const map: Record<string, { status: 'online' | 'offline' | 'away'; lastSeenAt?: string }> = {};
    results?.forEach(([, value], idx) => {
      const data = value as { status?: string; lastSeenAt?: string } | undefined;
      if (data && Object.keys(data).length > 0) {
        map[userIds[idx]] = {
          status: data.status as 'online' | 'offline' | 'away',
          lastSeenAt: data.lastSeenAt,
        };
      }
    });
    return map;
  }
}
