import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PresenceModule } from '../presence/presence.module';
import { RoomsModule } from '../rooms/rooms.module';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PresenceModule,
    RoomsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
