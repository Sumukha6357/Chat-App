import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppLogger } from './utils/logger.service';
import { RateLimitService } from './utils/rate-limit.service';
import { ErrorTrackingService } from './utils/error-tracking.service';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { UrlShortenerService } from './utils/url-shortener.service';

@Global()
@Module({
  controllers: [HealthController, MetricsController],
  providers: [
    AppLogger,
    RateLimitService,
    ErrorTrackingService,
    MetricsService,
    UrlShortenerService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AppLogger, RateLimitService, UrlShortenerService],
})
export class CommonModule { }
