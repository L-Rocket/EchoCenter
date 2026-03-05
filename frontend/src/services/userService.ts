import api from './api';
import type { User, Agent, ChatMessage } from '@/types';

export const userService = {
  getUsers: async () => {
    const response = await api.get<User[]>('/api/users');
    return response.data;
  },
  
  getAgents: async () => {
    const response = await api.get<Agent[]>('/api/users/agents');
    return response.data;
  },
  
  createAgent: async (username: string, apiToken?: string) => {
    const payload = apiToken ? { username, api_token: apiToken } : { username };
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
  }
};
