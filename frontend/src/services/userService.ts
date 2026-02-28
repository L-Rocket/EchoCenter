import api from './api';
import { User, Agent, ChatMessage } from '@/types';

export const userService = {
  getUsers: async () => {
    const response = await api.get<User[]>('/api/users');
    return response.data;
  },
  
  getAgents: async () => {
    const response = await api.get<Agent[]>('/api/users/agents');
    return response.data;
  },
  
  createAgent: async (username: string) => {
    const response = await api.post('/api/users/agents', { username });
    return response.data;
  },
  
  deleteAgent: async (id: number) => {
    const response = await api.delete(`/api/users/agents/${id}`);
    return response.data;
  },
  
  getChatHistory: async (agentId: number) => {
    const response = await api.get<ChatMessage[]>(`/api/chat/history/${agentId}`);
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
