import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get('mongoUri'),
        retryWrites: true,
        serverSelectionTimeoutMS: 5000,
      }),
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Redis({
          host: config.get('redisHost'),
          port: config.get('redisPort'),
          password: config.get('redisPassword'),
          db: config.get('redisDb'),
          keyPrefix: config.get('redisKeyPrefix') || undefined,
          maxRetriesPerRequest: 3, // Fail fast in tests/local if redis is down
          retryStrategy: (times) => {
            if (times > 3) return null; // Stop retrying after 3 attempts
            return Math.min(times * 50, 2000);
          },
        });
      },
    },
  ],
  exports: [MongooseModule, REDIS_CLIENT],
})
export class DatabaseModule { }
