import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { MessagesRepository } from './repositories/messages.repository';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { UploadsController } from './uploads.controller';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    forwardRef(() => RoomsModule),
  ],
  controllers: [MessagesController, UploadsController],
  providers: [MessagesRepository, MessagesService],
  exports: [MessagesService],
})
export class ChatModule {}
