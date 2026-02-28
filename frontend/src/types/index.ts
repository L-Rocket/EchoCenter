export const TYPES_VERSION = '1.0.0';

export interface User {
  id: number;
  username: string;
  role: string;
  created_at?: string;
}

export interface Agent extends User {
  status?: string;
  last_report?: string;
}

export interface ChatMessage {
  id?: number;
  type: 'CHAT' | 'SYSTEM' | 'SYSTEM_LOG' | 'AUTH_REQUEST' | 'AUTH_RESPONSE';
  sender_id: number;
  sender_name: string;
  target_id?: number;
  payload: string | Record<string, unknown>;
  timestamp: string;
  stream_id?: string;
}

export interface AuthRequestPayload {
  action_id: string;
  target_agent_name?: string;
  target_agent_id?: number;
  command: string;
  reason?: string;
  status?: string;
}

export interface AuthResponsePayload {
  action_id: string;
  approved: boolean;
  status?: string;
}

export interface JWTPayload {
  exp: number;
  [key: string]: unknown;
}

export interface LogMessage {
  id: number;
  agent_id: string;
  level: string;
  content: string;
  timestamp: string;
}
