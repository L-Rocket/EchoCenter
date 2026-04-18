// Butler chat page — live threads + real WebSocket send/receive.
function ButlerPage() {
  const [butler, setButler] = React.useState(null);
  const [threads, setThreads] = React.useState([]);
  const [selectedThread, setSelectedThread] = React.useState(null);
  const [convo, setConvo] = React.useState([]);
  const [streaming, setStreaming] = React.useState(''); // in-flight CHAT_STREAM buffer for current thread
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [loadingThreads, setLoadingThreads] = React.useState(true);
  const [loadingMsgs, setLoadingMsgs] = React.useState(false);
  const [wsConnected, setWsConnected] = React.useState(Boolean(window.WS && window.WS.connected));
  const [err, setErr] = React.useState('');
  const feedRef = React.useRef(null);
  const selectedThreadRef = React.useRef(null);
  React.useEffect(() => { selectedThreadRef.current = selectedThread; }, [selectedThread]);

  // Discover butler + list threads once.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await API.butler();
        if (cancelled) return;
        setButler(b);
        const peerId = b && b.id;
        if (!peerId) { setLoadingThreads(false); return; }
        const list = await API.threads(peerId);
        if (cancelled) return;
        setThreads(list);
        if (list.length) setSelectedThread(list[0].id);
      } catch (ex) {
        if (!cancelled) setErr(ex.message || 'Failed to load Butler threads.');
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load messages when thread changes.
  React.useEffect(() => {
    setStreaming('');
    setThinking(false);
    if (selectedThread == null) { setConvo([]); return; }
    let cancelled = false;
    setLoadingMsgs(true);
    API.threadMessages(selectedThread)
      .then(list => { if (!cancelled) setConvo(list); })
      .catch(() => { if (!cancelled) setConvo([]); })
      .finally(() => { if (!cancelled) setLoadingMsgs(false); });
    return () => { cancelled = true; };
  }, [selectedThread]);

  // WebSocket subscription for live Butler messages.
  React.useEffect(() => {
    if (!window.WS) return;
    const offStatus = window.WS.on('_status', (s) => setWsConnected(!!s.connected));
    const offChat = window.WS.on('CHAT', (msg) => {
      const me = API.getCurrentUser();
      const threadId = selectedThreadRef.current;
      // Only surface messages belonging to the currently viewed thread.
      if (msg.conversation_id != null && threadId != null && msg.conversation_id !== threadId) return;
      const mine = me && msg.sender_id === me.id;
      const payload = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload);
      setConvo(prev => {
        // If this is our own message coming back, try to reconcile with an optimistic local_id.
        if (mine && msg.local_id) {
          const idx = prev.findIndex(m => m.local_id === msg.local_id);
          if (idx >= 0) {
            const copy = prev.slice();
            copy[idx] = { ...copy[idx], id: msg.id || copy[idx].id, confirmed: true };
            return copy;
          }
        }
        return [...prev, {
          id: msg.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          who: mine ? 'me' : (String(msg.sender_name || '').toLowerCase() === 'butler' ? 'butler' : 'agent'),
          at: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'now',
          text: payload,
        }];
      });
      if (!mine) { setStreaming(''); setThinking(false); }
    });
    const offStream = window.WS.on('CHAT_STREAM', (msg) => {
      const threadId = selectedThreadRef.current;
      if (msg.conversation_id != null && threadId != null && msg.conversation_id !== threadId) return;
      setThinking(false);
      setStreaming(msg._accumulated || '');
    });
    return () => { offStatus(); offChat(); offStream(); };
  }, []);

  React.useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [convo, streaming, thinking]);

  const send = async () => {
    const text = input.trim();
    if (!text || !butler?.id) return;

    let threadId = selectedThread;
    // If there's no thread yet, create one so the backend can associate messages.
    if (threadId == null) {
      try {
        const created = await API.createThread({
          peer_id: butler.id,
          channel_kind: 'butler_direct',
          title: 'New Butler Conversation',
        });
        threadId = created.id;
        const list = await API.threads(butler.id);
        setThreads(list);
        setSelectedThread(threadId);
      } catch (ex) {
        setErr(ex.message || 'Failed to create thread.');
        return;
      }
    }

    const localId = window.WS && window.WS.send(butler.id, text, threadId);
    if (!localId) {
      setErr('WebSocket is not connected — message not sent.');
      return;
    }

    // Optimistic append (will be reconciled when the backend echoes it back).
    const me = API.getCurrentUser();
    setConvo(c => [...c, {
      id: localId, local_id: localId, who: 'me', at: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
      text, pending: true,
    }]);
    setInput('');
    setErr('');
    setThinking(true);
  };

  return (
    <div className="chat-shell">
      {/* Threads rail */}
      <div>
        <div className="rail-head">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Butler · Direct</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>Conversations</div>
            </div>
            <button className="icon-btn" title="New thread"><Icon name="plus" size={14} /></button>
          </div>
          <div style={{ position:'relative' }}>
            <Icon name="search" size={12} style={{ position:'absolute', left: 10, top: 11, color:'var(--fg-dim)' }} />
            <input className="input" style={{ paddingLeft: 28, height: 32 }} placeholder="Search threads" />
          </div>
        </div>
        <div className="rail-body">
          {loadingThreads ? (
            <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>Loading threads…</div>
          ) : err ? (
            <div style={{ padding: 20, color: 'var(--red)', fontSize: 13 }}>{err}</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>
              No Butler conversations yet.
            </div>
          ) : threads.map(t => (
            <div key={t.id} className={`thread-item ${selectedThread === t.id ? 'active' : ''}`} onClick={() => setSelectedThread(t.id)}>
              <div className="title-row">
                <div className="title"><span className="dot" />{t.title}</div>
                <div className="ts">{t.at}</div>
              </div>
              <div className="preview">{t.preview}</div>
              {t.unread ? <Pill kind="accent" style={{ marginTop: 8 }}>{t.unread} new</Pill> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Chat main */}
      <div className="chat-main">
        <div className="chat-head">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), oklch(0.6 0.2 325))',
            display:'grid', placeItems:'center',
            boxShadow: '0 0 24px -4px var(--accent-glow)',
          }}>
            <Icon name="sparkle" size={16} style={{ color: 'var(--accent-ink)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, display:'flex', gap: 8, alignItems:'center' }}>
              {butler?.username || 'Butler'}
              <Pill kind={wsConnected ? 'green' : 'amber'}>
                <span className={`pulse-dot ${wsConnected ? '' : 'amber'}`} style={{ width:5, height:5 }} /> {wsConnected ? 'WS live' : 'WS offline'}
              </Pill>
            </div>
            <div className="mono dim" style={{ fontSize: 11, marginTop: 2 }}>
              {butler ? `${butler.agent_kind || 'butler'} · id ${butler.id}` : '—'}
              {selectedThread ? ` · thread #${selectedThread}` : ''}
            </div>
          </div>
          <Btn variant="ghost" size="sm" icon="terminal">Tools</Btn>
          <Btn variant="ghost" size="sm" icon="dots"></Btn>
        </div>

        <div className="chat-feed" ref={feedRef}>
          {loadingMsgs ? (
            <div style={{ textAlign:'center', color: 'var(--fg-dim)', padding: 40, fontSize: 13 }}>Loading messages…</div>
          ) : convo.length === 0 && !streaming && !thinking ? (
            <div style={{ textAlign:'center', color: 'var(--fg-dim)', padding: 40, fontSize: 13 }}>
              {selectedThread ? 'No messages in this thread yet. Say hi to Butler below.' : 'Type a message below — a thread will be created.'}
            </div>
          ) : (
            <>
              {convo.map((m, i) => <ChatMessage key={m.id ?? i} m={m} />)}
              {streaming ? (
                <div className="msg-group">
                  <div className="msg-ava butler"><Icon name="sparkle" size={12} style={{ color:'var(--accent-ink)' }} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="msg-meta"><span className="who">Butler</span><span className="at">streaming…</span></div>
                    <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(streaming) }} />
                  </div>
                </div>
              ) : thinking ? (
                <div className="msg-group">
                  <div className="msg-ava butler"><Icon name="sparkle" size={12} style={{ color:'var(--accent-ink)' }} /></div>
                  <div>
                    <div className="msg-meta"><span className="who">Butler</span><span className="at">thinking</span></div>
                    <div className="thinking-chip">
                      <span className="dots"><span /><span /><span /></span>
                      Thinking…
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="composer">
          <div className="composer-inner">
            <textarea
              placeholder="Ask Butler to coordinate agents, fetch data, or schedule work…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <div className="composer-bar">
              <div className="tools">
                <button className="tool" title="Attach"><Icon name="paperclip" size={14} /></button>
                <button className="tool" title="Voice"><Icon name="mic" size={14} /></button>
                <button className="tool" title="Command"><Icon name="terminal" size={14} /></button>
              </div>
              <span className="mono dim" style={{ fontSize: 10, marginLeft: 8 }}>
                ⌘↵ to send · Butler will plan & delegate
              </span>
              <div style={{ flex: 1 }} />
              <Btn variant="accent" size="sm" icon="send" onClick={send}>Send</Btn>
            </div>
          </div>
        </div>
      </div>

      {/* Context rail */}
      <div>
        <div className="ctx-block">
          <h4>Session</h4>
          <div className="kv"><span className="k">Thread</span><span className="v">{selectedThread ? `#${selectedThread}` : '—'}</span></div>
          <div className="kv"><span className="k">Butler id</span><span className="v">{butler?.id ?? '—'}</span></div>
          <div className="kv"><span className="k">Kind</span><span className="v">{butler?.agent_kind || '—'}</span></div>
          <div className="kv"><span className="k">Messages</span><span className="v">{convo.length}</span></div>
        </div>
        <div className="ctx-block">
          <h4>Transport</h4>
          <div className="kv"><span className="k">WebSocket</span><span className="v">{wsConnected ? 'live' : 'offline'}</span></div>
          <div className="kv"><span className="k">URL</span><span className="v" style={{ fontSize: 10 }}>{API.wsUrl()}</span></div>
          {err ? (
            <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{err}</div>
          ) : (
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginTop: 8 }}>
              Messages go through the backend WS gateway; Butler streams replies live via CHAT_STREAM.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ m }) {
  if (m.type === 'thinking') {
    return (
      <div className="msg-group">
        <div className="msg-ava butler"><Icon name="sparkle" size={12} style={{ color:'var(--accent-ink)' }} /></div>
        <div>
          <div className="msg-meta"><span className="who">Butler</span><span className="at">{m.at}</span></div>
          <div className="thinking-chip">
            <span className="dots"><span /><span /><span /></span>
            {m.text}…
          </div>
        </div>
      </div>
    );
  }
  if (m.type === 'tool') {
    return (
      <div className="msg-group">
        <div className="msg-ava butler"><Icon name="sparkle" size={12} style={{ color:'var(--accent-ink)' }} /></div>
        <div style={{ flex: 1 }}>
          <div className="msg-meta"><span className="who">Butler</span><span className="at">{m.at}</span><Pill kind="blue" icon="zap">Tool</Pill></div>
          <div className="msg-bubble mono" style={{ fontSize: 12.5, whiteSpace: 'pre-line' }}>{m.text}</div>
        </div>
      </div>
    );
  }
  if (m.type === 'auth') {
    return (
      <div className="msg-group">
        <div className="msg-ava butler"><Icon name="shield" size={12} style={{ color:'var(--accent-ink)' }} /></div>
        <div style={{ flex: 1 }}>
          <div className="msg-meta"><span className="who">Butler</span><span className="at">{m.at}</span><Pill kind="amber" icon="shield">Auth required</Pill></div>
          <div className="auth-request">
            <div className="h">
              <Icon name="shield" size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600 }}>{m.title}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>{m.desc}</div>
            <div className="actions">
              <Btn variant="accent" size="sm" icon="check">Approve</Btn>
              <Btn variant="ghost" size="sm">Deny</Btn>
              <Btn variant="ghost" size="sm">View details</Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isMine = m.who === 'me';
  return (
    <div className={`msg-group ${isMine ? 'mine' : ''}`}>
      <div className={`msg-ava ${isMine ? 'me' : 'butler'}`}>
        {isMine ? 'LW' : <Icon name="sparkle" size={12} style={{ color:'var(--accent-ink)' }} />}
      </div>
      <div style={{ flex: isMine ? '0 1 auto' : 1 }}>
        <div className="msg-meta" style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
          <span className="who">{isMine ? 'You' : 'Butler'}</span>
          <span className="at">{m.at}</span>
        </div>
        <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
      </div>
    </div>
  );
}

function renderMarkdown(t) {
  // extremely tiny md: **bold**, `code`, ```blocks```
  return t
    .replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c.replace(/[<>]/g, s => ({'<':'&lt;','>':'&gt;'}[s]))}</pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

Object.assign(window, { ButlerPage });
