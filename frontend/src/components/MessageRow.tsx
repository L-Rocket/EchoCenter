import React from 'react';

export interface Message {
  id: number;
  agent_id: string;
  level: string;
  content: string;
  timestamp: string;
}

interface MessageRowProps {
  message: Message;
}

const MessageRow: React.FC<MessageRowProps> = ({ message }) => {
  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'INFO':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formattedTime = new Date(message.timestamp).toLocaleTimeString();

  return (
    <div className={`p-4 mb-2 border rounded shadow-sm ${getLevelColor(message.level)}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold">{message.agent_id}</span>
        <span className="text-xs opacity-75">{formattedTime}</span>
      </div>
      <div className="text-sm">{message.content}</div>
    </div>
  );
};

export default MessageRow;
