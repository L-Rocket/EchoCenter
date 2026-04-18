// Static fallbacks + metadata the backend doesn't expose yet.
// Live data (agents, logs, threads, users) is fetched via window.API in each page.

function __initialsFor(name) {
  if (!name) return '—';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function __userFromStorage() {
  const u = (window.API && window.API.getCurrentUser && window.API.getCurrentUser()) || null;
  if (!u) return { id: null, name: '—', role: 'USER', email: '', initials: '—' };
  const name = u.username || `user#${u.id}`;
  return {
    id: u.id,
    name,
    role: u.role || 'USER',
    email: u.email || '',
    initials: __initialsFor(name),
    raw: u,
  };
}

const DATA = {
  get user() { return __userFromStorage(); },

  // Static charts the backend doesn't summarize yet.
  intents: [
    ['Coordination', 41, 'var(--accent)'],
    ['Data lookup',  22, 'var(--blue)'],
    ['Scheduling',   18, 'var(--green)'],
    ['Code exec',    11, 'var(--amber)'],
    ['Other',         8, 'var(--fg-faint)'],
  ],
};

window.DATA = DATA;
