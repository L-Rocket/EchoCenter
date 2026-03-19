import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useChatStore } from '@/store/useChatStore';
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
  sendMessage: (targetId: number, payload: string) => void;
  sendAuthResponse: (actionId: string, approved: boolean) => void;
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
  const setPeerPending = useChatStore((state) => state.setPeerPending);
  const clearPeerPending = useChatStore((state) => state.clearPeerPending);

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
            addChatMessage(peerId, msg);
            useChatStore.getState().removeProcessMessages(peerId);
            if (msg.sender_id !== currentUser?.id) {
              clearPeerPending(peerId);
            }
          }
          if (msg.sender_id !== currentUser?.id) {
            setThinking(false);
          }
        } else if (msg.type === 'CHAT_STREAM') {
          if (msg.sender_name === 'Butler' && typeof msg.payload === 'string' && msg.payload.includes('Execution started')) {
            addChatMessage(msg.sender_id, {
              type: 'SYSTEM',
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              payload: {
                type: 'execution_start',
                message: msg.payload,
                stream_id: msg.stream_id
              },
              timestamp: msg.timestamp || new Date().toISOString(),
            });
          } else {
            const peerId = msg.sender_id === currentUser?.id ? msg.target_id : msg.sender_id;
            if (peerId) {
              useChatStore.getState().removeProcessMessages(peerId);
              appendStreamChunk(peerId, {
                stream_id: msg.stream_id || 'unknown',
                payload: msg.payload as string,
                sender_id: msg.sender_id,
                sender_name: msg.sender_name,
                timestamp: msg.timestamp || new Date().toISOString()
              });
            }
          }
        } else if (msg.type === 'CHAT_STREAM_END') {
          const peerId = msg.sender_id === currentUser?.id ? msg.target_id : msg.sender_id;
          if (peerId && msg.sender_id !== currentUser?.id) {
            clearPeerPending(peerId);
          }
          if (msg.sender_id !== currentUser?.id) {
            setThinking(false);
          }
        } else if (msg.type === 'AUTH_REQUEST') {
          const peerId = msg.sender_id;
          clearPeerPending(peerId);
          setThinking(false); 
          addChatMessage(msg.sender_id, {
            ...msg,
            type: 'AUTH_REQUEST',
            payload: msg.payload, 
          });
        } else if (msg.type === 'AUTH_STATUS_UPDATE') {
          const payload = (typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload) as Record<string, unknown>;
          const actionId = payload.action_id as string;
          const status = payload.status as string;
          
          const butlerId = 2;
          const currentMessages = useChatStore.getState().messages[butlerId] || [];
          const updatedMessages = currentMessages.map(m => {
            if (m.type === 'AUTH_REQUEST' || m.type === 'SYSTEM') {
              try {
                const p = (typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload) as Record<string, unknown>;
                if (p.action_id === actionId) {
                  return { ...m, payload: { ...p, status } };
                }
              } catch (_e) {
                // Ignore
              }
            }
            return m;
          });
          useChatStore.getState().setHistory(butlerId, updatedMessages);
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
  }, [addChatMessage, appendStreamChunk, clearPeerPending, setThinking]);

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

  const sendMessage = (targetId: number, payload: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user) {
      setThinking(true);
      setPeerPending(targetId, true);

      const now = new Date();
      const localId = crypto.randomUUID();

      addChatMessage(targetId, {
        local_id: localId,
        type: 'CHAT',
        sender_id: user.id,
        sender_name: user.username,
        target_id: targetId,
        payload: payload,
        timestamp: now.toISOString(),
      });

      socketRef.current.send(JSON.stringify({
        local_id: localId,
        type: 'CHAT',
        sender_id: user.id,
        sender_name: user.username,
        target_id: targetId,
        payload
      }));
    }
  };


  const sendAuthResponse = (actionId: string, approved: boolean) => {
    if (approved) setThinking(true);
    
    const butlerId = 2;
    if (approved) {
      setPeerPending(butlerId, true);
    }
    const currentMessages = useChatStore.getState().messages[butlerId] || [];
    
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
    useChatStore.getState().setHistory(butlerId, updatedMessages);
    
    userService.sendAuthResponse(actionId, approved).catch(_err => {
      console.error('[AuthContext] Failed to send auth response:', _err);
      useChatStore.getState().clearPeerPending(butlerId);
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
      useChatStore.getState().setHistory(butlerId, revertMessages);
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
