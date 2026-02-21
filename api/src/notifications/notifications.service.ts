import { forwardRef, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { PresenceService } from '../presence/presence.service';
import { GatewayService } from '../gateway/gateway.service';
import { NotificationsRepository } from './notifications.repository';
import { Notification } from './schemas/notification.schema';

export type NotificationType = 'message_received' | 'mention' | 'system_alert';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue;
  private dlq!: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly presence: PresenceService,
    @Inject(forwardRef(() => GatewayService))
    private readonly gateway: GatewayService,
    private readonly notificationsRepo: NotificationsRepository,
  ) {}

  onModuleInit() {
    const connection = {
      host: this.config.get('redisHost'),
      port: this.config.get('redisPort'),
      password: this.config.get('redisPassword'),
      db: this.config.get('redisDb'),
    };

    const prefix = this.config.get('redisKeyPrefix');
    this.queue = new Queue('notifications', {
      connection,
      prefix,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 500 } },
    });
    this.dlq = new Queue('notifications_dlq', { connection, prefix });

    this.worker = new Worker(
      'notifications',
      async (job) => {
        const { userId, type, payload } = job.data as {
          userId: string;
          type: NotificationType;
          payload: Record<string, unknown>;
        };

        await this.notificationsRepo.create({
          userId,
          type,
          payload,
        } as unknown as Partial<Notification>);
        await this.incrementCounter('metrics:notifications:processed');
      },
      { connection, prefix },
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      await this.dlq.add('failed', { ...job.data, error: err?.message });
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.dlq?.close();
  }

  getQueue() {
    return this.queue;
  }

  async notifyUser(userId: string, type: NotificationType, payload: Record<string, unknown>) {
    const online = await this.presence.isUserOnline(userId);
    if (online) {
      await this.gateway.emitNotificationToUser(userId, { type, payload });
      return { delivered: 'realtime' };
    }

    await this.incrementCounter('metrics:notifications:queued');
    await this.queue.add('notification', { userId, type, payload });
    return { delivered: 'queued' };
  }

  listForUser(userId: string, limit = 50) {
    return this.notificationsRepo.findByUser(userId, limit);
  }

  markRead(userId: string, ids: string[]) {
    return this.notificationsRepo.markRead(userId, ids);
  }

  private async incrementCounter(key: string) {
    const prefix = this.config.get('redisKeyPrefix');
    const client = await this.queue.client;
    await client.incr(`${prefix}${key}`);
  }
}
