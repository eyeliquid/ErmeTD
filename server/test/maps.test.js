'use strict';
// De maps uit de spelregels: route, ring, doolhof en doorgeven.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../client/js/engine.js');

const play = (G, secs) => { for (let i = 0; i < secs * 30; i++) E.step(G, 1 / 30); };

test('elke map heeft een route van de ingang naar de uitgang', () => {
  for (const id of E.MAP_IDS) {
    const G = E.create({}, 0, id);
    E.lock(G);
    const M = E.MAPS[id];
    // vaste wegen: elke weg apart; anders de ene route
    for (const P of G.paths || [G.path]) {
      if (!G.paths) assert.equal(P.cells[0], M.in, id);
      if (M.out >= 0) assert.equal(P.cells.at(-1), M.out, id);
      for (let i = 1; i < P.cells.length; i++) {
        const a = P.cells[i - 1], b = P.cells[i];
        assert.equal(Math.abs(a % E.N - b % E.N) + Math.abs(Math.floor(a / E.N) - Math.floor(b / E.N)), 1, id + ': aaneengesloten');
      }
    }
  }
});

test('een onbekende map wordt Klassiek', () => {
  assert.equal(E.create({}, 0, 'bestaat-niet').mp.id, 'classic');
  assert.equal(E.create({}, 0).mp.id, 'classic');
});

test('alleen Klassiek en Estafette hebben een weg', () => {
  for (const id of E.MAP_IDS) {
    const G = E.create({}, 0, id);
    const c = E.N * 3 + 4;
    assert.equal(E.setRoad(G, c, true), !!E.MAPS[id].roads, id);
  }
});

test('Groene Cirkel: de vijand blijft rondjes lopen en elk rondje kost een leven', () => {
  const G = E.create({}, 0, 'circle');
  E.lock(G);
  G.phase = 'build'; G.timer = 0;
  E.step(G, 1 / 30);
  const lives = G.lives;
  // één vijand, onkwetsbaar genoeg om een paar rondjes te halen
  G.q = []; G.en = [];
  E.inject(G, 'inf', 1);
  G.en[0].hp = G.en[0].max = 1e9;
  play(G, 90);
  assert.equal(G.en.length, 1, 'hij leeft nog');
  assert.ok(G.lives < lives, 'rondjes kosten levens');
  assert.ok(G.en[0].d < G.path.len, 'hij loopt nog op de ring');
});

test('Groene Cirkel: op de ring kun je niet bouwen, ernaast wel', () => {
  const G = E.create({}, 0, 'circle');
  assert.equal(E.canBuild(G, E.RING[5], 'sentry'), false);
  assert.equal(E.canBuild(G, 6 * E.N + 6, 'sentry'), true);
});

test('Doolhof: torens op de route maken de weg langer, maar nooit dicht', () => {
  const G = E.create({}, 0, 'maze');
  G.gold = 1e6;
  E.lock(G);
  const before = G.path.len;
  // een muur dwars over het veld, boven de uitgang, met één gat helemaal rechts
  for (let x = 0; x < E.N - 1; x++) E.build(G, 9 * E.N + x, 'sentry');
  assert.ok(G.path.len > before, 'de route loopt om');
  assert.equal(E.canBuild(G, 9 * E.N + E.N - 1, 'sentry'), false, 'het laatste gat blijft open');
});

test('Doolhof: een nieuwe toren tijdens een golf laat lopende vijanden doorlopen vanaf hun plek', () => {
  const G = E.create({}, 0, 'maze');
  G.gold = 1e6;
  E.lock(G);
  G.phase = 'build'; G.timer = 0;
  E.step(G, 1 / 30);
  play(G, 4);
  const e = G.en.find(x => !x.dead);
  assert.ok(e);
  const x = e.x, y = e.y;
  const c = G.path.cells.find(k => E.canBuild(G, k, 'sentry'));
  assert.ok(E.build(G, c, 'sentry'));
  const p = E.posAt(G.path, e.d);
  assert.ok(Math.hypot(p[0] - x, p[1] - y) < 1.2, 'niet teruggezet naar het begin');
});

test('doorgeven: een vijand die wegloopt kost geen levens als de spellaag hem doorgeeft', () => {
  const G = E.create({}, 0, 'relay');
  E.lock(G);
  let passed = 0;
  G.pass = () => { passed++; return true; };
  G.phase = 'build'; G.timer = 0;
  const lives = G.lives;
  play(G, 60);
  assert.ok(passed > 0);
  assert.equal(G.lives, lives);
});

