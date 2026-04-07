import { Message } from '@/store/chatStore';
import { MessageCard } from './MessageCard';
import { motion, AnimatePresence } from 'framer-motion';

export function MessageList({
  messages,
  highlightedMessageId,
}: {
  messages: Message[];
  highlightedMessageId?: string;
}) {
  console.log('MessageList rendering with messages:', messages.length);
  
  return (
    <div className="flex flex-col gap-1 w-full pb-4">
      {messages.map((message, index) => {
        const isFirstInGroup = index === 0 || messages[index - 1].senderId !== message.senderId;
        return (
          <MessageCard
            key={message._id || message.clientMessageId}
            message={message}
            highlighted={message._id === highlightedMessageId}
            isFirstInGroup={isFirstInGroup}
            showAvatar={!message.isDeleted}
          />
        );
      })}
    </div>
  );
}
