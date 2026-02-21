import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { PresenceModule } from '../presence/presence.module';
import { UsersModule } from '../users/users.module';
import { ChatModule } from '../chat/chat.module';
import { RoomsModule } from '../rooms/rooms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatGateway } from './chat.gateway';
import { GatewayService } from './gateway.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    PresenceModule,
    UsersModule,
    ChatModule,
    RoomsModule,
    forwardRef(() => NotificationsModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwtAccessSecret'),
      }),
    }),
  ],
  providers: [ChatGateway, GatewayService, WsJwtGuard],
  exports: [GatewayService],
})
export class GatewayModule { }
