export const TYPES_VERSION = '1.0.0';

export interface User {
  id: number;
  username: string;
  role: string;
  api_token?: string;
  created_at?: string;
}

export interface Agent extends User {
  status?: string;
  last_report?: string;
  online?: boolean;
  last_seen_at?: string;
  token_hint?: string;
  token_updated_at?: string;
}

export interface ChatMessage {
  id?: number;
  local_id?: string;
  type: 'CHAT' | 'SYSTEM' | 'SYSTEM_LOG' | 'AUTH_REQUEST' | 'AUTH_RESPONSE' | 'CHAT_STREAM' | 'CHAT_STREAM_END' | 'AUTH_STATUS_UPDATE';
  sender_id: number;
  sender_name: string;
  sender_role?: string;
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
