const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const apiBaseFromEnv = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || '');
const wsBaseFromEnv = trimTrailingSlash(import.meta.env.VITE_WS_BASE_URL || '');

const isDevRuntime = () => Boolean(import.meta.env.DEV);

const getDefaultApiBaseUrl = () => {
  if (apiBaseFromEnv) return apiBaseFromEnv;
  if (isDevRuntime()) return 'http://localhost:8080';
  return window.location.origin;
};

const getDefaultWsBaseUrl = () => {
  if (wsBaseFromEnv) return wsBaseFromEnv;

  if (apiBaseFromEnv.startsWith('http://') || apiBaseFromEnv.startsWith('https://')) {
    const apiUrl = new URL(apiBaseFromEnv);
    apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return trimTrailingSlash(apiUrl.toString());
  }

  if (isDevRuntime()) {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//localhost:8080`;
  }

  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
};

export const API_BASE_URL = getDefaultApiBaseUrl();

export const getWsUrl = () => `${getDefaultWsBaseUrl()}/api/ws`;

export const getApiUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path}`;
};
