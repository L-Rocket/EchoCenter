import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Terminal, Shield, Loader2, XCircle } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import type { Agent } from './AgentList';
import AuthRequestCard from './AuthRequestCard';

interface ChatViewProps {
  agent: Agent;
}

const EMPTY_ARRAY: any[] = [];
const API_BASE_URL = 'http://localhost:8080';

const ChatView: React.FC<ChatViewProps> = ({ agent }) => {
  const [input, setInput] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // High-safety store access with stable reference
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

  // Fetch History on mount or agent change
  useEffect(() => {
    const fetchHistory = async () => {
      if (!agent?.id) return;
      
      setIsHistoryLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/chat/history/${agent.id}`);
        // Add required fields for frontend ChatMessage if backend doesn't provide them
        // The backend returns models.ChatMessage which has payload, timestamp, etc.
        const history = response.data.map((m: any) => ({
          ...m,
          type: 'CHAT',
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
  }, [agent.id, setHistory, user?.username]);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      // Small delay to ensure render is complete
      const timer = setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !agent?.id) return;
    sendMessage(agent.id, input);
    setInput('');
  };

  // Final render guard
  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 text-slate-400 text-sm italic">
        Transmission channel lost.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-500">
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600 border border-indigo-100 shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{agent.username}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Autonomous Unit</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            <Shield className="h-3 w-3" />
            Encrypted Link
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto bg-slate-50/20 p-4">
        <div className="flex flex-col space-y-4">
          {isHistoryLoading && messages.length === 0 && (
            <div className="flex justify-center py-10">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hydrating History...</span>
              </div>
            </div>
          )}

          {!isHistoryLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <div className="p-4 bg-slate-100 rounded-full mb-4">
                <Terminal className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Awaiting Transmission</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id;
            const isSystem = msg.type === 'SYSTEM';
            
            // Parse payload if it's a string (from API history)
            let payload = msg.payload;
            if (isSystem && typeof payload === 'string') {
              try {
                payload = JSON.parse(payload);
              } catch (e) {
                console.error("Failed to parse system message payload", e);
              }
            }

            return (
              <div key={msg.id || i} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "flex flex-col max-w-[85%] md:max-w-[80%]",
                  isMe ? "items-end" : "items-start"
                )}>
                  {isSystem && typeof payload === 'object' ? (
                    <div className="my-1">
                      <AuthRequestCard
                        actionId={(payload as any).action_id}
                        targetAgentName={(payload as any).target_agent_name}
                        command={(payload as any).command}
                        reason={(payload as any).reason}
                        onApprove={(id) => sendAuthResponse(id, true)}
                        onReject={(id) => sendAuthResponse(id, false)}
                        status={(payload as any).status || 'PENDING'}
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm shadow-sm border",
                      isMe 
                        ? "bg-indigo-600 text-white border-indigo-500 rounded-tr-none" 
                        : "bg-white text-slate-700 border-slate-100 rounded-tl-none"
                    )}>
                      {typeof payload === 'string' ? payload : JSON.stringify(payload)}
                    </div>
                  )}
                  <span className="text-[9px] text-slate-400 mt-1 px-1 font-bold uppercase tracking-tighter">
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
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Processing</span>
                  </div>
                  <button 
                    onClick={() => setThinking(false)}
                    className="group flex items-center gap-1 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <span className="text-[8px] font-bold text-slate-400 group-hover:text-red-500 uppercase">Abort</span>
                    <XCircle className="h-2.5 w-2.5 text-slate-300 group-hover:text-red-400" />
                  </button>
                </div>
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 w-1/3 animate-[progress_2s_ease-in-out_infinite] rounded-full shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input */}
      <footer className="p-4 border-t bg-white shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="relative flex-grow">
            <Input
              placeholder={`Send instruction to ${agent.username}...`}
              className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-indigo-500 transition-all pr-12 rounded-xl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="absolute right-3 top-3.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest hidden sm:block">
              ENTER
            </div>
          </div>
          <Button 
            type="submit" 
            size="icon" 
            className="h-12 w-12 shrink-0 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl transition-all active:scale-95"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default ChatView;
