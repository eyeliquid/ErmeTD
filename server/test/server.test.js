'use strict';
// Draait de echte server op een vrije poort met een database in het geheugen.
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createServer } = require('../src/index');

const ADMIN = 'beheer-geheim-1';
let s, base, wsBase;
test.before(async () => {
  s = createServer({ dbFile: ':memory:', adminPassword: ADMIN, registerPerHour: 100 });
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
  // de gekozen moeilijkheidsgraad gaat mee met de voortgang en blijft binnen de drie graden
  assert.equal(sv.diff, 0);
  assert.equal((await api('PUT', '/save', { save: { ...sv, diff: 2 } }, token)).body.save.diff, 2);
  assert.equal((await api('PUT', '/save', { save: { ...sv, diff: 7 } }, token)).body.save.diff, 2);
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

test('moeilijkheidsgraden: taaiere vijanden en een hogere score', () => {
  const E = require('../../client/js/engine.js');
  assert.deepEqual(E.DIFF.map(d => d.n), ['Geers', 'Super Geers', 'Alleen voor Geers']);
  assert.deepEqual(E.DIFF.map(d => d.score), [1, 1.25, 1.75]);
  // Eén ronde zonder torens: alles lekt, dus de score komt alleen van de rondebonus.
  const run = diff => {
    const G = E.create({}, diff); G.lives = 1e6; E.lock(G); E.startWave(G);
    let hp = 0, sp = 0;
    for (let i = 0; i < 6000 && G.phase === 'wave'; i++) { E.step(G, 1 / 30); for (const e of G.en) { hp = Math.max(hp, e.max); sp = Math.max(sp, e.sp); } }
    return { score: G.score, hp, sp, diff: G.diff };
  };
  const [a, b, c] = [0, 1, 2].map(run);
  assert.equal(a.score, 50);
  assert.equal(b.score, 63);
  assert.equal(c.score, 88);
  assert.ok(Math.abs(b.hp / a.hp - 1.35) < 1e-9 && Math.abs(c.hp / a.hp - 1.85) < 1e-9);
  assert.ok(b.sp > a.sp && c.sp > b.sp);
  // Een onbekende keuze valt terug binnen de drie graden.
  assert.equal(run(9).diff, 2);
  assert.equal(run('x').diff, 0);
  // Kills en de winstbonus tellen ook mee met de vermenigvuldiger.
  const G = E.create({}, 2); G.lives = 10; E.win(G);
  assert.equal(G.score, Math.round(7000 * 1.75));
});

test('webadmin: zit achter het beheerwachtwoord', async () => {
  const page = await fetch(base + '/admin');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Webadmin/);
  assert.equal((await api('GET', '/admin/overview')).status, 401);
  assert.equal((await api('GET', '/admin/overview', null, 'x'.repeat(43))).status, 401);
  assert.equal((await api('PUT', '/admin/settings', { settings: { lives: 5 } })).status, 401);
  assert.equal((await api('POST', '/admin/login', { password: 'verkeerd-wachtwoord' })).status, 401);
  // het token van een gewone speler geeft geen toegang
  const player = (await api('POST', '/register', { name: 'Nieuwsgierig', password: 'geheim123' })).body;
  assert.equal((await api('GET', '/admin/overview', null, player.token)).status, 401);
  const login = await api('POST', '/admin/login', { password: ADMIN });
  assert.equal(login.status, 200);
  assert.equal((await api('GET', '/admin/overview', null, login.body.token)).status, 200);
  assert.equal((await api('POST', '/admin/logout', null, login.body.token)).status, 200);
  assert.equal((await api('GET', '/admin/overview', null, login.body.token)).status, 401);
});

test('webadmin: zonder ADMIN_PASSWORD staat hij uit', async () => {
  const off = createServer({ dbFile: ':memory:', adminPassword: '' });
  await new Promise(r => off.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${off.server.address().port}/api/admin/login`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: '' }) });
  assert.equal(res.status, 503);
  await off.close();
});

test('webadmin: spelersoverzicht en acties op een speler', async () => {
  const admin = (await api('POST', '/admin/login', { password: ADMIN })).body.token;
  const p = (await api('POST', '/register', { name: 'Doelwit', password: 'geheim123' })).body;
  await api('PUT', '/save', { save: { v: 2, pts: 2, earned: 3, games: 4, hero: 3, skills: { dmg: 1 } } }, p.token);
  await api('POST', '/scores', { score: 4321, round: 12 }, p.token);
  const live = peer(p.token, { st: 'lobby' });
  await live.wait(m => m.t === 'welcome');

  const ov = (await api('GET', '/admin/overview', null, admin)).body;
  const row = ov.players.find(x => x.id === p.user.id);
  assert.deepEqual([row.name, row.games, row.points, row.spent, row.score, row.round, row.online], ['Doelwit', 4, 2, 1, 4321, 12, true]);
  assert.ok(row.createdAt > 0 && row.lastSeen > 0);
  assert.equal(JSON.stringify(ov).includes('scrypt'), false); // nooit wachtwoordhashes naar buiten

  // nieuw wachtwoord: oude sessie en oude wachtwoord werken niet meer
  assert.equal((await api('POST', `/admin/players/${p.user.id}/password`, { password: 'kort' }, admin)).status, 400);
  assert.equal((await api('POST', `/admin/players/${p.user.id}/password`, { password: 'nieuw-geheim' }, admin)).status, 200);
  assert.equal((await api('GET', '/me', null, p.token)).status, 401);
  assert.equal((await api('POST', '/login', { name: 'Doelwit', password: 'geheim123' })).status, 401);
  assert.equal((await api('POST', '/login', { name: 'Doelwit', password: 'nieuw-geheim' })).status, 200);

  assert.equal((await api('DELETE', `/admin/players/${p.user.id}/score`, null, admin)).status, 200);
  assert.equal((await api('GET', '/scores')).body.rows.some(r => r.id === p.user.id), false);

  const closed = new Promise(r => live.ws.on('close', r));
  assert.equal((await api('DELETE', `/admin/players/${p.user.id}`, null, admin)).status, 200);
  await closed; // de verbinding van een verwijderd account gaat dicht
  assert.equal((await api('POST', '/login', { name: 'Doelwit', password: 'nieuw-geheim' })).status, 401);
  assert.equal((await api('DELETE', `/admin/players/${p.user.id}`, null, admin)).status, 404);
  assert.equal((await api('GET', '/admin/overview', null, admin)).body.players.some(x => x.id === p.user.id), false);
});

test('webadmin: instellingen worden gecontroleerd, bewaard en naar de lobby gestuurd', async () => {
  const admin = (await api('POST', '/admin/login', { password: ADMIN })).body.token;
  assert.equal((await api('GET', '/settings')).body.settings.startGold, 10000);
  const a = peer(null, { st: 'lobby' });
  assert.equal((await a.wait(m => m.t === 'welcome')).settings.lives, 20);

  for (const bad of [{ lives: 0 }, { startGold: '260' }, { enemyHp: 99 }, { chatEnabled: 'ja' }, { prepSeconds: NaN }, 'x']) {
    assert.equal((await api('PUT', '/admin/settings', { settings: bad }, admin)).status, 400);
  }
  assert.equal((await api('GET', '/settings')).body.settings.lives, 20); // een afgekeurde wijziging verandert niets

  const put = await api('PUT', '/admin/settings', { settings: { startGold: 260, enemyHp: 1.5, registrationOpen: false, chatEnabled: false, motd: '  Toernooi\u0007 zaterdag  ', onbekend: 1 } }, admin);
  assert.equal(put.status, 200);
  assert.deepEqual(put.body.settings, { startGold: 260, lives: 20, prepSeconds: 300, enemyHp: 1.5, goldMul: 1, registrationOpen: false, chatEnabled: false, motd: 'Toernooi zaterdag' });
  assert.equal((await a.wait(m => m.t === 'settings')).settings.startGold, 260);
  assert.deepEqual((await api('GET', '/settings')).body.settings, put.body.settings);

  // registratie dicht: geen nieuwe accounts, bestaande spelers kunnen nog inloggen
  assert.equal((await api('POST', '/register', { name: 'Telaat', password: 'geheim123' })).status, 403);
  assert.equal((await api('POST', '/login', { name: 'Tanya', password: 'geheim123' })).status, 200);
  // chat uit: berichten komen niet door
  a.send({ t: 'chat', text: 'hoort niemand' });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(a.got.some(m => m.t === 'chat'), false);

  await api('PUT', '/admin/settings', { settings: { registrationOpen: true, chatEnabled: true, startGold: 10000, enemyHp: 1, motd: '' } }, admin);
  assert.equal((await api('POST', '/register', { name: 'Optijd', password: 'geheim123' })).status, 201);
  await a.close();
});

test('de spelregels nemen de instellingen over', () => {
  const Engine = require('../../client/js/engine.js');
  const hp = Engine.hpMul(10);
  Engine.tune({ startGold: 260, lives: 5, prepSeconds: 60, enemyHp: 2, goldMul: 9999 });
  const G = Engine.create({});
  assert.deepEqual([G.gold, G.lives, G.timer, Engine.PREP], [260, 5, 60, 60]);
  assert.equal(Engine.hpMul(10), hp * 2);
  assert.equal(Engine.B.goldX, 5); // buiten de grenzen wordt afgekapt
  Engine.tune({ startGold: 10000, lives: 20, prepSeconds: 300, enemyHp: 1, goldMul: 1 });
});

test('matchups: een toren doet anderhalf keer schade tegen sterk en de helft tegen zwak', () => {
  const Engine = require('../../client/js/engine.js');
  const G = Engine.create({});
  const mob = (type) => ({ type, hp: 1000, max: 1000, arm: 0, boss: false });
  const dmg = (tower, type) => { const e = mob(type); Engine.hit(G, e, 100, 0, tower); return 1000 - e.hp; };
  assert.equal(dmg('sentry', 'inf'), 150);
  assert.equal(dmg('sentry', 'tank'), 50);
  assert.equal(dmg('sentry', 'drone'), 100);
  assert.equal(dmg(undefined, 'tank'), 100);
  // elke vijand heeft minstens twee torens die er sterk tegen zijn, en elke toren is ergens sterk en ergens zwak
  for (const en of Object.keys(Engine.EN)) assert.ok(Engine.counters(en).length >= 2, en);
  for (const tw of Object.keys(Engine.VS)) { assert.ok(Engine.strongVs(tw).length >= 2, tw); assert.ok(Engine.weakVs(tw).length >= 2, tw); }
  // de voorvertoning telt dezelfde vijanden als de golf zelf
  for (const r of [1, 7, 10, 25, 100]) assert.equal(Engine.waveMix(r).reduce((n, o) => n + o.n, 0), Engine.makeWave(r).length);
});

test('de keten: 5 upgrades, ultra, turbo, Geers Toren (13 upgrades) en De Slapende Geers (3x3)', () => {
  const Engine = require('../../client/js/engine.js');
  const { N, TYPES } = Engine;
  const G = Engine.create({});
  G.gold = 1e9;
  const maxed = (c, type) => { const t = Engine.build(G, c, type); for (let k = 0; k < 5; k++) assert.equal(Engine.upgrade(G, t), true); return t; };
  // ultra pas na vijf upgrades, en geen zesde upgrade
  const a = Engine.build(G, 1 * N + 1, 'sentry');
  assert.equal(Engine.spec(G, a, 'ultra'), false);
  for (let k = 0; k < 5; k++) Engine.upgrade(G, a);
  assert.equal(Engine.upgrade(G, a), false);
  assert.equal(Engine.spec(G, a, 'turbo'), false); // eerst ultra
  const before = a.s.dmg;
  assert.equal(Engine.spec(G, a, 'ultra'), true);
  assert.ok(a.s.dmg > before);
  // turbo vraagt om een andere ultra toren
  assert.equal(Engine.canTurbo(G, a), false);
  assert.equal(Engine.spec(G, a, 'turbo'), false);
  const b = maxed(1 * N + 3, 'flak');
  assert.equal(Engine.spec(G, a, 'turbo'), false); // b is nog geen ultra
  Engine.spec(G, b, 'ultra');
  assert.equal(Engine.spec(G, a, 'turbo'), true);
  assert.equal(Engine.spec(G, b, 'turbo'), true); // een turbo telt ook als ultra
  // Geers Toren: pas als elke soort een turbo heeft
  assert.equal(Engine.build(G, 3 * N + 1, 'geers'), null);
  TYPES.slice(2).forEach((type, i) => { const t = maxed(1 * N + 5 + i, type); Engine.spec(G, t, 'ultra'); assert.equal(Engine.spec(G, t, 'turbo'), true); });
  assert.deepEqual(Engine.missingTurbo(G), []);
  const gs = [0, 1, 2, 3].map((i) => Engine.build(G, 3 * N + 1 + i * 2, 'geers'));
  assert.ok(gs.every(Boolean));
  for (let k = 0; k < 13; k++) assert.equal(Engine.upgrade(G, gs[0]), true);
  assert.equal(Engine.upgrade(G, gs[0]), false);
  assert.equal(gs[0].lvl, 13);
  assert.equal(Engine.spec(G, gs[0], 'ultra'), false);
  // De Slapende Geers: vier Geers Torens, 3x3 vakken, en maar een
  Engine.sell(G, gs[3]);
  assert.equal(Engine.build(G, 10 * N + 5, 'sleeper'), null);
  Engine.build(G, 3 * N + 7, 'geers');
  assert.equal(Engine.build(G, 12 * N + 5, 'sleeper'), null); // past niet binnen het veld
  const z = Engine.build(G, 10 * N + 5, 'sleeper');
  assert.equal(z.cells.length, 9);
  assert.ok(z.cells.every((c) => G.map[c] === z));
  assert.equal(Engine.canBuild(G, 9 * N + 4), false);
  assert.equal(Engine.build(G, 10 * N + 9, 'sleeper'), null);
  // hij vertraagt en beschadigt alles binnen bereik, ook wie immuun is voor gif en ijs
  Engine.lock(G); Engine.startWave(G);
  const e = { id: 99, type: 'haz', hp: 1e6, max: 1e6, d: 6, sp: 1, arm: 0, regen: 0, immune: true, boss: false, leak: 1, b: 1, sc: 1, x: 5.5, y: 6.5, fz: 0, fi: 0, sT: 0, sl: 0, pT: 0, pD: 0 };
  G.q = []; G.en.push(e);
  Engine.step(G, .05);
  assert.ok(e.hp < 1e6 && e.sT > 0 && e.sl >= .6);
  // verkopen maakt alle negen vakken weer vrij
  Engine.sell(G, z);
  assert.ok(z.cells.every((c) => !G.map[c]));
  assert.equal(Engine.T.omega, undefined);
  // punten in de oude skill Geers-overdrive gaan mee naar Turbo-overdrive
  const { cleanSave } = require('../src/validate');
  assert.equal(cleanSave({ pts: 0, skills: { geers: 3 } }).skills.overdrive, 3);
});

test('duwen en sprinten: de skills schuiven de waarden op', () => {
  const Engine = require('../../client/js/engine.js');
  assert.deepEqual([Engine.MOVES.pushCd, Engine.MOVES.sprDur, Engine.MOVES.sprCd], [6, 3, 10]);
  const m0 = Engine.mods({}), m = Engine.mods({ pushr: 3, pushcd: 2, sprint: 3, sprintcd: 3, sprintspd: 3 });
  assert.deepEqual([m0.pushDist, m0.pushCd, m0.sprDur, m0.sprCd, m0.sprSpd], [1, 0, 0, 0, 0]);
  assert.ok(Math.abs(m.pushDist - 1.45) < 1e-9 && Math.abs(m.sprSpd - .3) < 1e-9);
  assert.deepEqual([m.pushCd, m.sprDur, m.sprCd], [2, 1.5, 3]);
  // geen twee talenten op dezelfde plek in de boom
  const seen = new Set();
  for (const s of Engine.SKILLS) { const k = s.tree + s.t + '-' + s.c; assert.ok(!seen.has(k), k); seen.add(k); }
});
