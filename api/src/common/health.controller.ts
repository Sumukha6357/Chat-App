import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { REDIS_CLIENT } from '../database/database.module';
import { Redis } from 'ioredis';

import { Public } from './decorators/public.decorator';
import { IgnoreEnvelope } from './decorators/ignore-envelope.decorator';

@Controller('health')
@Public()
@IgnoreEnvelope()
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  @Get()
  async health() {
    const mongoOk = this.connection.readyState === 1;
    let redisOk = false;
    try {
      const pong = await this.redis.ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }
    if (!mongoOk || !redisOk) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        mongo: mongoOk ? 'ok' : 'down',
        redis: redisOk ? 'ok' : 'down',
        timestamp: new Date().toISOString(),
      });
    }
    return {
      status: 'ok',
      mongo: 'ok',
      redis: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
