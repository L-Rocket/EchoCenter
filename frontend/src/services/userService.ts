import api from './api';
import type { User, Agent, ChatMessage, SSHKey, InfraNode, OpenHandsStatus } from '@/types';

export const userService = {
  getUsers: async () => {
    const response = await api.get<User[]>('/api/users');
    return response.data;
  },
  
  getAgents: async () => {
    const response = await api.get<Agent[]>('/api/users/agents');
    return response.data;
  },
  
  createAgent: async (input: { username: string; apiToken?: string; agentKind?: string; runtimeKind?: string; description?: string }) => {
    const payload: Record<string, unknown> = { username: input.username };
    if (input.apiToken) payload.api_token = input.apiToken;
    if (input.agentKind) payload.agent_kind = input.agentKind;
    if (input.runtimeKind) payload.runtime_kind = input.runtimeKind;
    if (input.description) payload.description = input.description;
    const response = await api.post('/api/users/agents', payload);
    return response.data;
  },

  updateAgentToken: async (agentId: number, apiToken: string) => {
    const response = await api.patch(`/api/users/agents/${agentId}/token`, {
      api_token: apiToken,
    });
    return response.data;
  },

  testAgentConnection: async (apiToken: string) => {
    const response = await api.post('/api/users/agents/test-connection', {
      api_token: apiToken,
    });
    return response.data as { ok?: boolean; message?: string };
  },
  
  deleteAgent: async (id: number) => {
    const response = await api.delete(`/api/users/agents/${id}`);
    return response.data;
  },
  
  getChatHistory: async (agentId: number) => {
    const response = await api.get<ChatMessage[]>(`/api/chat/history/${agentId}`);
    return response.data;
  },

  getButlerAgentConversation: async (agentId: number) => {
    const response = await api.get<ChatMessage[]>(`/api/chat/butler-agent/${agentId}`);
    return response.data;
  },
  
  sendAuthResponse: async (actionId: string, approved: boolean) => {
    const response = await api.post('/api/chat/auth/response', {
      action_id: actionId,
      approved
    });
    return response.data;
  },

  listSSHKeys: async () => {
    const response = await api.get<SSHKey[]>('/api/users/ops/ssh-keys');
    return response.data;
  },

  getOpenHandsStatus: async () => {
    const response = await api.get<OpenHandsStatus>('/api/users/ops/status');
    return response.data;
  },

  createSSHKey: async (payload: { name: string; public_key?: string; private_key: string }) => {
    const response = await api.post<SSHKey>('/api/users/ops/ssh-keys', payload);
    return response.data;
  },

  deleteSSHKey: async (id: number) => {
    const response = await api.delete(`/api/users/ops/ssh-keys/${id}`);
    return response.data;
  },

  listInfraNodes: async () => {
    const response = await api.get<InfraNode[]>('/api/users/ops/nodes');
    return response.data;
  },

  createInfraNode: async (payload: { name: string; host: string; port: number; ssh_user: string; ssh_key_id: number; description?: string }) => {
    const response = await api.post<InfraNode>('/api/users/ops/nodes', payload);
    return response.data;
  },

  deleteInfraNode: async (id: number) => {
    const response = await api.delete(`/api/users/ops/nodes/${id}`);
    return response.data;
  }
};
