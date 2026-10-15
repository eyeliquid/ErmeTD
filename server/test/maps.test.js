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
    assert.equal(G.path.cells[0], M.in, id);
    if (M.out >= 0) assert.equal(G.path.cells.at(-1), M.out, id);
    for (let i = 1; i < G.path.cells.length; i++) {
      const a = G.path.cells[i - 1], b = G.path.cells[i];
      assert.equal(Math.abs(a % E.N - b % E.N) + Math.abs(Math.floor(a / E.N) - Math.floor(b / E.N)), 1, id + ': aaneengesloten');
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
