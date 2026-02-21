import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../config/config.service';
import { REDIS_CLIENT } from '../database/database.module';
import { Redis } from 'ioredis';

export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  roles: string[];
  jti: string;
  type: TokenType;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  async register(email: string, username: string, password: string, avatar?: string) {
    const existingEmail = await this.users.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    const existingUsername = await this.users.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already in use');
    }

    const passwordHash = await hash(password, 12);
    const user = await this.users.createUser({ email, username, passwordHash, avatar });
    return this.signTokens(user._id.toString(), email, user.roles, user.username);
  }

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    return this.signTokens(user._id.toString(), user.email, user.roles, user.username);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const revoked = await this.isRefreshTokenRevoked(payload.jti);
    if (revoked) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    await this.revokeRefreshToken(payload.jti, payload.exp);
    return this.signTokens(payload.sub, payload.email, payload.roles, payload.username);
  }

  async signTokens(userId: string, email: string, roles: string[], username?: string) {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      username: username || '',
      roles,
      jti: uuidv4(),
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      username: username || '',
      roles,
      jti: uuidv4(),
      type: 'refresh',
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get('jwtAccessSecret'),
      expiresIn: this.config.get('jwtAccessTtl') as any,
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get('jwtRefreshSecret'),
      expiresIn: this.config.get('jwtRefreshTtl') as any,
    });

    return { accessToken, refreshToken, userId, username };
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload & { exp: number }> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload & { exp: number }>(token, {
        secret: this.config.get('jwtRefreshSecret'),
      });
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeRefreshToken(jti: string, exp: number) {
    const ttlSeconds = Math.max(exp - Math.floor(Date.now() / 1000), 0);
    if (ttlSeconds > 0) {
      await this.redis.set(
        `${this.config.get('redisKeyPrefix')}rt:blacklist:${jti}`,
        '1',
        'EX',
        ttlSeconds,
      );
    }
  }

  async isRefreshTokenRevoked(jti: string) {
    const value = await this.redis.get(
      `${this.config.get('redisKeyPrefix')}rt:blacklist:${jti}`,
    );
    return value === '1';
  }
}
