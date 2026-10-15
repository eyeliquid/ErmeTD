'use strict';
// Controle van de databestanden in client/js/data. Pas je een vijand, toren, map of thema aan, dan vangt deze test
// de meeste tikfouten op: een vergeten veld, een letter die al bestaat, een thema dat niet bestaat.
// Draai hem met `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = ['balance', 'towers', 'enemies', 'skills', 'heroes', 'maps', 'forts', 'themes']
  .reduce((o, f) => Object.assign(o, require('../../client/js/data/' + f + '.js')), {});
const E = require('../../client/js/engine.js');

const hex = v => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
const num = v => typeof v === 'number' && Number.isFinite(v);

// Een nep-bouwdoos die bijhoudt welke bouwstenen een model gebruikt, zonder three.js.
function fakeKit() {
  const used = [];
  const part = name => (...a) => { used.push({ name, col: a.find(x => typeof x === 'string') }); return name; };
  const names = ['box', 'ball', 'rod', 'cyl', 'cone', 'gem', 'ring'], kit = {}, lit = {};
  for (const n of names) { kit[n] = part(n); lit[n] = part(n); }
  kit.lit = lit;
  kit.light = (x, y, z, col, size) => { used.push({ name: 'light', col: col || '#ffffff', pos: [x, y, z] }); return 'light'; };
  kit.fire = (x, y, z, size) => { used.push({ name: 'fire', col: '#ffffff', pos: [x, y, z] }); return 'fire'; };
  return { used, kit };
}

test('vijanden: alle velden kloppen en elke vijand heeft een eigen letter', () => {
  const codes = new Set();
  for (const [k, e] of Object.entries(D.EN)) {
    assert.ok(e.n, k + ': naam');
    for (const f of ['hp', 'sp', 'b', 'bar']) assert.ok(num(e[f]) && e[f] > 0, `${k}: ${f} is een getal boven 0`);
    assert.ok(typeof e.code === 'string' && e.code.length === 1, k + ': code is één letter');
    assert.ok(!codes.has(e.code), `${k}: letter ${e.code} is al van een andere vijand`);
    codes.add(e.code);
    const { kit, used } = fakeKit();
    const parts = e.model(kit);
    assert.ok(Array.isArray(parts) && parts.length, k + ': model geeft onderdelen');
    for (const u of used) assert.ok(hex(u.col), `${k}: kleur ${u.col} is een #rrggbb-kleur`);
  }
});

test('golven: elke golf van 1 tot het laatste level bestaat alleen uit bekende vijanden', () => {
  for (let r = 1; r <= D.ROUNDS; r++) {
    const w = E.makeWave(r);
    assert.ok(w.length > 0, 'golf ' + r + ' is niet leeg');
    for (const s of w) assert.ok(D.EN[s.type], `golf ${r}: onbekende vijand ${s.type}`);
  }
});

test('torens: alle torens hebben een prijs en de sterk/zwak-lijst noemt alleen bestaande torens en vijanden', () => {
  for (const [k, t] of Object.entries(D.T)) {
    assert.ok(t.n && t.d, k + ': naam en uitleg');
    assert.ok(num(t.cost) && t.cost > 0, k + ': prijs');
  }
  for (const k of D.TYPES) assert.ok(D.T[k], 'TYPES noemt onbekende toren ' + k);
  for (const [tw, m] of Object.entries(D.VS)) {
    assert.ok(D.T[tw], 'VS noemt onbekende toren ' + tw);
    for (const [en, v] of Object.entries(m)) { assert.ok(D.EN[en], `VS.${tw} noemt onbekende vijand ${en}`); assert.ok(num(v) && v > 0); }
  }
});

test('talenten: unieke sleutels, en wat eerst vol moet bestaat', () => {
  const ids = new Set();
  for (const s of D.SKILLS) {
    assert.ok(!ids.has(s.id), 'dubbel talent ' + s.id); ids.add(s.id);
    assert.ok(s.tree === 'T' || s.tree === 'H', s.id + ': boom T of H');
    assert.ok(s.max >= 1 && s.t >= 0 && s.t <= 6 && s.c >= 0 && s.c <= 3, s.id + ': plek en rangen');
  }
  for (const s of D.SKILLS) if (s.req) assert.ok(ids.has(s.req), `${s.id}: req ${s.req} bestaat niet`);
});

test('helden: zes velden per held en een bekende soort aanval', () => {
  for (const h of D.HEROES) {
    for (const f of ['hp', 'spd', 'range', 'dmg', 'rate']) assert.ok(num(h[f]) && h[f] > 0, `${h.id}: ${f}`);
    assert.ok(['gun', 'blade', 'bolt', 'slam', 'snipe', 'flame'].includes(h.k), h.id + ': soort aanval');
  }
  assert.equal(D.ARMOUR.length, 4, 'vier stukken harnas');
});

