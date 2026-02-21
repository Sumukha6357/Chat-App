import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '../config/config.service';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext, private readonly config: ConfigService) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    if (process.env.WS_REDIS_ENABLED === 'false') {
      console.log('WS: Redis adapter disabled via config, using in-memory adapter');
      return;
    }

    const pubClient = createClient({
      socket: {
        host: this.config.get('redisHost'),
        port: this.config.get('redisPort'),
        reconnectStrategy: (retries) => {
          if (retries > 3) return new Error('Retry limit reached');
          return Math.min(retries * 50, 500);
        },
      },
      password: this.config.get('redisPassword'),
      database: this.config.get('redisDb'),
    });

    try {
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      this.adapterConstructor = createAdapter(pubClient, subClient);
      console.log('WS: Redis adapter connected');
    } catch (err) {
      console.warn('WS: Failed to connect to Redis, falling back to in-memory adapter', err);
    }
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      console.log('WS: Using in-memory adapter (No Redis)');
    }
    return server;
  }
}
