'use strict';
// De wereld per map (client/js/world.js): hoeveel vestingen, waar ze liggen, de bruggen en waar doorgelaten vijanden heen gaan.
const test = require('node:test');
const assert = require('node:assert/strict');
const World = require('../../client/js/world.js');
const { MAPS, N } = require('../../client/js/data/maps.js');

const L = id => World.build(MAPS[id]);

test('elke map heeft zijn eigen aantal vestingen', () => {
  assert.equal(L('classic').n, 25);
  assert.equal(L('relay').n, 25);
  assert.equal(L('wintermaul').n, 10);
  assert.equal(L('circle').n, 12);
  assert.equal(L('maze').n, 16);
});

test('Wintermaul: een piramide van 4, 3, 2 en 1, en de vijanden lopen zoals afgesproken', () => {
  // vesting 1 is index 0. 1 → 5; 2 → 5 en 6; 3 → 6 en 7; 4 → 7; 5 → 8; 6 → 8 en 9; 7 → 9; 8 en 9 → 10; 10 is het einde.
  const want = [[5], [5, 6], [6, 7], [7], [8], [8, 9], [9], [10], [10], []];
  const w = L('wintermaul');
  assert.deepEqual(w.next.map(a => a.map(i => i + 1)), want);
  // elke rij is een halve vesting ingesprongen ten opzichte van de rij erboven
  assert.equal(w.pos[4][0] - w.pos[0][0], 10);
  assert.equal(w.pos[9][0] - w.pos[7][0], 10);
  assert.equal(w.bridges.length, 12, 'een brug voor elke doorgang');
});

test('Estafette: losse banen, elke vesting geeft door aan die rechts van haar', () => {
  const w = L('relay');
  for (let s = 0; s < 25; s++) assert.deepEqual(w.next[s], s % 5 < 4 ? [s + 1] : []);
  assert.equal(w.bridges.length, 20, 'alleen bruggen naar rechts');
});

test('Groene Cirkel: een ring van twaalf met een reactor in het midden', () => {
  const w = L('circle');
  assert.ok(w.hub, 'er is een midden');
  assert.equal(w.bridges.length, 12, 'een gesloten ring');
});

test('vestingen overlappen nooit en bruggen beginnen en eindigen bij een poort', () => {
  for (const id of Object.keys(MAPS)) {
    const w = L(id);
    for (let a = 0; a < w.n; a++) for (let b = a + 1; b < w.n; b++) {
      const [ax, az] = w.pos[a], [bx, bz] = w.pos[b];
      assert.ok(Math.abs(ax - bx) >= N + 3 || Math.abs(az - bz) >= N + 3, `${id}: vesting ${a + 1} en ${b + 1} liggen te dicht bij elkaar`);
    }
    for (const br of w.bridges) assert.ok(br.length >= 2, id + ': een brug heeft minstens twee punten');
    // op een brug kun je lopen
    const b = w.bridges[0], m = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
    assert.ok(World.onBridge(w, m[0], m[1]), id + ': midden van een brug is beloopbaar');
  }
});
