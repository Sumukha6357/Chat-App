import { Inject, Injectable } from '@nestjs/common';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import { ConfigService } from '../../config/config.service';
import { REDIS_CLIENT } from '../../database/database.module';

@Injectable()
export class RateLimitService {
  private readonly limiter: RateLimiterRedis;
  private readonly customLimiters = new Map<string, RateLimiterRedis>();
  private readonly prefix: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    const prefix = config.get('redisKeyPrefix');
    this.prefix = prefix;
    this.limiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: `${prefix}ratelimit`,
      points: config.get('rateLimitPoints'),
      duration: config.get('rateLimitDuration'),
    });
  }

  async consume(key: string, points = 1) {
    return this.limiter.consume(key, points);
  }

  async consumeWithLimit(key: string, maxPoints: number, durationSeconds: number, points = 1) {
    const cacheKey = `${maxPoints}:${durationSeconds}`;
    let limiter = this.customLimiters.get(cacheKey);
    if (!limiter) {
      limiter = new RateLimiterRedis({
        storeClient: this.redis,
        keyPrefix: `${this.prefix}ratelimit:${cacheKey}`,
        points: maxPoints,
        duration: durationSeconds,
      });
      this.customLimiters.set(cacheKey, limiter);
    }
    return limiter.consume(key, points);
  }
}
