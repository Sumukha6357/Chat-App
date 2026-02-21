import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IGNORE_ENVELOPE_KEY } from '../decorators/ignore-envelope.decorator';

export interface Response<T> {
    data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
    constructor(private reflector: Reflector) { }

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<Response<T>> {
        const ignoreEnvelope = this.reflector.getAllAndOverride<boolean>(IGNORE_ENVELOPE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (ignoreEnvelope) {
            return next.handle();
        }

        return next.handle().pipe(
            map((data) => {
                // If data is already wrapped (prevent double wrapping)
                if (data && typeof data === 'object' && 'data' in data) {
                    return data as Response<T>;
                }
                return { data };
            }),
        );
    }
}
