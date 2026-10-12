'use strict';
// De realtime lobby's. Elke verbonden browser is een "peer" met een eigen stukje toestand (presence): lobbystatus,
// vesting, held, minigamescore. De server bewaart dat per peer en stuurt wijzigingen 20 keer per seconde gebundeld door.
// Het spel zelf rekent in de browser van elke speler; de server is het doorgeefluik en bewaakt wie wie is.
//
// Er zijn meerdere lobby's. Een peer zit in hooguit één lobby en ziet alleen de spelers en de chat daarvan.
// Zodra een lobby start (iemand stuurt `go` of gaat spelen) gaat hij op slot: er kan niemand meer bij, behalve wie
// na een haperende verbinding zijn eigen plek terugneemt. Is niemand van de lobby meer aan het spelen, dan gaat hij weer open.
// Er is altijd minstens één open lobby.
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const { cleanMsg } = require('./validate');

const TICK_MS = 50;          // bundelen van presence
const PING_MS = 15000;       // wie niet antwoordt valt af, zodat een potje nooit op een dode verbinding wacht
const HELLO_MS = 10000;
const RESUME_MS = 120000;    // zo lang mag je na een haperende verbinding je oude plek terugnemen
const MAX_KEYS = 48, MAX_VALUE = 4096, MAX_MSG = 16 * 1024;
const MSG_PER_SEC = 80, CHAT_GAP_MS = 700, CHAT_KEEP = 60;
const LOBBY_MAX = 25;        // zoveel vestingen heeft de wereld
const LOBBIES_MAX = 40, CREATE_GAP_MS = 10000;
const cleanLobbyName = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f\u2028-\u202e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);

