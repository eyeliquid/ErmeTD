'use strict';
// Draait de echte server op een vrije poort met een database in het geheugen.
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createServer } = require('../src/index');

let s, base, wsBase;
test.before(async () => {
  s = createServer({ dbFile: ':memory:' });
  await new Promise(r => s.server.listen(0, '127.0.0.1', r));
  const { port } = s.server.address();
  base = `http://127.0.0.1:${port}`; wsBase = `ws://127.0.0.1:${port}/ws`;
});
test.after(() => s.close());

async function api(method, path, body, token) {
  const res = await fetch(base + '/api' + path, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

// Een lobbyverbinding die berichten verzamelt en op een bepaald bericht kan wachten.
function peer(token, presence = {}, resume = null) {
  const ws = new WebSocket(wsBase), got = [], waiters = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token, presence, resume })));
  ws.on('message', d => {
    const m = JSON.parse(d.toString()); got.push(m);
    for (const w of [...waiters]) if (w.fn(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  return {
    ws, got,
    wait: (fn, ms = 2000) => new Promise((resolve, reject) => {
      const hit = got.find(fn); if (hit) return resolve(hit);
      const w = { fn, resolve }; waiters.push(w);
      setTimeout(() => reject(new Error('geen bericht ontvangen')), ms).unref();
    }),
    send: o => ws.send(JSON.stringify(o)),
    close: () => new Promise(r => { ws.on('close', r); ws.close(); }),
  };
}

test('de frontend en de gezondheidscheck zijn bereikbaar', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Red Alert Towerdefense/);
  assert.equal((await api('GET', '/health')).body.ok, true);
});

test('account maken, inloggen en uitloggen', async () => {
  assert.equal((await api('POST', '/register', { name: 'x', password: 'geheim123' })).status, 400);
  assert.equal((await api('POST', '/register', { name: 'Tanya', password: 'kort' })).status, 400);
  const reg = await api('POST', '/register', { name: 'Tanya', password: 'geheim123' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.name, 'Tanya');
  // dezelfde roepnaam in andere hoofdletters is bezet
  assert.equal((await api('POST', '/register', { name: 'tanya', password: 'geheim123' })).status, 409);
  assert.equal((await api('POST', '/login', { name: 'Tanya', password: 'verkeerd!' })).status, 401);
  assert.equal((await api('POST', '/login', { name: 'Bestaatniet', password: 'geheim123' })).status, 401);
  const login = await api('POST', '/login', { name: 'TANYA', password: 'geheim123' });
  assert.equal(login.status, 200);
  assert.equal((await api('GET', '/me', null, login.body.token)).body.user.id, reg.body.user.id);
  assert.equal((await api('POST', '/logout', null, login.body.token)).status, 200);
  assert.equal((await api('GET', '/me', null, login.body.token)).status, 401);
  assert.equal((await api('GET', '/me', null, reg.body.token)).status, 200);
  assert.equal((await api('GET', '/me')).status, 401);
});

test('voortgang wordt gecontroleerd en gaat nooit achteruit', async () => {
  const { token } = (await api('POST', '/register', { name: 'Saver', password: 'geheim123' })).body;
  const put = await api('PUT', '/save', { save: { v: 2, pts: 3, earned: 5, games: 2, best: 900, hero: 9, at: 1000, skills: { nep: 4, war: 99 } } }, token);
  assert.equal(put.status, 200);
  const sv = put.body.save;
  assert.equal(sv.hero, 5);
  assert.equal(sv.skills.nep, undefined);
  assert.ok(sv.skills.war >= 1 && sv.skills.war < 99);
  assert.ok(sv.earned >= sv.pts + sv.skills.war);
  assert.deepEqual((await api('GET', '/me', null, token)).body.save, sv);
  const older = await api('PUT', '/save', { save: { v: 2, pts: 0, earned: 0, skills: {} } }, token);
  assert.equal(older.body.kept, true);
  assert.deepEqual(older.body.save, sv);
  assert.equal((await api('PUT', '/save', { save: 'x' }, token)).status, 400);
  assert.equal((await api('PUT', '/save', { save: {} })).status, 401);
});

test('het leaderboard bewaart de beste score per speler', async () => {
  const a = (await api('POST', '/register', { name: 'Alfa', password: 'geheim123' })).body;
  const b = (await api('POST', '/register', { name: 'Bravo', password: 'geheim123' })).body;
  assert.equal((await api('POST', '/scores', { score: 500, round: 7 })).status, 401);
  assert.equal((await api('POST', '/scores', { score: -1 }, a.token)).status, 400);
  await api('POST', '/scores', { score: 500, round: 7, won: false }, a.token);
  await api('POST', '/scores', { score: 300, round: 5, won: false }, a.token);
  await api('POST', '/scores', { score: 900, round: 100, won: true }, b.token);
  const rows = (await api('GET', '/scores')).body.rows;
  assert.deepEqual(rows.map(r => [r.name, r.score, r.won]), [['Bravo', 900, true], ['Alfa', 500, false]]);
});

test('lobby: spelers zien elkaar, presence en chat komen door', async () => {
  const acc = (await api('POST', '/register', { name: 'Lobbyist', password: 'geheim123' })).body;
  const a = peer(acc.token, { st: 'lobby', t: 1 });
  const wa = await a.wait(m => m.t === 'welcome');
  assert.equal(wa.you.name, 'Lobbyist');
  assert.equal(wa.you.by, acc.user.id);
  assert.ok(Array.isArray(wa.board));

  const b = peer(null, { st: 'lobby', t: 2 });
  const wb = await b.wait(m => m.t === 'welcome');
  assert.equal(wb.you.by, null);
  assert.match(wb.you.name, /^Gast /);
  assert.deepEqual(wb.peers.map(p => [p.peer, p.name, p.presence.st]), [[wa.peer, 'Lobbyist', 'lobby']]);
  const join = await a.wait(m => m.t === 'join');
  assert.equal(join.peer.peer, wb.peer);

  // wijziging, en null haalt een veld weg
  b.send({ t: 'p', d: { rd: true, go: 123 } });
  const p1 = await a.wait(m => m.t === 'p' && m.u[wb.peer] && m.u[wb.peer].rd === true);
  assert.equal(p1.u[wb.peer].go, 123);
  b.send({ t: 'p', d: { go: null, __proto__: { x: 1 }, ['k'.repeat(40)]: 1 } });
  const p2 = await a.wait(m => m.t === 'p' && m.u[wb.peer] && m.u[wb.peer].go === null);
  assert.deepEqual(Object.keys(p2.u[wb.peer]), ['go']);

  b.send({ t: 'chat', text: '  hallo\u0007 commandanten  ' });
  const c = await a.wait(m => m.t === 'chat');
  assert.equal(c.m.text, 'hallo  commandanten');
  assert.equal(c.m.peer, wb.peer);

  // roepnaam wijzigen komt live door
  await api('PATCH', '/account', { name: 'Veldheer' }, acc.token);
  assert.equal((await b.wait(m => m.t === 'name')).name, 'Veldheer');

  // een nieuwe score komt bij iedereen binnen
  await api('POST', '/scores', { score: 123456, round: 40 }, acc.token);
  const board = await b.wait(m => m.t === 'board' && m.rows.some(r => r.score === 123456));
  assert.equal(board.rows.find(r => r.score === 123456).name, 'Veldheer');

  // weggaan, en terugkomen op dezelfde plek
  await b.close();
  assert.equal((await a.wait(m => m.t === 'leave')).peer, wb.peer);
  const b2 = peer(null, { st: 'lobby' }, { peer: wb.peer, key: wb.key });
  const wb2 = await b2.wait(m => m.t === 'welcome');
  assert.equal(wb2.peer, wb.peer);
  assert.equal(wb2.chat.at(-1).text, 'hallo  commandanten');
  // met een verkeerde sleutel krijg je een nieuwe plek
  const c2 = peer(null, {}, { peer: wa.peer, key: 'fout' });
  assert.notEqual((await c2.wait(m => m.t === 'welcome')).peer, wa.peer);
  await Promise.all([a.close(), b2.close(), c2.close()]);
});