test('Wintermaul: bij een gedeelde levenspot beslist de spellaag over verlies', () => {
  const G = E.create({}, 0, 'wintermaul');
  E.lock(G);
  G.lives = 1;
  G.phase = 'build'; G.timer = 0;
  play(G, 60);
  assert.ok(G.lives <= 0);
  assert.notEqual(G.phase, 'over');
});

test('Wintermaul: de ijsmuurtjes laten de vijand zigzaggen en je kunt er niet op bouwen', () => {
  const G = E.create({}, 0, 'wintermaul');
  E.lock(G);
  const blk = E.blockOf(G.mp);
  assert.ok(blk.size > 0, 'er zijn muurtjes');
  assert.ok(G.path.len >= 40, 'de route is minstens 40 vakken lang, niet recht naar beneden (' + G.path.len + ')');
  for (const c of G.path.cells) assert.ok(!blk.has(c), 'de route loopt nooit over een muurtje');
  G.gold = 1e6;
  for (const c of blk) assert.equal(E.canBuild(G, c, 'sentry'), false, 'op een muurtje kun je niet bouwen');
});

test('moeilijkheid per map: de vijanden zijn taaier dan op Klassiek', () => {
  const hp = id => { const G = E.create({}, 0, id); E.lock(G); G.phase = 'build'; G.timer = 0; for (let i = 0; i < 60; i++) E.step(G, 1 / 30); return G.en[0].max; };
  const base = hp('classic');
  for (const [id, x] of [['relay', 1.5], ['wintermaul', 2], ['circle', 3], ['maze', 5]])
    assert.ok(Math.abs(hp(id) / base - x) < 1e-9, `${id}: ${x} keer zo veel levens als op Klassiek`);
});

test('Zandstorm: vier vaste wegen uit vier poorten naar de kern in het midden', () => {
  const G = E.create({}, 0, 'sand');
  E.lock(G);
  assert.equal(G.paths.length, 4);
  for (const P of G.paths) assert.equal(P.cells[P.cells.length - 1], E.MID * E.N + E.MID, 'elke weg eindigt in de kern');
  assert.equal(new Set(G.paths.map(P => P.cells[0])).size, 4, 'vier verschillende poorten');
  G.gold = 1e6;
  for (const c of G.path.set) assert.equal(E.canBuild(G, c, 'sentry'), false, 'op een weg bouw je niet');
  // de vijanden verdelen zich over de vier wegen
  G.phase = 'build'; G.timer = 0;
  play(G, 6);
  assert.ok(new Set(G.en.map(e => e.li)).size >= 3, 'vijanden op meerdere wegen');
  const lives = G.lives;
  for (const e of G.en) { e.hp = e.max = 1e9; }
  play(G, 60);
  assert.ok(G.lives < lives, 'wat de kern bereikt, kost levens');
});

test('Hemelrijk: de vijand vliegt recht over je torens heen en komt elke golf uit een andere richting', () => {
  const G = E.create({}, 0, 'sky');
  G.gold = 1e6;
  E.lock(G);
  const starts = [];
  for (let r = 1; r <= 4; r++) { G.round = r; G.phase = 'build'; E.startWave(G); starts.push(G.path.cells[0]); G.phase = 'build'; }
  assert.equal(new Set(starts).size, 4, 'vier richtingen');
  // een toren midden op de vlieglijn mag, en de lijn blijft recht
  G.round = 1; E.startWave(G);
  const before = G.path.len, mid = G.path.cells[6];
  G.phase = 'build';
  assert.ok(E.canBuild(G, mid, 'sentry'));
  E.build(G, mid, 'sentry');
  E.startWave(G);
  assert.equal(G.path.len, before, 'torens houden hem niet tegen');
});

test('Kaapvaart: elke derde kill gaat als tegenaanval naar de tegenstander', () => {
  const A = E.create({}, 0, 'pirates'), Bf = E.create({}, 0, 'pirates');
  E.lock(A); E.lock(Bf);
  let sent = 0;
  A.send = (g, e) => { g.n = (g.n | 0) + 1; if (g.n % 3 === 0) { E.inject(Bf, e.type, 1); sent++; } };
  A.phase = 'build'; A.timer = 0; Bf.phase = 'build'; Bf.timer = 0;
  E.step(A, 1 / 30); E.step(Bf, 1 / 30);
  play(A, 8);
  const alive = A.en.filter(e => !e.dead);
  for (const e of alive) E.hit(A, e, 1e9);
  assert.ok(A.kills >= 3);
  assert.equal(sent, Math.floor(A.kills / 3));
  assert.ok(Bf.en.some(e => e.passed), 'de tegenstander krijgt ze binnen');
});
