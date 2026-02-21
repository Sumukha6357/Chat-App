import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RateLimitService } from '../utils/rate-limit.service';
import { Request } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const ip = (req as any)?.ip || 'unknown';
    const key = `http:${ip}`;

    try {
      await this.rateLimit.consume(key);
      return true;
    } catch {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
