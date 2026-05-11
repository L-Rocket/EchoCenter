import api from '@/services/api';

export interface ButlerConfigDTO {
  model_name: string;
  base_url: string;
  api_token_hint: string;
  config_source: 'db' | 'env' | 'none';
  updated_at: string | null;
  updated_by: string | null;
}

export interface UpdateButlerConfigRequest {
  model_name: string;
  base_url: string;
  api_token: string;
}

export interface TestConnectivityRequest {
  model_name: string;
  base_url: string;
  api_token: string;
}

export interface TestConnectivityResponse {
  ok: boolean;
  message: string;
  latency_ms: number;
}

export const getButlerConfig = () =>
  api.get<ButlerConfigDTO>('/api/butler/config');

export const updateButlerConfig = (req: UpdateButlerConfigRequest) =>
  api.put<{ ok: boolean; config_source: string }>('/api/butler/config', req);

export const resetButlerConfig = () =>
  api.delete<{ ok: boolean; config_source: string }>('/api/butler/config');

export const testButlerConnectivity = (req: TestConnectivityRequest) =>
  api.post<TestConnectivityResponse>('/api/butler/config/test', req);
