import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Terminal, Shield, Loader2, XCircle } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import type { Agent } from '@/types';
import AuthRequestCard from './AuthRequestCard';
import ProcessMessage from './ProcessMessage';
import { userService } from '@/services/userService';
import type { ChatMessage } from '@/types';

interface ChatViewProps {
  agent: Agent;
}

const EMPTY_ARRAY: ChatMessage[] = [];

const ChatView: React.FC<ChatViewProps> = ({ agent }) => {
  const [input, setInput] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  const messages = useChatStore((state) => {
    if (!agent?.id || !state.messages) return EMPTY_ARRAY;
    const list = state.messages[agent.id];
    return Array.isArray(list) ? list : EMPTY_ARRAY;
  });

  const setHistory = useChatStore((state) => state.setHistory);
  
  const { user, sendMessage, sendAuthResponse } = useAuth();
  const isThinking = useChatStore((state) => state.isThinking);
  const setThinking = useChatStore((state) => state.setThinking);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!agent?.id) return;
      
      setIsHistoryLoading(true);
      try {
        const historyData = await userService.getChatHistory(agent.id);
        const history = historyData.map((m) => ({
          ...m,
          type: m.type || 'CHAT',
          sender_name: m.sender_id === agent.id ? agent.username : (user?.username || 'Me')
        }));
        setHistory(agent.id, history);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [agent.id, agent.username, setHistory, user?.username]);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const handleSend = (_e: React.FormEvent) => {
    _e.preventDefault();
    if (!input.trim() || !user || !agent?.id) return;
    sendMessage(agent.id, input);
    setInput('');
  };

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
        Transmission channel lost.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card animate-in fade-in duration-500">
      <header className="h-16 border-b flex items-center justify-between px-6 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl text-primary border border-primary/20 shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">{agent.username}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Autonomous Unit</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-muted border text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
            <Shield className="h-3 w-3" />
            Encrypted Link
          </div>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto bg-muted/20 p-4">
        <div className="flex flex-col space-y-4">
          {isHistoryLoading && messages.length === 0 && (
            <div className="flex justify-center py-10">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hydrating History...</span>
              </div>
            </div>
          )}

          {!isHistoryLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Terminal className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Awaiting Transmission</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id;
            const isSystem = msg.type === 'SYSTEM';
            const isAuthRequest = msg.type === 'AUTH_REQUEST';
            const isAuthResponse = msg.type === 'AUTH_RESPONSE';
            
            let payload = msg.payload;
            if ((isSystem || isAuthRequest || isAuthResponse) && typeof payload === 'string') {
              try {
                payload = JSON.parse(payload);
              } catch (_e) {
                console.error("Failed to parse message payload", _e);
              }
            }

            if (isAuthRequest && typeof payload === 'object' && payload !== null && 'action_id' in payload) {
              const p = payload as Record<string, unknown>;
              if (p.status === 'APPROVED' || p.status === 'REJECTED') {
                return (
                  <ProcessMessage
                    key={msg.id || i}
                    type={msg.type}
                    payload={p}
                    timestamp={msg.timestamp}
                    status={p.status as string}
                  />
                );
              }
              return (
                <div key={msg.id || i} className="flex justify-start">
                  <div className="my-1">
                    <AuthRequestCard
                      actionId={p.action_id as string}
                      targetAgentName={p.target_agent_name as string}
                      command={p.command as string}
                      reason={p.reason as string}
                      onApprove={(id) => sendAuthResponse(id, true)}
                      onReject={(id) => sendAuthResponse(id, false)}
                      status={(p.status as string) || 'PENDING'}
                    />
                  </div>
                </div>
              );
            }

            if (isAuthResponse || isSystem) {
              const p = payload as Record<string, unknown>;
              return (
                <ProcessMessage
                  key={msg.id || i}
                  type={msg.type}
                  payload={p}
                  timestamp={msg.timestamp}
                  status={p?.status as string}
                />
              );
            }

            return (
              <div key={msg.id || i} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "flex flex-col max-w-[85%] md:max-w-[80%]",
                  isMe ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm shadow-sm border",
                    isMe 
                      ? "bg-indigo-600 text-white border-indigo-500 rounded-tr-none" 
                      : "bg-card text-card-foreground border rounded-tl-none"
                  )}>
                    {typeof payload === 'string' ? payload : JSON.stringify(payload)}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1 px-1 font-bold uppercase tracking-tighter">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div className="flex justify-start pt-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex flex-col gap-2 w-full max-w-[240px]">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Processing</span>
                  </div>
                  <button 
                    onClick={() => setThinking(false)}
                    className="group flex items-center gap-1 hover:bg-destructive/10 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <span className="text-[8px] font-bold text-muted-foreground group-hover:text-destructive uppercase">Abort</span>
                    <XCircle className="h-2.5 w-2.5 text-muted-foreground group-hover:text-destructive" />
                  </button>
                </div>
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-1/3 animate-[progress_2s_ease-in-out_infinite] rounded-full shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      <footer className="p-4 border-t bg-card shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="relative flex-grow">
            <Input
              placeholder={`Send instruction to ${agent.username}...`}
              className="h-12 bg-muted/50 border focus:bg-background focus:ring-primary transition-all pr-12 rounded-xl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="absolute right-3 top-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
              ENTER
            </div>
          </div>
          <Button 
            type="submit" 
            size="icon" 
            className="h-12 w-12 shrink-0 shadow-lg rounded-xl transition-all active:scale-95 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default ChatView;
