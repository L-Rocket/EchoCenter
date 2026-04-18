import React from 'react';
import MessageRow from './MessageRow';
import EmptyState from '../common/EmptyState';
import type { LogMessage } from '@/types';

interface MessageListProps {
  messages: LogMessage[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-1">
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
    </div>
  );
};

export default MessageList;
