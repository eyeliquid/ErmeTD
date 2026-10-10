// Netwerklaag: praat met de backend. Twee delen:
//  - Net.api:  accounts, voortgang en scores via HTTP (/api/...)
//  - Net.room: de realtime lobby via een WebSocket (/ws)
// Het spel zelf weet niets van adressen of protocollen; dat zit allemaal hier.
const Net = (() => {
  const base = String((window.RATD_CONFIG && window.RATD_CONFIG.api) || '').replace(/\/+$/, '');
  const TOKEN = 'ratd-token';
  let token = null;
  try { token = localStorage.getItem(TOKEN) || null; } catch {}
  function setToken(t) {
    token = t || null;
    try { if (token) localStorage.setItem(TOKEN, token); else localStorage.removeItem(TOKEN); } catch {}
  }

  // Een HTTP-verzoek. Gooit een Error met .status (0 = server onbereikbaar) en een melding in het Nederlands.
  async function api(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try { res = await fetch(base + '/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { const e = new Error('De server is niet bereikbaar. Controleer je verbinding en probeer het opnieuw.'); e.status = 0; throw e; }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) { const e = new Error((data && data.message) || 'Er ging iets mis op de server.'); e.status = res.status; e.code = data && data.error; throw e; }
    return data;
  }

  /* ---------- realtime lobby ---------- */
  // De lobby houdt een lijst spelers (peers) bij. Elke peer heeft `presence`: een klein object met zijn toestand.
  // Je eigen presence wijzig je met room.presence({...}); null haalt een veld weg. Wijzigingen van anderen komen binnen via onPeers.
  function connect(handlers) {
    const peers = new Map();
    const mine = {};          // mijn volledige presence, ook om na een hapering opnieuw te sturen
    const sent = new Map();   // laatst verstuurde waarde per veld, zodat alleen wijzigingen de lijn op gaan
    let ws = null, me = null, resume = null, retry = 0, timer = 0, closed = false, wasOpen = false, fast = false;
    const room = { open: false, peer: null, by: null };

    const wsUrl = () => {
      const u = new URL((base || location.origin) + '/ws');
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return u.href;
    };
    const list = () => [...peers.values()];
    const emit = (joined, updated, left) => { try { handlers.onPeers({ peers: list(), joined, updated, left }); } catch (err) { console.error(err); } };
    const mkPeer = (d, self) => ({ peer: d.peer, kind: 'viewer', by: d.by || null, name: d.name || '', presence: d.presence || {}, sameTab: self, isMe: self });
    function patch(target, d) { for (const k in d) { if (d[k] === null) delete target[k]; else target[k] = d[k]; } }

    function onMessage(ev) {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'p') {
        const upd = [];
        for (const id in m.u) { if (me && id === me.peer) continue; const p = peers.get(id); if (p) { patch(p.presence, m.u[id]); upd.push(p); } }
        if (upd.length) emit([], upd, []);
      } else if (m.t === 'welcome') {
        const left = list().filter(p => p !== me);
        peers.clear();
        me = mkPeer({ peer: m.peer, by: m.you.by, name: m.you.name, presence: mine }, true);
        peers.set(me.peer, me);
        const joined = [me];
        for (const d of m.peers) { const p = mkPeer(d, false); peers.set(p.peer, p); joined.push(p); }
        resume = { peer: m.peer, key: m.key };
        room.open = true; room.peer = m.peer; room.by = m.you.by; retry = 0; wasOpen = true;
        if (handlers.onOpen) handlers.onOpen(room);
        if (handlers.onChat) handlers.onChat(m.chat || [], true);
        if (handlers.onBoard) handlers.onBoard(m.board || []);
        emit(joined, [], left);
        flush();
      } else if (m.t === 'join') {
        const p = mkPeer(m.peer, false); peers.set(p.peer, p); emit([p], [], []);
      } else if (m.t === 'leave') {
        const p = peers.get(m.peer); if (p && p !== me) { peers.delete(m.peer); emit([], [], [p]); }
      } else if (m.t === 'name') {
        const upd = []; for (const p of peers.values()) if (p.by && p.by === m.by) { p.name = m.name; upd.push(p); }
        if (upd.length) emit([], upd, []);
      } else if (m.t === 'chat') { if (handlers.onChat) handlers.onChat([m.m], false); }
      else if (m.t === 'board') { if (handlers.onBoard) handlers.onBoard(m.rows || []); }
    }

    function open() {
      clearTimeout(timer);
      if (closed) return;
      let sock;
      try { sock = new WebSocket(wsUrl()); } catch { schedule(); return; }
      ws = sock;
      sock.onopen = () => {
        sent.clear();
        for (const k in mine) sent.set(k, JSON.stringify(mine[k]));
        sock.send(JSON.stringify({ t: 'hello', token, resume, presence: mine }));
      };
      sock.onmessage = onMessage;
      sock.onclose = () => {
        if (ws !== sock) return;
        ws = null;
        const was = room.open;
        room.open = false;
        if (was) {
          const left = list().filter(p => p !== me);
          for (const p of left) peers.delete(p.peer);
          if (handlers.onClose) handlers.onClose(room);
          emit([], [], left);
        } else if (!wasOpen && handlers.onFail) handlers.onFail(room);
        schedule();
      };
      sock.onerror = () => {};
    }
    // Opnieuw proberen met steeds iets langere pauzes, tot hooguit acht seconden.
    function schedule() { if (closed) return; clearTimeout(timer); if (fast) { fast = false; retry = 0; timer = setTimeout(open, 0); return; } timer = setTimeout(open, Math.min(8000, 500 * Math.pow(1.7, retry++)) * (0.8 + Math.random() * 0.4)); }

    // Stuurt alles wat nog niet bij de server bekend is. Ook na een hapering klopt de toestand daarna weer.
    function flush() {
      if (!ws || ws.readyState !== 1 || !room.open) return;
      const out = {};
      let n = 0;
      for (const k in mine) { const s = JSON.stringify(mine[k]); if (sent.get(k) !== s) { sent.set(k, s); out[k] = mine[k]; n++; } }
      for (const k of [...sent.keys()]) if (!(k in mine)) { sent.delete(k); out[k] = null; n++; }
      if (n) ws.send(JSON.stringify({ t: 'p', d: out }));
    }
    room.presence = d => {
      for (const k in d) { if (d[k] === null || d[k] === undefined) delete mine[k]; else mine[k] = d[k]; }
      flush();
      return Promise.resolve();
    };
    room.chat = text => { if (ws && ws.readyState === 1 && room.open) { ws.send(JSON.stringify({ t: 'chat', text })); return true; } return false; };
    // Na in- of uitloggen: opnieuw aanmelden bij de lobby, met dezelfde plek.
    room.reauth = () => { if (ws) { fast = true; try { ws.close(); } catch {} } else { retry = 0; open(); } };
    room.close = () => { closed = true; clearTimeout(timer); if (ws) try { ws.close(); } catch {} };
    // Terug van een slapend tabblad of een netwerkwissel: niet wachten op de volgende poging.
    addEventListener('online', () => { if (!ws) { retry = 0; open(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !ws) { retry = 0; open(); } });
    open();
    return room;
  }

  return { api, connect, setToken, hasToken: () => !!token };
})();
