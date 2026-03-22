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
  agent_kind?: string;
  runtime_kind?: string;
  description?: string;
}

export interface SSHKey {
  id: number;
  name: string;
  public_key?: string;
  private_key?: string;
  has_private_key?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InfraNode {
  id: number;
  name: string;
  host: string;
  port: number;
  ssh_user: string;
  ssh_key_id: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InfraNodeTestResult {
  node_id: number;
  ok: boolean;
  message: string;
  round_trip_ms: number;
  checked_at_utc?: string;
}

export interface OpenHandsStatus {
  enabled: boolean;
  service_url?: string;
  worker_reachable: boolean;
  worker_mode?: string;
  managed_agent_id?: number;
  managed_agent_name?: string;
  node_count: number;
  ssh_key_count: number;
}

export interface OpenHandsTaskRecord {
  id: string;
  task: string;
  reasoning?: string;
  status?: string;
  current_step?: string;
  live_output?: string;
  success: boolean;
  summary?: string;
  error?: string;
  worker_mode?: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  updated_at?: string;
}

export interface ConversationThread {
  id: number;
  owner_user_id: number;
  peer_user_id: number;
  channel_kind: 'butler_direct' | 'agent_direct' | 'butler_agent_monitor' | string;
  title: string;
  summary?: string;
  is_pinned: boolean;
  is_default: boolean;
  archived_at?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id?: number;
  local_id?: string;
  conversation_id?: number;
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
