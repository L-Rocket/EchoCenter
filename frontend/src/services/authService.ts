import api from './api';
import { User } from '@/types';

export interface LoginResponse {
  token: string;
  user: User;
}

export const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  }
};
