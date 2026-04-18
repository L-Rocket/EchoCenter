// API client — talks to the real EchoCenter Go backend (default :8080).
// Exposes window.API with auth + fetchers + backend->display shape mappers.

(function () {
  const DEFAULT_BASE =
    window.location.port === '8080'
      ? window.location.origin
      : 'http://localhost:8080';
  const API_BASE = (window.__API_BASE__ || DEFAULT_BASE).replace(/\/+$/, '');

  const LS_TOKEN = 'ec_v2_token';
  const LS_USER = 'ec_v2_user';

  const getToken = () => localStorage.getItem(LS_TOKEN);
  const setToken = (t) => {
    if (t) localStorage.setItem(LS_TOKEN, t);
    else localStorage.removeItem(LS_TOKEN);
  };
  const getCurrentUser = () => {
    try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); }
    catch { return null; }
  };
  const setCurrentUser = (u) => {
    if (u) localStorage.setItem(LS_USER, JSON.stringify(u));
    else localStorage.removeItem(LS_USER);
  };
  const logout = () => {
    setToken(null);
    setCurrentUser(null);
    window.dispatchEvent(new Event('ec:auth-changed'));
  };

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      logout();
      throw new Error('Unauthorized — please sign in again.');
    }
    const txt = await res.text();
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch { data = txt; } }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // ---- time helpers ----
  function timeAgo(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    if (isNaN(ms) || ms < 0) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 5) return 'now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  }
  function timeOfDay(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour12: false });
  }

  // ---- mappers: backend -> v2 display shape ----
  function agentStatusClass(a) {
    if (a.online === true) return 'online';
    const st = (a.status || '').toUpperCase();
    if (st === 'BUSY') return 'busy';
    if (st === 'ONLINE') return 'online';
    return 'offline';
  }

  function agentRole(a) {
    const uname = (a.username || '').toLowerCase();
    if (a.agent_kind === 'butler' || uname === 'butler') return 'BUTLER';
    if (a.agent_kind === 'openhands_ops') return 'OPERATOR';
    if (uname.includes('bridge') || uname.includes('feishu')) return 'INTEGRATION';
    if (uname.includes('observer') || uname.includes('sentry')) return 'OBSERVER';
    return 'WORKER';
  }

  function mapAgent(a) {
    const status = agentStatusClass(a);
    return {
      id: a.id,
      raw: a,
      name: a.username || `#${a.id}`,
      role: agentRole(a),
      desc: a.description || 'No description provided.',
      kind: a.runtime_kind || a.agent_kind || 'generic',
      status,
      latency: null,
      tokens: a.token_hint || '—',
      msgs: 0,
      tokenHint: a.token_hint || '—',
      lastSeen: a.last_seen_at ? timeAgo(a.last_seen_at) : '—',
    };
  }

  function mapLog(m) {
    const raw = (m.level || 'INFO').toUpperCase();
    const level = raw === 'WARNING' ? 'WARN' : raw;
    const color =
      level === 'ERROR' ? 'red' :
      level === 'WARN' ? 'amber' :
      level === 'AUTH' ? 'amber' :
      level === 'DEBUG' ? 'dim' :
      'accent';
    return {
      id: m.id,
      ts: m.timestamp,
      t: timeOfDay(m.timestamp),
      agent: m.agent_id || 'system',
      lvl: level,
      msg: m.content || '',
      color,
    };
  }

  function mapUser(u) {
    const role = (u.role || 'MEMBER').toUpperCase();
    return {
      id: u.id,
      name: u.username || `user#${u.id}`,
      email: u.email || '—',
      role: role === 'ADMIN' ? 'Admin' : 'Member',
      lastActive: u.last_seen_at ? timeAgo(u.last_seen_at)
        : u.created_at ? timeAgo(u.created_at) : '—',
    };
  }

  function mapThread(t) {
    return {
      id: t.id,
      title: t.title || `Thread #${t.id}`,
      preview: t.summary || '',
      at: t.updated_at ? timeAgo(t.updated_at)
         : t.created_at ? timeAgo(t.created_at) : '',
      unread: 0,
      raw: t,
    };
  }

  function mapChatMessage(m) {
    const who = (m.sender_kind === 'user' || m.sender_role === 'USER') ? 'me'
      : ((m.sender_role === 'BUTLER') || String(m.sender_name || '').toLowerCase() === 'butler') ? 'butler'
      : 'agent';
    return {
      id: m.id,
      who,
      at: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }) : '',
      text: m.content || '',
      raw: m,
    };
  }

  function wsUrl() {
    const u = new URL(API_BASE);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = (u.pathname.replace(/\/+$/, '') + '/api/ws');
    return u.toString().replace(/\/+$/, '');
  }

  const API = {
    base: API_BASE,
    wsUrl,
    getToken, setToken, getCurrentUser, setCurrentUser, logout,
    helpers: { timeAgo, timeOfDay, agentRole, agentStatusClass },
    isAuthed() { return Boolean(getToken()); },

    async login(username, password) {
      const r = await request('POST', '/api/auth/login', { username, password });
      setToken(r.token);
      setCurrentUser(r.user);
      window.dispatchEvent(new Event('ec:auth-changed'));
      return r;
    },

    async ping() { return request('GET', '/api/ping'); },

    async agents() {
      const list = await request('GET', '/api/users/agents');
      return Array.isArray(list) ? list.map(mapAgent) : [];
    },

    async agentStatuses() {
      const list = await request('GET', '/api/users/agents/status');
      return Array.isArray(list) ? list.map(mapAgent) : [];
    },

    async butler() {
      try { return await request('GET', '/api/users/butler'); }
      catch { return null; }
    },

    async messages(params = {}) {
      const qp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qp.append(k, String(v));
      });
      const qs = qp.toString();
      const list = await request('GET', `/api/messages${qs ? '?' + qs : ''}`);
      return Array.isArray(list) ? list.map(mapLog) : [];
    },

    async users() {
      try {
        const list = await request('GET', '/api/users');
        return Array.isArray(list) ? list.map(mapUser) : [];
      } catch {
        return [];
      }
    },

    async threads(peerId, channelKind = 'butler_direct') {
      if (peerId == null) return [];
      const list = await request(
        'GET',
        `/api/chat/threads?peer_id=${peerId}&channel_kind=${encodeURIComponent(channelKind)}`
      );
      return Array.isArray(list) ? list.map(mapThread) : [];
    },

    async threadMessages(id) {
      if (id == null) return [];
      const list = await request('GET', `/api/chat/threads/${id}/messages`);
      return Array.isArray(list) ? list.map(mapChatMessage) : [];
    },

    async butlerAgentConversation(agentId) {
      try {
        const list = await request('GET', `/api/chat/butler-agent/${agentId}`);
        return Array.isArray(list) ? list.map(mapChatMessage) : [];
      } catch { return []; }
    },

    async createThread(payload) {
      return request('POST', '/api/chat/threads', payload);
    },

    async openHandsStatus() {
      try { return await request('GET', '/api/users/ops/status'); }
      catch { return null; }
    },

    async openHandsTasks(limit = 10) {
      try {
        const list = await request('GET', `/api/users/ops/tasks?limit=${limit}`);
        return Array.isArray(list) ? list : [];
      } catch { return []; }
    },
  };

  window.API = API;
})();
