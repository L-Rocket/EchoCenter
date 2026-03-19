import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { buildChatScope, useChatStore } from '@/store/useChatStore';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';
import type { Agent, ChatMessage, ConversationThread } from '@/types';
import AuthRequestCard from './AuthRequestCard';
import OpenHandsExecutionPanel from './OpenHandsExecutionPanel';
import ProcessMessage from './ProcessMessage';
import MarkdownRenderer from '@/components/chat/MarkdownRenderer';

interface ChatViewProps {
  agent: Agent;
  thread?: ConversationThread | null;
  renderAssistantAsMarkdown?: boolean;
  showRuntimePanel?: boolean;
}

const EMPTY_ARRAY: ChatMessage[] = [];

const ChatView: React.FC<ChatViewProps> = ({
  agent,
  thread = null,
  renderAssistantAsMarkdown = true,
  showRuntimePanel = false,
}) => {
  const [input, setInput] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const { user, sendMessage, sendAuthResponse } = useAuth();
  const { tx } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scope = buildChatScope(agent.id, thread?.id);
  const messages = useChatStore((state) => state.messagesByScope[scope] || EMPTY_ARRAY);
  const setHistory = useChatStore((state) => state.setHistory);
  const isPending = useChatStore((state) => Boolean(state.pendingByScope[scope]));

  useEffect(() => {
    const fetchHistory = async () => {
      if (!agent?.id) return;

      setIsHistoryLoading(true);
      try {
        const historyData = thread?.id
          ? await userService.getConversationMessages(thread.id)
          : await userService.getChatHistory(agent.id);
        const history = (Array.isArray(historyData) ? historyData : []).map((message) => ({
          ...message,
          type: message.type || 'CHAT',
          sender_name: message.sender_id === agent.id ? agent.username : (user?.username || tx('Me', '我')),
        }));
        setHistory(scope, history);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    void fetchHistory();
  }, [agent.id, agent.username, scope, setHistory, thread?.id, tx, user?.username]);

  useEffect(() => {
    if (scrollRef.current) {
      const timer = window.setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [messages.length, isPending]);

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !user || !agent?.id || isPending) return;
    sendMessage(agent.id, input.trim(), thread?.id);
    setInput('');
  };

  const isButlerChannel = (agent.role || '').toUpperCase() === 'BUTLER' || /butler/i.test(agent.username || '');

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-8 pt-10">
          {thread && (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
                <Sparkles className="h-3 w-3" />
                {thread.channel_kind === 'butler_direct' ? tx('Butler Thread', 'Butler 会话') : tx('Agent Thread', 'Agent 会话')}
              </div>
              <h1 className="text-3xl font-black tracking-tight">{thread.title || tx('Untitled Conversation', '未命名会话')}</h1>
              {thread.summary && (
                <p className="max-w-3xl text-sm text-muted-foreground">{thread.summary}</p>
              )}
            </div>
          )}

          {isHistoryLoading && messages.length === 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {tx('Loading conversation history...', '正在加载会话历史...')}
            </div>
          )}

          {!isHistoryLoading && messages.length === 0 && !isPending && (
            <div className="rounded-[28px] border border-dashed border-border/70 bg-muted/10 px-8 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-background text-muted-foreground">
                <Terminal className="h-7 w-7" />
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                {tx('Fresh Session', '全新会话')}
              </div>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                {tx('Start typing to turn this empty workspace into a new conversation.', '开始输入，把这个空白工作区变成新的对话。')}
              </p>
            </div>
          )}

          {showRuntimePanel && isButlerChannel && (
            <OpenHandsExecutionPanel messages={messages} isPeerPending={isPending} />
          )}

          {messages.map((message, index) => {
            const isMe = message.sender_id === user?.id;
            const isSystem = message.type === 'SYSTEM';
            const isAuthRequest = message.type === 'AUTH_REQUEST';
            const isAuthResponse = message.type === 'AUTH_RESPONSE';

            let payload = message.payload;
            if ((isSystem || isAuthRequest || isAuthResponse) && typeof payload === 'string') {
              try {
                payload = JSON.parse(payload);
              } catch (_e) {
                console.error('Failed to parse message payload', _e);
              }
            }

            if (isAuthRequest && typeof payload === 'object' && payload !== null && 'action_id' in payload) {
              const parsed = payload as Record<string, unknown>;
              const normalizedStatus = String(parsed.status || 'PENDING').toUpperCase();
              if (normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED') {
                return (
                  <ProcessMessage
                    key={message.id || index}
                    type={message.type}
                    payload={parsed}
                    timestamp={message.timestamp}
                    status={normalizedStatus}
                  />
                );
              }
              return (
                <div key={message.id || index} className="flex justify-start">
                  <AuthRequestCard
                    actionId={parsed.action_id as string}
                    conversationId={message.conversation_id}
                    targetAgentName={parsed.target_agent_name as string}
                    command={parsed.command as string}
                    reason={parsed.reason as string}
                    onApprove={(actionId, conversationId) => sendAuthResponse(actionId, true, conversationId)}
                    onReject={(actionId, conversationId) => sendAuthResponse(actionId, false, conversationId)}
                    status={normalizedStatus as 'PENDING' | 'APPROVED' | 'REJECTED'}
                  />
                </div>
              );
            }

            if (isAuthResponse || isSystem) {
              return (
                <ProcessMessage
                  key={message.id || index}
                  type={message.type}
                  payload={payload as Record<string, unknown>}
                  timestamp={message.timestamp}
                  status={(payload as Record<string, unknown>)?.status as string}
                />
              );
            }

            const renderContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
            if (!renderContent || renderContent.trim() === '' || renderContent === '{}') {
              return null;
            }

            if (isMe) {
              return (
                <div key={message.id || index} className="flex justify-end">
                  <div className="max-w-2xl rounded-2xl bg-primary/10 px-4 py-3 text-sm text-foreground shadow-sm ring-1 ring-primary/10">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary/80">
                      {tx('You', '你')}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{renderContent}</div>
                  </div>
                </div>
              );
            }

            return (
              <article key={message.id || index} className="space-y-3 border-b border-border/50 pb-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                    {message.sender_name || agent.username}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : tx('Pending', '待发送')}
                  </div>
                </div>
                {renderAssistantAsMarkdown ? (
                  <MarkdownRenderer content={renderContent} />
                ) : (
                  <div className={cn('whitespace-pre-wrap break-words text-[15px] leading-8 text-foreground/92')}>
                    {renderContent}
                  </div>
                )}
              </article>
            );
          })}

          {isPending && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">
                  {tx('Assistant is working', '助手正在处理')}
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-[progress_2s_ease-in-out_infinite] rounded-full bg-primary shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t bg-background/95 backdrop-blur">
        <form onSubmit={handleSend} className="mx-auto flex w-full max-w-5xl items-center gap-3 px-6 py-4">
          <Input
            placeholder={isPending
              ? tx('Wait for the current reply to finish...', '请等待当前回复完成...')
              : tx(`Message ${agent.username}...`, `向 ${agent.username} 发送消息...`)}
            className="h-12 rounded-2xl border-2 bg-muted/40 px-4 text-sm focus:bg-background"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground shadow-lg"
            disabled={isPending || !input.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
