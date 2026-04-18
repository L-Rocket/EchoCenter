import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { buildChatScope, useChatStore } from '@/store/useChatStore';
import { getWsUrl } from '@/lib/config';
import type { User, JWTPayload, ChatMessage } from '@/types';
import { userService } from '@/services/userService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  isWsConnected: boolean;
  sendMessage: (targetId: number, payload: string, conversationId?: number) => void;
  sendAuthResponse: (actionId: string, approved: boolean, conversationId?: number) => void;
  wsLogs: Record<string, unknown>[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const WS_URL = getWsUrl();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [wsLogs, setWsLogs] = useState<Record<string, unknown>[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const addChatMessage = useChatStore((state) => state.addMessage);
  const appendStreamChunk = useChatStore((state) => state.appendStreamChunk);
  const setThinking = useChatStore((state) => state.setThinking);
  const setPending = useChatStore((state) => state.setPending);
  const clearPending = useChatStore((state) => state.clearPending);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const connectWs = useCallback((authToken: string) => {
    if (socketRef.current) return;

    const ws = new WebSocket(`${WS_URL}?token=${authToken}`);
    socketRef.current = ws;

    ws.onopen = () => {
      if (socketRef.current === ws) setIsWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ChatMessage;
        const currentUser = userRef.current;
        
        if (msg.type === 'SYSTEM_LOG') {
          const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
          setWsLogs((prev) => [payload as Record<string, unknown>, ...prev].slice(0, 50));
        } else if (msg.type === 'CHAT') {
          const peerId = msg.sender_id === currentUser?.id ? msg.target_id : msg.sender_id;
          if (peerId) {
            const scope = buildChatScope(peerId, msg.conversation_id);
            addChatMessage(scope, msg);
            useChatStore.getState().removeProcessMessages(scope);
            if (msg.sender_id !== currentUser?.id) {
              clearPending(scope);
            }
          }
          if (msg.sender_id !== currentUser?.id) {
            setThinking(false);
          }
        } else if (msg.type === 'CHAT_STREAM') {
          if (msg.sender_name === 'Butler' && typeof msg.payload === 'string' && msg.payload.includes('Execution started')) {
            const scope = buildChatScope(msg.sender_id, msg.conversation_id);
            addChatMessage(scope, {
              type: 'SYSTEM',
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              payload: {
                type: 'execution_start',
                message: msg.payload,
                stream_id: msg.stream_id
              },
              timestamp: msg.timestamp || new Date().toISOString(),
              conversation_id: msg.conversation_id,
            });
          } else {
            const peerId = msg.sender_id === currentUser?.id ? msg.target_id : msg.sender_id;
            if (peerId) {
              const scope = buildChatScope(peerId, msg.conversation_id);
              useChatStore.getState().removeProcessMessages(scope);
              appendStreamChunk(scope, {
                stream_id: msg.stream_id || 'unknown',
                payload: msg.payload as string,
                sender_id: msg.sender_id,
                sender_name: msg.sender_name,
                timestamp: msg.timestamp || new Date().toISOString(),
                conversation_id: msg.conversation_id,
              });
            }
          }
        } else if (msg.type === 'CHAT_STREAM_END') {
          const peerId = msg.sender_id === currentUser?.id ? msg.target_id : msg.sender_id;
          if (peerId && msg.sender_id !== currentUser?.id) {
            clearPending(buildChatScope(peerId, msg.conversation_id));
          }
          if (msg.sender_id !== currentUser?.id) {
            setThinking(false);
          }
        } else if (msg.type === 'AUTH_REQUEST') {
          const peerId = msg.sender_id;
          clearPending(buildChatScope(peerId, msg.conversation_id));
          setThinking(false); 
          addChatMessage(buildChatScope(peerId, msg.conversation_id), {
            ...msg,
            type: 'AUTH_REQUEST',
            payload: msg.payload, 
          });
        } else if (msg.type === 'AUTH_STATUS_UPDATE') {
          const payload = (typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload) as Record<string, unknown>;
          const actionId = payload.action_id as string;
          const status = payload.status as string;

          const { messagesByScope } = useChatStore.getState();
          Object.entries(messagesByScope).forEach(([scope, history]) => {
            const updatedMessages = history.map((message) => {
              if (message.type === 'AUTH_REQUEST' || message.type === 'SYSTEM') {
                try {
                  const parsed = (typeof message.payload === 'string' ? JSON.parse(message.payload) : message.payload) as Record<string, unknown>;
                  if (parsed.action_id === actionId) {
                    return { ...message, payload: { ...parsed, status } };
                  }
                } catch (_e) {
                  // ignore
                }
              }
              return message;
            });
            useChatStore.getState().setHistory(scope, updatedMessages);
          });
        }
      } catch (_err) {
        console.error('WS parse error:', _err);
      }
    };

    ws.onclose = () => {
      if (socketRef.current === ws) {
        setIsWsConnected(false);
        socketRef.current = null;
      }
    };
  }, [addChatMessage, appendStreamChunk, clearPending, setThinking]);

  useEffect(() => {
    const initAuth = () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (savedToken && savedUser) {
        try {
          const decoded = jwtDecode<JWTPayload>(savedToken);
          const currentTime = Date.now() / 1000;
          if (decoded.exp < currentTime) {
            handleLogout();
          } else {
            setToken(savedToken);
            setUser(JSON.parse(savedUser) as User);
            connectWs(savedToken);
          }
        } catch (_err) {
          handleLogout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, [handleLogout, connectWs]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    connectWs(newToken);
  };

  const sendMessage = (targetId: number, payload: string, conversationId?: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user) {
      setThinking(true);
      const scope = buildChatScope(targetId, conversationId);
      setPending(scope, true);

      const now = new Date();
      const localId = crypto.randomUUID();

      addChatMessage(scope, {
        local_id: localId,
        type: 'CHAT',
        sender_id: user.id,
        sender_name: user.username,
        target_id: targetId,
        payload: payload,
        timestamp: now.toISOString(),
        conversation_id: conversationId,
      });

      socketRef.current.send(JSON.stringify({
        local_id: localId,
        conversation_id: conversationId,
        type: 'CHAT',
        sender_id: user.id,
        sender_name: user.username,
        target_id: targetId,
        payload
      }));
    }
  };


  const sendAuthResponse = (actionId: string, approved: boolean, conversationId?: number) => {
    if (approved) setThinking(true);

    const butlerId = 2;
    const scope = buildChatScope(butlerId, conversationId);
    if (approved) {
      setPending(scope, true);
    }
    const currentMessages = useChatStore.getState().messagesByScope[scope] || [];
    
    const updatedMessages = currentMessages.map(msg => {
      if (msg.type === 'AUTH_REQUEST' || msg.type === 'SYSTEM') {
        try {
          const payload = (typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload) as Record<string, unknown>;
          if (payload.action_id === actionId) {
            payload.status = approved ? 'APPROVED' : 'REJECTED';
            return { ...msg, payload };
          }
        } catch (_e) {
          // Ignore parse errors
        }
      }
      return msg;
    });
    useChatStore.getState().setHistory(scope, updatedMessages);
    
    userService.sendAuthResponse(actionId, approved).catch(_err => {
      console.error('[AuthContext] Failed to send auth response:', _err);
      useChatStore.getState().clearPending(scope);
      const revertMessages = currentMessages.map(msg => {
        if (msg.type === 'AUTH_REQUEST' || msg.type === 'SYSTEM') {
          try {
            const payload = (typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload) as Record<string, unknown>;
            if (payload.action_id === actionId) {
              payload.status = 'PENDING';
              return { ...msg, payload };
            }
          } catch (_e) {
            // Ignore parse errors
          }
        }
        return msg;
      });
      useChatStore.getState().setHistory(scope, revertMessages);
    });
  };

  const isAuthenticated = !!token;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ 
      user, token, login, logout: handleLogout, isAuthenticated, isAdmin, isLoading,
      isWsConnected, sendMessage, sendAuthResponse, wsLogs
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
