import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { MessageReaction, MessageReactionSchema } from './schemas/message-reaction.schema';
import { MessageEdit, MessageEditSchema } from './schemas/message-edit.schema';
import { MessageMention, MessageMentionSchema } from './schemas/message-mention.schema';
import { MessagesRepository } from './repositories/messages.repository';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { UploadsController } from './uploads.controller';
import { RoomsModule } from '../rooms/rooms.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: MessageReaction.name, schema: MessageReactionSchema },
      { name: MessageEdit.name, schema: MessageEditSchema },
      { name: MessageMention.name, schema: MessageMentionSchema },
    ]),
    forwardRef(() => RoomsModule),
    forwardRef(() => GatewayModule),
  ],
  controllers: [MessagesController, UploadsController],
  providers: [MessagesRepository, MessagesService],
  exports: [MessagesService],
})
export class ChatModule {}
