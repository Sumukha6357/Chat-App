import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { AppLogger } from './common/utils/logger.service';
import { requestIdMiddleware } from './common/utils/request-id.middleware';
import { RedisIoAdapter } from './gateway/redis-io.adapter';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { NotificationsService } from './notifications/notifications.service';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);

  app.useLogger(logger);
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(compression());
  const origins = config.get('corsOrigins');
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const redisAdapter = new RedisIoAdapter(app, config);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  await app.init();

  const notifications = app.get(NotificationsService);
  const bullAdapter = new ExpressAdapter();
  bullAdapter.setBasePath('/queues');
  createBullBoard({
    queues: [new BullMQAdapter(notifications.getQueue()) as any],
    serverAdapter: bullAdapter,
  });
  app.use('/queues', bullAdapter.getRouter());

  app.enableShutdownHooks();

  const port = config.get('port');
  await app.listen(port);
  logger.log(`API listening on port ${port}`, 'Bootstrap');
}

bootstrap();
