import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../database/database.module';
import { ConfigService } from '../config/config.service';

@Injectable()
export class MetricsService {
  private readonly prefix: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.prefix = config.get('redisKeyPrefix');
  }

  private key(name: string) {
    return `${this.prefix}${name}`;
  }

  async getMetrics() {
    const start = Date.now();
    const [onlineUsers, wsConnections, messagesPerMinute, notificationsQueued, notificationsProcessed] =
      await Promise.all([
        this.redis.scard(this.key('online_users')),
        this.redis.get(this.key('ws:connections')),
        this.redis.get(this.key('metrics:messages:1m')),
        this.redis.get(this.key('metrics:notifications:queued')),
        this.redis.get(this.key('metrics:notifications:processed')),
      ]);
    const latencyMs = Date.now() - start;

    return {
      onlineUsers,
      wsConnections: Number(wsConnections || 0),
      messagesPerMinute: Number(messagesPerMinute || 0),
      notificationsQueued: Number(notificationsQueued || 0),
      notificationsProcessed: Number(notificationsProcessed || 0),
      redisLatencyMs: latencyMs,
    };
  }
}
