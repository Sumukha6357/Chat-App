import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        if (context.getType() !== 'http') {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const url = request?.url || '';
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        console.log(`[JwtAuthGuard] url=${url} isPublic=${isPublic} handler=${context.getHandler()?.name} class=${context.getClass()?.name}`);

        if (
            url.toLowerCase().includes('auth') ||
            isPublic
        ) {
            console.log(`[JwtAuthGuard] BYPASSING`);
            return true;
        }

        return super.canActivate(context);
    }
}
