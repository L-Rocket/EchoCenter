import React from 'react';
import MessageRow from './MessageRow';
import type { Message } from './MessageRow';

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  if (!messages || messages.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No messages yet. Monitoring agent status...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {messages.map((msg) => (
        <MessageRow key={msg.id} message={msg} />
      ))}
    </div>
  );
};

export default MessageList;
