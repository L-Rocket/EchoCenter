import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useChatStore } from '@/store/useChatStore';

interface User {
  id: number;
  username: string;
  role: string;
}

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
  wsLogs: any[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const getWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host;
  if (window.location.port === '5173' || window.location.port === '3000') {
    return `${protocol}//localhost:8080/api/ws`;
  }
  return `${protocol}//${host}/api/ws`;
};

const getApiUrl = (path: string) => {
  const host = window.location.hostname === 'localhost' ? 'http://localhost:8080' : window.location.origin;
  if (window.location.port === '5173' || window.location.port === '3000') {
    return `http://localhost:8080${path}`;
  }
  return `${host}${path}`;
};

const WS_URL = getWsUrl();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [wsLogs, setWsLogs] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const addChatMessage = useChatStore((state) => state.addMessage);
  const appendStreamChunk = useChatStore((state) => state.appendStreamChunk);
  const setThinking = useChatStore((state) => state.setThinking);

  // Sync ref with state
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
        const msg = JSON.parse(event.data);
        const currentUser = userRef.current;
        
        if (msg.type === 'SYSTEM_LOG') {
          setWsLogs((prev) => [msg.payload, ...prev].slice(0, 50));
        } else if (msg.type === 'CHAT') {
          // Determine peerId: if I'm the sender, it's target_id. Otherwise it's sender_id.
          const peerId = msg.sender_id === currentUser?.id ? msg.target_id : msg.sender_id;
          if (peerId) {
            addChatMessage(peerId, msg);
            // Remove process messages (like "Execution started...") when actual reply arrives
            useChatStore.getState().removeProcessMessages(peerId);
          }
          // Stop thinking when a full chat message arrives (not a stream)
          setThinking(false);
        } else if (msg.type === 'CHAT_STREAM') {
          // Check if this is a process message from Butler (e.g., "Execution started...")
          console.log('[WS] CHAT_STREAM from', msg.sender_id, 'payload:', msg.payload?.substring(0, 50));
          if (msg.sender_role === 'BUTLER' && msg.payload && msg.payload.includes('Execution started')) {
            // This is a process message, add as SYSTEM type for folding
            console.log('[WS] Adding execution_start process message');
            addChatMessage(msg.sender_id, {
              type: 'SYSTEM',
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              payload: JSON.stringify({
                type: 'execution_start',
                message: msg.payload,
                stream_id: msg.stream_id
              }),
              timestamp: msg.timestamp || new Date().toISOString(),
            });
          } else {
            const peerId = msg.sender_id === currentUser?.id ? msg.target_id : msg.sender_id;
            if (peerId) {
              // Remove process messages when actual content starts streaming
              console.log('[WS] Removing process messages for peer', peerId);
              useChatStore.getState().removeProcessMessages(peerId);
              appendStreamChunk(peerId, {
                stream_id: msg.stream_id,
                payload: msg.payload,
                sender_id: msg.sender_id,
                sender_name: msg.sender_name,
                timestamp: msg.timestamp || new Date().toISOString()
              });
            }
          }
        } else if (msg.type === 'CHAT_STREAM_END') {
          setThinking(false);
          console.log('Stream finished:', msg.stream_id);
        } else if (msg.type === 'AUTH_REQUEST') {
          setThinking(false); // Stop when waiting for user input
          addChatMessage(msg.sender_id, {
            ...msg,
            type: 'AUTH_REQUEST',
            payload: msg.payload, // This is the AuthRequest object
          });
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      if (socketRef.current === ws) {
        setIsWsConnected(false);
        socketRef.current = null;
      }
    };
  }, [addChatMessage]);

  useEffect(() => {
    const initAuth = () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (savedToken && savedUser) {
        try {
          const decoded: any = jwtDecode(savedToken);
          const currentTime = Date.now() / 1000;
          if (decoded.exp < currentTime) {
            handleLogout();
          } else {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            connectWs(savedToken);
          }
        } catch (err) {
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
      
      // Add message to local store immediately for better UX
      const now = new Date();
      addChatMessage(targetId, {
        type: 'CHAT',
        sender_id: user.id,
        sender_name: user.username,
        target_id: targetId,
        payload: payload,
        timestamp: now.toISOString(),
      });
      
      socketRef.current.send(JSON.stringify({
        type: 'CHAT',
        sender_id: user.id,
        sender_name: user.username,
        target_id: targetId,
        payload
      }));
    }
  };

  const sendAuthResponse = (actionId: string, approved: boolean) => {
    console.log('[AuthContext] sendAuthResponse called:', { actionId, approved });
    if (approved) setThinking(true);
    
    // Optimistic UI update: Immediately update the auth request status locally
    // The Butler is ID 2
    const butlerId = 2;
    const currentMessages = useChatStore.getState().messages[butlerId] || [];
    console.log('[AuthContext] Current messages count:', currentMessages.length);
    
    const updatedMessages = currentMessages.map(msg => {
      // Check both AUTH_REQUEST type and legacy SYSTEM type
      if (msg.type === 'AUTH_REQUEST' || msg.type === 'SYSTEM') {
        try {
          const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
          if (payload.action_id === actionId) {
            console.log('[AuthContext] Found matching message, updating status to:', approved ? 'APPROVED' : 'REJECTED');
            payload.status = approved ? 'APPROVED' : 'REJECTED';
            return { ...msg, payload: JSON.stringify(payload) };
          }
        } catch (e) {
          // Ignore parse errors for non-auth messages
        }
      }
      return msg;
    });
    useChatStore.getState().setHistory(butlerId, updatedMessages);
    
    // Send to server
    console.log('[AuthContext] Sending to server...');
    import('axios').then(axios => {
      const token = localStorage.getItem('token');
      axios.default.post(getApiUrl('/api/chat/auth/response'), {
        action_id: actionId,
        approved
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).then(() => {
        console.log('[AuthContext] Server response success');
      }).catch(err => {
        console.error('[AuthContext] Failed to send auth response:', err);
        // Revert on error
        const revertMessages = currentMessages.map(msg => {
          if (msg.type === 'AUTH_REQUEST' || msg.type === 'SYSTEM') {
            try {
              const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
              if (payload.action_id === actionId) {
                payload.status = 'PENDING';
                return { ...msg, payload: JSON.stringify(payload) };
              }
            } catch (e) {
              // Ignore parse errors during revert
            }
          }
          return msg;
        });
        useChatStore.getState().setHistory(butlerId, revertMessages);
      });
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
