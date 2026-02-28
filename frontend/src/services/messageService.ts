import api from './api';
import { LogMessage } from '@/types';

export interface GetMessagesParams {
  agent_id?: string;
  level?: string;
  q?: string;
  offset?: number;
  limit?: number;
}

export const messageService = {
  getMessages: async (params: GetMessagesParams) => {
    const response = await api.get<LogMessage[]>('/api/messages', { params });
    return response.data;
  },
  
  sendMessage: async (agent_id: string, level: string, content: string) => {
    const response = await api.post('/api/messages', { agent_id, level, content });
    return response.data;
  }
};
