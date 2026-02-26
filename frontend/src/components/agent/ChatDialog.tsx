import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, X } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface ChatDialogProps {
  agentId: number;
  agentName: string;
  onClose: () => void;
  sendMessage: (targetId: number, payload: string) => void;
}

const ChatDialog: React.FC<ChatDialogProps> = ({ agentId, agentName, onClose, sendMessage }) => {
  const [input, setInput] = useState('');
  const messages = useChatStore((state) => state.messages[agentId] || []);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    sendMessage(agentId, input);
    
    // Locally add our own message for instant feedback
    // The server might also broadcast it back, but let's see.
    // If server broadcasts back, we get it twice if we add it here.
    // Spec says SC-002: message delivery within 200ms. 
    // I'll wait for server broadcast to avoid duplicates.
    
    setInput('');
  };

  return (
    <Card className="fixed bottom-4 right-4 w-[400px] h-[500px] flex flex-col shadow-2xl border-slate-200 z-[100] animate-in slide-in-from-right-4 duration-300">
      <CardHeader className="p-4 bg-indigo-600 text-white rounded-t-xl flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold tracking-tight">{agentName}</CardTitle>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-100">Live Connection</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="flex-grow p-0 overflow-hidden bg-slate-50">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {(messages || []).length === 0 && (
              <div className="text-center py-12">
                <p className="text-xs font-medium text-slate-400 italic">Initiating secure link with {agentName}...</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={i} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm border",
                    isMe 
                      ? "bg-indigo-600 text-white border-indigo-500 rounded-tr-none" 
                      : "bg-white text-slate-700 border-slate-100 rounded-tl-none"
                  )}>
                    {typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown Time'}
                  </span>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="p-4 border-t bg-white rounded-b-xl">
        <form onSubmit={handleSend} className="flex w-full items-center gap-2">
          <Input
            placeholder="Relay command..."
            className="flex-grow h-10 bg-slate-50 border-slate-200"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatDialog;