function attach(server, { db, sess, cfg, getBoard, settings }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
  const peers = new Map();    // id -> peer
  const resumable = new Map(); // id -> {key, until}
  const perIp = new Map();
  let dirty = new Map();      // id -> samengevoegde wijziging sinds de vorige tick

  const lobbies = new Map();  // id -> {id, name, state: 'open'|'playing', members: Map, chat: [], by, at}
  let chatNo = 0, listDirty = false;

  const send = (p, obj) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(obj)); };
  function broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const p of peers.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s);
  }
  function toLobby(L, obj, except) {
    const s = JSON.stringify(obj);
    for (const p of L.members.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s);
  }

  /* ---------- lobby's ---------- */
  function makeLobby(name, by) {
    let id;
    do id = crypto.randomBytes(4).toString('hex'); while (lobbies.has(id));
    if (!name) { const used = new Set([...lobbies.values()].map(o => o.name)); let n = 1; while (used.has('Lobby ' + n)) n++; name = 'Lobby ' + n; }
    const L = { id, name, state: 'open', members: new Map(), chat: [], by: by || null, at: Date.now() };
    lobbies.set(id, L);
    listDirty = true;
    return L;
  }
  const lobbyPub = L => ({ id: L.id, name: L.name, state: L.state, n: L.members.size, max: LOBBY_MAX, at: L.at });
  // Een gestarte lobby zonder verbonden spelers (iedereen even weg) hoeft niet in de lijst.
  const lobbyList = () => [...lobbies.values()].filter(L => L.members.size || L.state === 'open').sort((a, b) => (a.state === b.state ? a.at - b.at : a.state === 'open' ? -1 : 1)).map(lobbyPub);
  // Er moet altijd een lobby zijn waar je in kunt.
  function ensureOpen() {
    for (const L of lobbies.values()) if (L.state === 'open' && L.members.size < LOBBY_MAX) return;
    makeLobby();
  }
  // Wordt nog naar deze lobby teruggekeerd na een hapering?
  function awaited(L) { for (const r of resumable.values()) if (r.lobby === L.id) return true; return false; }
  // Lege lobby's ruimen we op, behalve de laatste open lobby en een lobby waar nog iemand naar terug kan.
  function tidy() {
    for (const L of [...lobbies.values()]) {
      if (L.members.size || awaited(L)) continue;
      const otherOpen = [...lobbies.values()].some(o => o !== L && o.state === 'open' && o.members.size < LOBBY_MAX);
      if (L.state === 'open' && !otherOpen) { if (L.chat.length) { L.chat = []; } continue; }
      lobbies.delete(L.id);
      listDirty = true;
    }
    ensureOpen();
  }
  const busy = p => p.presence && (p.presence.st === 'playing' || p.presence.st === 'done');
  // Op slot zodra er gestart wordt; weer open als niemand van de lobby nog speelt.
  function checkState(L, ch) {
    if (L.state === 'open' && ch && (typeof ch.go === 'number' || ch.st === 'playing')) {
      L.state = 'playing'; listDirty = true; ensureOpen();
    } else if (L.state === 'playing' && ![...L.members.values()].some(busy) && !awaited(L)) {
      L.state = 'open'; listDirty = true;
    }
  }
  const lobbyErr = {
    full: 'Deze lobby is vol.',
    started: 'Deze lobby is al begonnen. Kies een andere lobby of maak een nieuwe.',
    gone: 'Deze lobby bestaat niet meer.',
    busy: 'Je bent nog in een potje. Ga eerst terug naar de lobby.',
    many: 'Er zijn al te veel lobby\'s. Doe mee met een bestaande lobby.',
    slow: 'Wacht even voordat je weer een lobby maakt.',
  };
  function deny(p, code, id) { send(p, { t: 'denied', code, id: id || null, message: lobbyErr[code] }); }

  function leaveLobby(p, quiet) {
    const L = p.lobby && lobbies.get(p.lobby);
    p.lobby = null;
    if (!L) return;
    L.members.delete(p.id);
    dirty.delete(p.id);
    listDirty = true;
    if (!quiet) toLobby(L, { t: 'leave', peer: p.id });
    checkState(L);
  }
  function enterLobby(p, L) {
    if (p.lobby === L.id) return;
    leaveLobby(p);
    p.lobby = L.id;
    send(p, { t: 'entered', lobby: lobbyPub(L), peers: [...L.members.values()].map(pub), chat: L.chat });
    L.members.set(p.id, p);
    listDirty = true;
    toLobby(L, { t: 'join', peer: pub(p) }, p);
    tidy();
  }
  // Mag deze peer erbij? Zo niet: de reden.
  function why(p, L) {
    if (!L) return 'gone';
    if (busy(p)) return 'busy';
    if (L.state !== 'open') return 'started';
    if (L.members.size >= LOBBY_MAX) return 'full';
    return null;
  }
  function join(p, m) {
    const L = lobbies.get(String(m.id || ''));
    if (L && p.lobby === L.id) return;
    const no = why(p, L);
    if (no) return deny(p, no, m.id);
    enterLobby(p, L);
  }
  function create(p, m) {
    if (busy(p)) return deny(p, 'busy');
    if (lobbies.size >= LOBBIES_MAX) return deny(p, 'many');
    const now = Date.now();
    if (now - p.lastCreate < CREATE_GAP_MS) return deny(p, 'slow');
    p.lastCreate = now;
    enterLobby(p, makeLobby(cleanLobbyName(m.name) || p.name + "'s lobby", p.by));
  }
  function leave(p) {
    if (!p.lobby || busy(p)) return;
    leaveLobby(p);
    send(p, { t: 'entered', lobby: null, peers: [], chat: [] });
    tidy();
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
    let id = null, back = null;
    const r = m.resume;
    if (r && typeof r.peer === 'string' && typeof r.key === 'string') {
      const old = resumable.get(r.peer);
      if (old && old.key === r.key && old.until > Date.now() && !peers.has(r.peer)) { id = r.peer; back = old.lobby; resumable.delete(id); }
    }
    while (!id || peers.has(id)) id = crypto.randomBytes(6).toString('hex');
    p.id = id;
    p.key = crypto.randomBytes(12).toString('base64url');
    p.by = user ? user.id : null;
    p.name = user ? user.name : guestName(id);
    p.presence = Object.create(null);
    applyPatch(p, m.presence);
    clearTimeout(p.helloTimer);
    // Terug na een hapering: je eigen lobby, ook als die al begonnen is. Anders de lobby waar je om vraagt, als dat mag.
    let L = back ? lobbies.get(back) : null;
    if (!L && typeof m.lobby === 'string') { const want = lobbies.get(m.lobby); if (want && !why(p, want)) L = want; }
    if (L) { p.lobby = L.id; L.members.set(p.id, p); listDirty = true; }
    peers.set(p.id, p);
    send(p, {
      t: 'welcome', peer: p.id, key: p.key, you: { by: p.by, name: p.name }, now: Date.now(),
      lobby: L ? lobbyPub(L) : null, lobbies: lobbyList(),
      peers: L ? [...L.members.values()].filter(o => o !== p).map(pub) : [], chat: L ? L.chat : [],
      board: getBoard(), settings: settings.get(),
    });
    if (L) { toLobby(L, { t: 'join', peer: pub(p) }, p); checkState(L, p.presence); }
    tidy();
  }

  function chat(p, m) {
    const L = p.lobby && lobbies.get(p.lobby);
    const text = cleanMsg(m.text), now = Date.now();
    if (!L || !text || now - p.lastChat < CHAT_GAP_MS || !settings.get().chatEnabled) return;
    p.lastChat = now;
    const msg = { id: ++chatNo, ts: now, by: p.by, name: p.name, peer: p.id, text };
    L.chat.push(msg);
    if (L.chat.length > CHAT_KEEP) L.chat.splice(0, L.chat.length - CHAT_KEEP);
    toLobby(L, { t: 'chat', m: msg });
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
      if (!ch) return;
      const L = p.lobby && lobbies.get(p.lobby);
      if (!L) return;
      dirty.set(p.id, Object.assign(dirty.get(p.id) || {}, ch));
      if ('go' in ch || 'st' in ch) checkState(L, ch);
    } else if (m.t === 'chat') chat(p, m);
    else if (m.t === 'join') join(p, m);
    else if (m.t === 'create') create(p, m);
    else if (m.t === 'leave') leave(p);
  }

  function onClose(p) {
    clearTimeout(p.helloTimer);
    const n = (perIp.get(p.ip) || 1) - 1;
    if (n > 0) perIp.set(p.ip, n); else perIp.delete(p.ip);
    if (!p.id || peers.get(p.id) !== p) return;
    peers.delete(p.id);
    dirty.delete(p.id);
    // Wie midden in een potje wegvalt, mag terug in zijn lobby, ook al zit die op slot.
    resumable.set(p.id, { key: p.key, until: Date.now() + RESUME_MS, lobby: busy(p) ? p.lobby : null });
    const L = p.lobby && lobbies.get(p.lobby);
    leaveLobby(p, true);
    if (L) toLobby(L, { t: 'leave', peer: p.id });
    tidy();
  }

  wss.on('connection', (ws, req) => {
    const p = { ws, ip: req.ip, id: null, key: null, by: null, name: '', presence: null, lobby: null, alive: true, winAt: 0, winN: 0, lastChat: 0, lastCreate: 0 };
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
    if (listDirty) { listDirty = false; broadcast({ t: 'lobbies', list: lobbyList() }); }
    if (!dirty.size) return;
    const per = new Map();
    for (const [id, d] of dirty) {
      const p = peers.get(id), L = p && p.lobby && lobbies.get(p.lobby);
      if (!L) continue;
      if (!per.has(L)) per.set(L, {});
      per.get(L)[id] = d;
    }
    dirty = new Map();
    for (const [L, u] of per) toLobby(L, { t: 'p', u });
  }, TICK_MS);

  const ping = setInterval(() => {
    const now = Date.now();
    let gone = false;
    for (const [id, r] of resumable) if (r.until < now) { resumable.delete(id); gone = true; }
    if (gone) { for (const L of lobbies.values()) checkState(L); tidy(); }
    for (const ws of wss.clients) {
      const p = ws._peer;
      if (p && !p.alive) { ws.terminate(); continue; }
      if (p) p.alive = false;
      try { ws.ping(); } catch {}
    }
  }, PING_MS);

  ensureOpen();

  return {
    count: () => peers.size,
    lobbies: lobbyList,
    boardChanged() { broadcast({ t: 'board', rows: getBoard() }); },
    // Accounts die nu een verbinding open hebben.
    users() { const s = new Set(); for (const p of peers.values()) if (p.by) s.add(p.by); return s; },
    settingsChanged() { broadcast({ t: 'settings', settings: settings.get() }); },
    // Een account is verwijderd: zijn verbindingen gaan dicht.
    kick(userId) { for (const p of peers.values()) if (p.by === userId) p.ws.close(1008, 'account verwijderd'); },
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
