import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';

export type NodeEnv = 'development' | 'production' | 'test';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  mongoUri: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb: number;
  redisKeyPrefix: string;
  rateLimitPoints: number;
  rateLimitDuration: number;
  wsMaxMessageSize: number;
  corsOrigins: string[];
  shortenerBaseUrl: string;
  shortenerApiToken?: string;
  inviteBaseUrl: string;
}

@Injectable()
export class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    dotenv.config();
    this.config = {
      nodeEnv: (process.env.NODE_ENV as NodeEnv) || 'development',
      port: Number(process.env.PORT || 3000),
      mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/chat',
      jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
      jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
      jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '7d',
      redisHost: process.env.REDIS_HOST || '127.0.0.1',
      redisPort: Number(process.env.REDIS_PORT || 6379),
      redisPassword: process.env.REDIS_PASSWORD || undefined,
      redisDb: Number(process.env.REDIS_DB || 0),
      redisKeyPrefix: process.env.REDIS_KEY_PREFIX || '',
      rateLimitPoints: Number(process.env.RATE_LIMIT_POINTS || 120),
      rateLimitDuration: Number(process.env.RATE_LIMIT_DURATION || 60),
      wsMaxMessageSize: Number(process.env.WS_MAX_MESSAGE_SIZE || 1_000_000),
      corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean),
      shortenerBaseUrl: process.env.SHORTENER_BASE_URL || 'http://localhost:8080',
      shortenerApiToken: process.env.SHORTENER_API_TOKEN || undefined,
      inviteBaseUrl: process.env.CHAT_INVITE_BASE_URL || 'http://localhost:3000',
    };
  }

  get<T extends keyof AppConfig>(key: T): AppConfig[T] {
    return this.config[key];
  }
}
