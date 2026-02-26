import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import type { Agent } from './AgentList';

interface ChatViewProps {
  agent: Agent;
}

const EMPTY_ARRAY: any[] = [];

const ChatView: React.FC<ChatViewProps> = ({ agent }) => {
  const [input, setInput] = useState('');
  
  // High-safety store access with stable reference
  const messages = useChatStore((state) => {
    if (!agent?.id || !state.messages) return EMPTY_ARRAY;
    const list = state.messages[agent.id];
    return Array.isArray(list) ? list : EMPTY_ARRAY;
  });
  
  const { user, sendMessage } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !agent?.id) return;
    sendMessage(agent.id, input);
    setInput('');
  };

  // Final render guard
  if (!agent) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{agent.username}</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-6 bg-slate-50/30">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={i} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div className={cn("rounded-lg px-4 py-2 text-sm border shadow-sm", isMe ? "bg-indigo-600 text-white" : "bg-white text-slate-700")}>
                  {typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input */}
      <footer className="p-4 border-t bg-white">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3">
          <Input
            placeholder="Type a message..."
            className="flex-grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" size="icon" className="bg-indigo-600">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default ChatView;
