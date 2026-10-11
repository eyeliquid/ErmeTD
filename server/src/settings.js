'use strict';
// Spelinstellingen die de beheerder in de webadmin kan wijzigen. Ze staan in de database en gaan naar elke browser.
// De grenzen hier zijn dezelfde als in Engine.tune (client/js/engine.js).
const FIELDS = {
  startGold:        { type: 'int',  min: 0,   max: 100000, def: 10000 }, // testwaarde uit de spelregels; 260 voor de definitieve versie
  lives:            { type: 'int',  min: 1,   max: 999,    def: 20 },
  prepSeconds:      { type: 'int',  min: 10,  max: 1800,   def: 300 },
  enemyHp:          { type: 'num',  min: 0.25, max: 5,     def: 1 },
  goldMul:          { type: 'num',  min: 0.25, max: 5,     def: 1 },
  registrationOpen: { type: 'bool', def: true },
  chatEnabled:      { type: 'bool', def: true },
  motd:             { type: 'text', max: 200, def: '' },
};

const defaults = () => Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.def]));

// Eén waarde controleren. Geeft undefined bij iets onbruikbaars.
function cleanValue(f, v) {
  if (f.type === 'bool') return typeof v === 'boolean' ? v : undefined;
  if (f.type === 'text') {
    if (typeof v !== 'string') return undefined;
    return v.replace(/[\u0000-\u001f\u007f\u2028-\u202e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, f.max);
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const n = f.type === 'int' ? Math.round(v) : Math.round(v * 100) / 100;
  return n < f.min || n > f.max ? undefined : n;
}

function createSettings(db) {
  const q = {
    all: db.prepare('SELECT key, value FROM settings'),
    put: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
  };
  let cur = defaults();
  for (const r of q.all.all()) {
    const f = FIELDS[r.key];
    if (!f) continue;
    let v;
    try { v = cleanValue(f, JSON.parse(r.value)); } catch {}
    if (v !== undefined) cur[r.key] = v;
  }
  return {
    get: () => ({ ...cur }),
    defaults,
    // Wijzigt alleen de meegegeven velden. Geeft de naam van het eerste ongeldige veld terug, of null als alles is opgeslagen.
    update(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return '(alles)';
      const next = {};
      for (const k of Object.keys(patch)) {
        const f = FIELDS[k];
        if (!f) continue;
        const v = cleanValue(f, patch[k]);
        if (v === undefined) return k;
        next[k] = v;
      }
      for (const k of Object.keys(next)) q.put.run(k, JSON.stringify(next[k]));
      cur = { ...cur, ...next };
      return null;
    },
  };
}

module.exports = { createSettings, FIELDS };
