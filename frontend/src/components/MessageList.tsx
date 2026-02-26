import React from 'react';
import MessageRow from './MessageRow';
import type { Message } from './MessageRow';
import EmptyState from './EmptyState';

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  if (!messages || messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-1">
      {messages.map((msg) => (
        <MessageRow key={msg.id} message={msg} />
      ))}
    </div>
  );
};

export default MessageList;
