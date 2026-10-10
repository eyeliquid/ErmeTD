'use strict';
// De realtime lobby. Elke verbonden browser is een "peer" met een eigen stukje toestand (presence): lobbystatus,
// vesting, held, minigamescore. De server bewaart dat per peer en stuurt wijzigingen 20 keer per seconde gebundeld door.
// Het spel zelf rekent in de browser van elke speler; de server is het doorgeefluik en bewaakt wie wie is.
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const { cleanMsg } = require('./validate');

const TICK_MS = 50;          // bundelen van presence
const PING_MS = 15000;       // wie niet antwoordt valt af, zodat een potje nooit op een dode verbinding wacht
const HELLO_MS = 10000;
const RESUME_MS = 120000;    // zo lang mag je na een haperende verbinding je oude plek terugnemen
const MAX_KEYS = 48, MAX_VALUE = 4096, MAX_MSG = 16 * 1024;
const MSG_PER_SEC = 80, CHAT_GAP_MS = 700, CHAT_KEEP = 60;

function attach(server, { db, sess, cfg, getBoard }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
  const peers = new Map();    // id -> peer
  const resumable = new Map(); // id -> {key, until}
  const perIp = new Map();
  let dirty = new Map();      // id -> samengevoegde wijziging sinds de vorige tick

  const q = {
    chatAdd: db.prepare('INSERT INTO chat (user_id, name, text, at) VALUES (?, ?, ?, ?)'),
    chatLast: db.prepare(`SELECT id, user_id AS by, name, text, at AS ts FROM chat ORDER BY id DESC LIMIT ${CHAT_KEEP}`),
    chatPrune: db.prepare('DELETE FROM chat WHERE id <= ?'),
  };

  const send = (p, obj) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(obj)); };
  function broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const p of peers.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s);
  }
  const pub = p => ({ peer: p.id, by: p.by, name: p.name, presence: p.presence });
  const guestName = id => 'Gast ' + id.slice(-3).toUpperCase();

  // Een wijziging toepassen: null haalt een veld weg. Geeft terug wat er echt is veranderd.
  function applyPatch(p, d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const out = {};
    let n = 0;
    for (const k of Object.keys(d)) {
      if (k.length > 16 || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      const v = d[k];
      if (v === null || v === undefined) {
        if (k in p.presence) { delete p.presence[k]; out[k] = null; n++; }
        continue;
      }
      if (typeof v === 'object' ? JSON.stringify(v).length > MAX_VALUE : typeof v === 'string' && v.length > MAX_VALUE) continue;
      if (typeof v === 'function' || typeof v === 'symbol') continue;
      if (!(k in p.presence) && Object.keys(p.presence).length >= MAX_KEYS) continue;
      p.presence[k] = v; out[k] = v; n++;
    }
    return n ? out : null;
  }

  function hello(p, m) {
    const user = m.token ? sess.find(m.token) : null;
    let id = null;
    const r = m.resume;
    if (r && typeof r.peer === 'string' && typeof r.key === 'string') {
      const old = resumable.get(r.peer);
      if (old && old.key === r.key && old.until > Date.now() && !peers.has(r.peer)) { id = r.peer; resumable.delete(id); }
    }
    while (!id || peers.has(id)) id = crypto.randomBytes(6).toString('hex');
    p.id = id;
    p.key = crypto.randomBytes(12).toString('base64url');
    p.by = user ? user.id : null;
    p.name = user ? user.name : guestName(id);
    p.presence = Object.create(null);
    applyPatch(p, m.presence);
    clearTimeout(p.helloTimer);
    send(p, {
      t: 'welcome', peer: p.id, key: p.key, you: { by: p.by, name: p.name }, now: Date.now(),
      peers: [...peers.values()].map(pub), chat: q.chatLast.all().reverse(), board: getBoard(),
    });
    peers.set(p.id, p);
    broadcast({ t: 'join', peer: pub(p) }, p);
  }

  function chat(p, m) {
    const text = cleanMsg(m.text), now = Date.now();
    if (!text || now - p.lastChat < CHAT_GAP_MS) return;
    p.lastChat = now;
    const row = q.chatAdd.run(p.by, p.name, text, now);
    const id = Number(row.lastInsertRowid);
    if (id % 50 === 0) q.chatPrune.run(id - CHAT_KEEP * 4);
    broadcast({ t: 'chat', m: { id, ts: now, by: p.by, name: p.name, peer: p.id, text } });
  }

  function onMessage(p, raw) {
    const now = Date.now();
    if (now - p.winAt > 1000) { p.winAt = now; p.winN = 0; }
    if (++p.winN > MSG_PER_SEC) { if (p.winN > MSG_PER_SEC * 5) p.ws.close(1008, 'te veel berichten'); return; }
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (!p.id) { if (m.t === 'hello') hello(p, m); return; }
    if (m.t === 'p') {
      const ch = applyPatch(p, m.d);
      if (ch) dirty.set(p.id, Object.assign(dirty.get(p.id) || {}, ch));
    } else if (m.t === 'chat') chat(p, m);
  }

  function onClose(p) {
    clearTimeout(p.helloTimer);
    const n = (perIp.get(p.ip) || 1) - 1;
    if (n > 0) perIp.set(p.ip, n); else perIp.delete(p.ip);
    if (!p.id || peers.get(p.id) !== p) return;
    peers.delete(p.id);
    dirty.delete(p.id);
    resumable.set(p.id, { key: p.key, until: Date.now() + RESUME_MS });
    broadcast({ t: 'leave', peer: p.id });
  }

  wss.on('connection', (ws, req) => {
    const p = { ws, ip: req.ip, id: null, key: null, by: null, name: '', presence: null, alive: true, winAt: 0, winN: 0, lastChat: 0 };
    perIp.set(p.ip, (perIp.get(p.ip) || 0) + 1);
    p.helloTimer = setTimeout(() => ws.close(1008, 'geen hello'), HELLO_MS);
    ws.on('message', (data, isBinary) => { if (!isBinary) onMessage(p, data.toString()); });
    ws.on('pong', () => { p.alive = true; });
    ws.on('close', () => onClose(p));
    ws.on('error', () => {});
    ws._peer = p;
  });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try { pathname = new URL(req.url, 'http://x').pathname; } catch {}
    if (pathname !== '/ws') { socket.destroy(); return; }
    const fwd = cfg.trustProxy > 0 ? String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean) : [];
    req.ip = fwd.length ? fwd[Math.max(0, fwd.length - cfg.trustProxy)] : req.socket.remoteAddress || '';
    const refuse = (code, text) => { socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    if (wss.clients.size >= cfg.maxPeers) return refuse(503, 'Service Unavailable');
    if ((perIp.get(req.ip) || 0) >= cfg.maxPeersPerIp) return refuse(429, 'Too Many Requests');
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  const tick = setInterval(() => {
    if (!dirty.size) return;
    const u = Object.fromEntries(dirty);
    dirty = new Map();
    broadcast({ t: 'p', u });
  }, TICK_MS);

  const ping = setInterval(() => {
    const now = Date.now();
    for (const [id, r] of resumable) if (r.until < now) resumable.delete(id);
    for (const ws of wss.clients) {
      const p = ws._peer;
      if (p && !p.alive) { ws.terminate(); continue; }
      if (p) p.alive = false;
      try { ws.ping(); } catch {}
    }
  }, PING_MS);

  return {
    count: () => peers.size,
    boardChanged() { broadcast({ t: 'board', rows: getBoard() }); },
    // Een speler heeft zijn roepnaam gewijzigd: alle open verbindingen van dat account krijgen de nieuwe naam.
    renamed(userId, name) {
      let any = false;
      for (const p of peers.values()) if (p.by === userId) { p.name = name; any = true; }
      if (any) broadcast({ t: 'name', by: userId, name });
    },
    close() {
      clearInterval(tick); clearInterval(ping);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}

module.exports = { attach };
