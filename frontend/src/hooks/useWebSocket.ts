import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage } from '@/types';
import { getWsUrl } from '@/lib/config';

const WS_URL = getWsUrl();

export const useWebSocket = (token: string | null, onLogReceived?: (log: Record<string, unknown>) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const addMessage = useChatStore((state) => state.addMessage);

  const connect = useCallback(() => {
    if (!token || socketRef.current) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => {
      if (socketRef.current === ws) {
        console.log('WebSocket Connected');
        setIsConnected(true);
        setError(null);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: ChatMessage = JSON.parse(event.data);
        if (msg.type === 'CHAT') {
           addMessage(msg.sender_id, msg);
        } else if (msg.type === 'SYSTEM_LOG' && onLogReceived) {
           const logPayload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
           onLogReceived(logPayload as Record<string, unknown>);
        }
      } catch (_err) {
        console.error('Failed to parse WS message:', _err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket Error:', event);
      setError('Connection error');
    };

    ws.onclose = () => {
      if (socketRef.current === ws) {
        console.log('WebSocket Disconnected');
        setIsConnected(false);
        socketRef.current = null;
      }
    };
  }, [token, addMessage, onLogReceived]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      const socket = socketRef.current;
      socketRef.current = null; // Clear ref first to prevent race
      
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((targetId: number, payload: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const msg = {
        type: 'CHAT',
        target_id: targetId,
        payload: payload,
      };
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { isConnected, error, sendMessage };
};