test('maps: elke map wijst naar een bestaand thema en de poorten liggen in een opening van de muur', () => {
  const { N, MID, GATE } = D;
  const inGap = c => { const x = c % N, y = (c - x) / N; return ((x === 0 || x === N - 1) && y === MID) || ((y === 0 || y === N - 1) && x === GATE); };
  for (const [id, m] of Object.entries(D.MAPS)) {
    assert.equal(m.id, id, id + ': id gelijk aan de sleutel');
    assert.ok(m.n && m.k && m.d, id + ': naam, soort en uitleg');
    assert.ok(D.THEMES[m.theme], `${id}: thema ${m.theme} bestaat niet in data/themes.js`);
    assert.ok(inGap(m.in), id + ': de ingang ligt in een opening van de muur');
    if (m.out >= 0) assert.ok(inGap(m.out), id + ': de uitgang ligt in een opening van de muur');
    if (m.pass) assert.ok(m.pass === 'row' || m.pass === 'col', id + ': pass is row of col');
    if (m.hard != null) assert.ok(num(m.hard) && m.hard > 0, id + ': hard is een getal boven 0');
    for (const c of m.block || []) {
      assert.ok(Number.isInteger(c) && c >= 0 && c < N * N, `${id}: muurtje ${c} ligt op het veld`);
      assert.ok(c !== m.in && c !== m.out, `${id}: een muurtje mag niet op de ingang of uitgang`);
    }
  }
});

test('thema\'s: kleuren zijn geldig, vijanden bestaan en modellen geven onderdelen', () => {
  const need = ['n', 'sky', 'fog', 'light', 'ground', 'road', 'trail', 'kerb', 'sea', 'wall', 'lamp', 'fire', 'music', 'ui'];
  const base = D.THEMES.alarm;
  for (const k of need) assert.ok(base[k] != null, 'alarm (de basis) mist ' + k);
  for (const [id, t] of Object.entries(D.THEMES)) {
    for (const k of ['sky', 'lamp', 'fire']) if (t[k] != null) assert.ok(hex(t[k]), `${id}.${k} is een #rrggbb-kleur`);
    if (t.ui) for (const k of ['accent', 'trim']) assert.ok(hex(t.ui[k]), `${id}.ui.${k}`);
    if (t.ground) assert.ok(['grass', 'lawn', 'snow', 'metal', 'meadow'].includes(t.ground.kind), `${id}: grondsoort ${t.ground.kind}`);
    if (t.road) assert.ok(['cobble', 'asphalt', 'plate', 'snow', 'flagstone'].includes(t.road.kind), `${id}: wegsoort ${t.road.kind}`);
    if (t.sea) assert.ok(['water', 'ice', 'void'].includes(t.sea.kind), `${id}: zeesoort ${t.sea.kind}`);
    if (t.particles) assert.ok(['snow', 'motes', 'sparks'].includes(t.particles.kind), `${id}: deeltjes ${t.particles.kind}`);
    for (const [en, o] of Object.entries(t.enemies || {})) {
      assert.ok(D.EN[en], `${id}: onbekende vijand ${en}`);
      if (o.paint) for (const [a, b] of Object.entries(o.paint)) assert.ok(hex(a) && hex(b), `${id}.${en}: paint ${a} → ${b}`);
      if (o.model) { const { kit } = fakeKit(); assert.ok(o.model(kit).length, `${id}.${en}: model`); }
    }
    if (t.fort != null) assert.ok(D.FORTS[t.fort], `${id}: burcht ${t.fort} bestaat niet in data/forts.js`);
  }
});

test('burchten: elk stuk bestaat, geeft onderdelen met geldige kleuren en blijft van het speelveld af', () => {
  const pieces = ['base', 'wall', 'corner', 'gate', 'hq', 'factory', 'lamp', 'bridge', 'block'];
  for (const [id, F] of Object.entries(D.FORTS)) {
    assert.ok(F.n, id + ': naam');
    assert.ok(['stone', 'metal', 'plain'].includes(F.mat), id + ': mat is stone, metal of plain');
    if (F.band) assert.ok(F.band.length === 4 && F.band.every(num), id + ': band = [breed, hoog, diep, hoogte]');
    for (const p of pieces) {
      assert.equal(typeof F[p], 'function', `${id}: stuk ${p} ontbreekt`);
      const runs = p === 'gate' ? ['in', 'out', 'side'] : p === 'wall' || p === 'bridge' ? [6.3] : [undefined];
      for (const arg of runs) {
        const { kit, used } = fakeKit();
        const parts = [F[p](kit, arg)].flat(4);
        assert.ok(parts.length, `${id}.${p}: geeft onderdelen`);
        for (const u of used) assert.ok(hex(u.col), `${id}.${p}: kleur ${u.col} is een #rrggbb-kleur`);
      }
    }
    // een muur en een poort mogen niet verder dan 0,5 naar binnen (+z) steken, anders staan ze op het speelveld
    for (const [p, arg] of [['wall', 6.3], ['gate', 'in'], ['gate', 'out'], ['gate', 'side']]) {
      const inner = [];
      const k = {}, lit = {}, at = (col, z, d) => inner.push(z + (d || 0) / 2);
      k.box = lit.box = (w, h, d, col, x, y, z) => at(col, z, d);
      for (const n of ['ball', 'rod', 'cyl', 'cone', 'gem', 'ring']) k[n] = lit[n] = () => {};
      k.lit = lit; k.light = () => {}; k.fire = () => {};
      F[p](k, arg);
      assert.ok(Math.max(...inner) <= .5, `${id}.${p}(${arg}): steekt ${Math.max(...inner).toFixed(2)} naar binnen, maximaal 0,5`);
    }
  }
});

test('muziek: elk thema heeft een muziekstijl die bestaat', () => {
  global.window = global.window || { AudioContext: undefined };
  global.document = global.document || { hidden: false };
  global.addEventListener = global.addEventListener || (() => {});
  global.localStorage = global.localStorage || { getItem: () => null, setItem: () => {} };
  const Music = require('../../client/js/music.js');
  for (const [id, t] of Object.entries(D.THEMES)) assert.ok(Music.STYLES[t.music || 'alarm'], `${id}: muziekstijl ${t.music}`);
});
