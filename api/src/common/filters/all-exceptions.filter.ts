import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../utils/logger.service';
import { ErrorTrackingService } from '../utils/error-tracking.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: AppLogger,
    private readonly errorTracking: ErrorTrackingService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    this.logger.error(message, (exception as any)?.stack, 'Exception');
    this.errorTracking.capture(exception);

    response.status(status).json({
      statusCode: status,
      errorCode: `ERR_HTTP_${status}`,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
