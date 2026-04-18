import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Terminal } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { buildChatScope, useChatStore } from '@/store/useChatStore';
import type { Agent, ChatMessage, ConversationThread } from '@/types';
import AuthRequestCard from './AuthRequestCard';
import OpenHandsLiveRunCard from './OpenHandsLiveRunCard';
import ProcessMessage from './ProcessMessage';
import MarkdownRenderer from '@/components/chat/MarkdownRenderer';
import { ThinkingChip } from '@/components/v3/ThinkingChip';

interface ChatViewProps {
  agent: Agent;
  thread?: ConversationThread | null;
  renderAssistantAsMarkdown?: boolean;
}

const EMPTY_ARRAY: ChatMessage[] = [];

const ChatView: React.FC<ChatViewProps> = ({
  agent,
  thread = null,
  renderAssistantAsMarkdown = true,
}) => {
  const [input, setInput] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const { user, sendMessage, sendAuthResponse } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isOpenHandsOperator = agent.agent_kind === 'openhands_ops' || agent.runtime_kind === 'openhands';

  const scope = buildChatScope(agent.id, thread?.id);
  const messages = useChatStore((state) => state.messagesByScope[scope] || EMPTY_ARRAY);
  const setHistory = useChatStore((state) => state.setHistory);
  const isPending = useChatStore((state) => Boolean(state.pendingByScope[scope]));

  const meInitials = (user?.username || 'me')
    .split(/[-\s_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || 'ME';

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
          sender_name: message.sender_id === agent.id ? agent.username : (user?.username || 'Me'),
        }));
        setHistory(scope, history);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsHistoryLoading(false);
      }
    };
    void fetchHistory();
  }, [agent.id, agent.username, scope, setHistory, thread?.id, user?.username]);

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

  const isButler = (agent.role || '').toUpperCase() === 'BUTLER' || (agent.username || '').toLowerCase() === 'butler';

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column', background: 'var(--bg-sunken)' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 8px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {thread ? (
            <div style={{ paddingBottom: 18, borderBottom: '1px solid var(--border-faint)', textAlign: 'center' }}>
              <div className="eyebrow">
                {thread.channel_kind === 'butler_direct' ? 'Butler Thread' : 'Agent Thread'}
              </div>
              <h2 className="h2-display" style={{ margin: '8px 0 0' }}>
                {thread.title || 'Untitled Conversation'}
              </h2>
              {thread.summary ? (
                <p style={{ fontSize: 13, color: 'var(--fg-muted)', maxWidth: 560, margin: '8px auto 0', lineHeight: 1.55 }}>
                  {thread.summary}
                </p>
              ) : null}
            </div>
          ) : null}

          {isHistoryLoading && messages.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: 'var(--fg-dim)', fontSize: 13 }}>
              <ThinkingChip label="Loading conversation" />
            </div>
          ) : null}

          {!isHistoryLoading && messages.length === 0 && !isPending ? (
            <div
              className="v3-card"
              style={{
                padding: '40px 32px',
                textAlign: 'center',
                borderStyle: 'dashed',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 14px',
                  borderRadius: 14,
                  background: 'var(--bg-sunken)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--fg-muted)',
                }}
              >
                <Terminal size={22} />
              </div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Fresh Session</div>
              <p style={{ fontSize: 13, color: 'var(--fg-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.55 }}>
                Start typing below to turn this empty workspace into a new conversation.
              </p>
            </div>
          ) : null}

          {isOpenHandsOperator ? <OpenHandsLiveRunCard active={isPending} /> : null}

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
                <div key={message.id || index} className="v3-msg-group">
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

            return (
              <div
                key={message.id || index}
                className={`v3-msg-group ${isMe ? 'mine' : ''}`}
              >
                <div className={`v3-msg-ava ${isMe ? 'me' : isButler ? 'butler' : ''}`}>
                  {isMe ? meInitials : isButler ? <Sparkles size={12} /> : (agent.username || '??').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="v3-msg-meta" style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <span className="who">{isMe ? 'You' : (message.sender_name || agent.username)}</span>
                    <span className="at">
                      {message.timestamp
                        ? new Date(message.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })
                        : 'Pending'}
                    </span>
                  </div>
                  <div className="v3-msg-bubble">
                    {renderAssistantAsMarkdown && !isMe ? (
                      <MarkdownRenderer content={renderContent} />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderContent}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isPending ? (
            <div className="v3-msg-group">
              <div className={`v3-msg-ava ${isButler ? 'butler' : ''}`}>
                {isButler ? <Sparkles size={12} /> : (agent.username || '??').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="v3-msg-meta">
                  <span className="who">{agent.username}</span>
                  <span className="at">working</span>
                </div>
                <ThinkingChip />
              </div>
            </div>
          ) : null}

          <div ref={scrollRef} />
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-faint)',
          padding: '14px 20px 18px',
          background: 'color-mix(in oklab, var(--bg) 60%, transparent)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <form
          onSubmit={handleSend}
          style={{
            maxWidth: 900,
            margin: '0 auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-faint)',
            borderRadius: 14,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'border-color 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <input
            placeholder={
              isPending
                ? 'Wait for the current reply to finish…'
                : `Message ${agent.username}…`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isPending}
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              fontSize: 14,
              color: 'var(--fg)',
              padding: '6px 6px',
            }}
          />
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            aria-label="Send"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: 'var(--accent-hue)',
              color: 'var(--accent-ink)',
              border: 0,
              cursor: isPending || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: isPending || !input.trim() ? 0.5 : 1,
              fontSize: 13,
              fontWeight: 500,
              boxShadow: '0 0 0 1px var(--accent-glow), 0 8px 28px -10px var(--accent-glow)',
            }}
          >
            <Send size={13} /> Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
