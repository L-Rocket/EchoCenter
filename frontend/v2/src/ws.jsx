// window.WS — single long-lived WebSocket to the backend, shared by all pages.
// Subscribers register handlers with WS.on(type, fn) and get raw messages.
// Butler/agent streaming is accumulated in WS.streams and flushed on CHAT_STREAM_END
// as a synthetic CHAT message, so consumers can treat streaming like regular chat.

(function () {
  const listeners = new Map(); // type -> Set<fn>
  let socket = null;
  let connecting = false;
  let reconnectTimer = null;
  let attempts = 0;
  let explicitlyClosed = false;
  const streams = new Map(); // stream_id -> { parts[], sender_id, sender_name, conversation_id, target_id }

  function emit(type, msg) {
    const s = listeners.get(type); if (!s) return;
    s.forEach(fn => { try { fn(msg); } catch (e) { console.error('[WS] listener error', e); } });
  }

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => off(type, fn);
  }
  function off(type, fn) {
    const s = listeners.get(type); if (s) s.delete(fn);
  }

  function isOpen() {
    return socket && socket.readyState === WebSocket.OPEN;
  }

  function connect() {
    if (connecting || isOpen()) return;
    const token = window.API && window.API.getToken();
    if (!token) return;
    explicitlyClosed = false;
    connecting = true;
    const url = `${window.API.wsUrl()}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      connecting = false;
      attempts = 0;
      console.log('[WS] connected', url);
      emit('_status', { connected: true });
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); }
      catch (e) { console.warn('[WS] bad frame', event.data); return; }

      if (msg.type === 'CHAT_STREAM') {
        const id = msg.stream_id || `s-${msg.sender_id}-${msg.conversation_id}`;
        const buf = streams.get(id) || {
          stream_id: id, parts: [],
          sender_id: msg.sender_id, sender_name: msg.sender_name,
          target_id: msg.target_id, conversation_id: msg.conversation_id,
          first_timestamp: msg.timestamp || new Date().toISOString(),
        };
        buf.parts.push(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));
        streams.set(id, buf);
        emit('CHAT_STREAM', { ...msg, _accumulated: buf.parts.join('') });
        return;
      }

      if (msg.type === 'CHAT_STREAM_END') {
        const id = msg.stream_id || `s-${msg.sender_id}-${msg.conversation_id}`;
        const buf = streams.get(id);
        streams.delete(id);
        if (buf) {
          const synthetic = {
            type: 'CHAT',
            sender_id: buf.sender_id,
            sender_name: buf.sender_name,
            target_id: buf.target_id,
            conversation_id: buf.conversation_id,
            timestamp: msg.timestamp || buf.first_timestamp,
            payload: buf.parts.join(''),
            stream_id: id,
            _fromStream: true,
          };
          emit('CHAT', synthetic);
        }
        emit('CHAT_STREAM_END', msg);
        return;
      }

      emit(msg.type || '*', msg);
    };

    ws.onerror = (e) => {
      console.warn('[WS] error', e);
    };

    ws.onclose = () => {
      connecting = false;
      if (socket === ws) socket = null;
      emit('_status', { connected: false });
      if (explicitlyClosed) return;
      const delay = Math.min(30000, 500 * Math.pow(2, attempts++));
      console.log(`[WS] disconnected, reconnect in ${delay}ms`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };
  }

  function disconnect() {
    explicitlyClosed = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (socket) {
      try { socket.close(); } catch {}
      socket = null;
    }
  }

  function send(targetId, payload, conversationId) {
    if (!isOpen()) return false;
    const user = window.API && window.API.getCurrentUser();
    if (!user) return false;
    const localId = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const frame = {
      local_id: localId,
      type: 'CHAT',
      sender_id: user.id,
      sender_name: user.username,
      target_id: targetId,
      payload,
    };
    if (conversationId != null) frame.conversation_id = conversationId;
    socket.send(JSON.stringify(frame));
    return localId;
  }

  // React to login/logout from the rest of the app.
  window.addEventListener('ec:auth-changed', () => {
    if (window.API && window.API.isAuthed()) connect();
    else disconnect();
  });

  window.WS = { on, off, send, connect, disconnect, isOpen, get connected() { return isOpen(); } };
})();
