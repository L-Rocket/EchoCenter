export const API_BASE_URL = 'http://localhost:8080';

export const getWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host;
  // Fallback for development if Vite is on 5173 but backend is on 8080
  if (window.location.port === '5173' || window.location.port === '3000') {
    return `${protocol}//localhost:8080/api/ws`;
  }
  return `${protocol}//${host}/api/ws`;
};

export const getApiUrl = (path: string) => {
  const host = window.location.hostname === 'localhost' ? 'http://localhost:8080' : window.location.origin;
  if (window.location.port === '5173' || window.location.port === '3000') {
    return `http://localhost:8080${path}`;
  }
  return `${host}${path}`;
};
