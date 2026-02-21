import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Observable } from 'rxjs';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const url = request?.url || '';

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log(`[RolesGuard] url=${url} isPublic=${isPublic} handler=${context.getHandler().name} class=${context.getClass().name}`);

    if (
      url.toLowerCase().includes('auth') ||
      isPublic
    ) {
      console.log(`[RolesGuard] BYPASSING`);
      return true;
    }

    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const { user } = request;
    if (!user) {
      console.log(`[RolesGuard] NO USER -> 403`);
      return false;
    }

    return roles.some((role) => user.roles?.includes(role));
  }
}
