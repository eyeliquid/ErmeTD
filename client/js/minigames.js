// Dertig minigames. In een potje kiest game.js er op de tientallen een willekeurige uit (level 50 is altijd De Geers draait door);
// via de knop Minigames in de lobby speel je ze los.
//
// Elke minigame is een beschrijving:
//   id, n      sleutel en naam
//   isle       het eiland waarop hij gespeeld wordt: round (rond), square (vierkant), cross (kruis) of quad (vier eilandjes)
//   tier       1 redelijk makkelijk, 2 gemiddeld, 3 uitdagend, 4 heel uitdagend
//   T, goal    duur in seconden, en de score die je alleen spelend moet halen
//   d, win     uitleg en doel voor de keuzelijst; go is de melding bij de start
//   init(a)    zet de minigame klaar, upd(a,dt) draait elk beeld, sub(a,sec) is de regel in het opdrachtvenster
//   bot(a,m)   waar een bot nu heen wil; zie "bots" hieronder
// a is de toestand van de arena. De minigame vult a.pts (de score) en tekent door elk beeld lijsten te vullen:
// a.marks (cirkels op de grond), a.orbs (bollen), a.rects (rechthoeken op de grond), a.glows (gloeiende balken) en a.mobs (monsters en voorwerpen).
// a.fin = true beëindigt de minigame; met a.fail erbij is hij verloren. Verder: a.block(x,z) sluit grond af,
// a.slow remt of versnelt de held, a.ice geeft gladde grond, a.flip keert de besturing om, a.dark dooft het licht, a.haste versnelt de aanval.
// Niet gebruiken, want game.js leest ze voor de bazen en het doolhof: a.g, a.tw, a.shots, a.ult, a.B, a.sc, a.claim.
window.RATD_LAB = api => {
const { AR, ARM, QD, QR, TAU } = api, rand = Math.random, hyp = Math.hypot;
// CX, CZ: het midden van het eiland waar nu gespeeld wordt. game.js zet ze via center() zodra een minigame begint.
let CX = api.ACX, CZ = api.ACZ, ISLE = 'round';
const H = () => api.hero;
const dH = (x, z) => hyp(H().x - x, H().z - z);                       // afstand van de held tot een punt
const pol = (an, d) => ({ x: CX + Math.cos(an) * d, z: CZ + Math.sin(an) * d });
const pt = (r0, r1) => { const p = api.pt(r0, r1); return { x: p[0], z: p[1] }; };  // een willekeurige plek op het eiland, tussen r0 en r1 van het midden
// het kruis: loop je naar een andere arm, dan eerst naar het midden
const via = (m, x, z) => ISLE !== 'cross' || (Math.abs(m.z - CZ) <= ARM && Math.abs(z - CZ) <= ARM) || (Math.abs(m.x - CX) <= ARM && Math.abs(x - CX) <= ARM) ? { x, z } : { x: CX, z: CZ };
const walk = (m, x, z, sp, dt) => { const p = via(m, x, z); go(m, p.x, p.z, sp, dt); };
// de hele vloer van het eiland in één kleur: een schijf op het ronde eiland, een vlak op het vierkante
const floor = (a, col, op) => { if (ISLE === 'square') a.rects.push({ x: CX, z: CZ, w: 18.4, d: 18.4, col, op, y: .05 }); else mark(a, CX, CZ, 9.1, col, op, .05); };
const QP = () => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([p, q]) => ({ x: CX + p * QD, z: CZ + q * QD }));  // de middens van de vier eilandjes
const clampIn = (o, R) => { const dx = o.x - CX, dz = o.z - CZ, d = hyp(dx, dz); if (d > R) { o.x = CX + dx / d * R; o.z = CZ + dz / d * R; } };
// o een stap richting (x,z) zetten; geeft de afstand die daarna nog over is
const go = (o, x, z, sp, dt) => { const dx = x - o.x, dz = z - o.z, d = hyp(dx, dz); if (d < 1e-4) return 0; const mv = Math.min(d, sp * dt); o.x += dx / d * mv; o.z += dz / d * mv; o.a = Math.atan2(dz, dx); return d - mv; };
const mark = (a, x, z, r, col, op, y) => a.marks.push({ x, z, r, col, op: op == null ? .4 : op, y });
const orb = (a, x, z, y, s, col) => a.orbs.push({ x, z, y, s, col });
const rect = (a, x, z, w, d, col, op, rot) => a.rects.push({ x, z, w, d, col, op, rot });
const glow = (a, x, z, w, rot, col, op, th) => a.glows.push({ x, z, w, rot, col, op, h: th || .16, d: th || .16 });
const zone = (a, x, z, r, T, dmg) => a.zones.push({ x, z, r, t: T, T, dmg });
const add = (a, type, o) => { api.addMob(a, type, o); return a.mobs[a.mobs.length - 1]; };
const alive = (a, f) => { let n = 0; for (const m of a.mobs) if (m.hp > 0 && (!f || f(m))) n++; return n; };
const still = { sp: 0, dmg: 0, ai() {} };                              // een voorwerp: staat stil en doet niets
const prop = { hp: 1, pass: true, nobar: true, sp: 0, dmg: 0 };        // een voorwerp dat de held niet aanvalt
const survive = a => { a.pts = Math.min(a.T - 1, a.age); };            // score = seconden overeind
const left = sec => `Nog ${sec} s`;
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
// een vierkant veld van n bij n tegels rond het midden van de arena
const grid = (n, size) => { const half = n * size / 2; return { n, size, half,
  cell: (x, z) => { const cx = Math.floor((x - CX + half) / size), cz = Math.floor((z - CZ + half) / size); return cx < 0 || cz < 0 || cx >= n || cz >= n ? -1 : cz * n + cx; },
  pos: i => ({ x: CX - half + (i % n + .5) * size, z: CZ - half + (Math.floor(i / n) + .5) * size }),
  out: (x, z) => Math.abs(x - CX) > half || Math.abs(z - CZ) > half }; };
// de gewone monsters die op de held jagen
const hunters = (a, k) => { const q = rand(), hm = k && k.hp || 1, dm = k && k.dmg || 1, sm = k && k.sp || 1, v = k && k.val || 1, big = k && k.big;
  if (q < .55) api.addMob(a, 'dog', { hp: 35 * hm, sp: 3.9 * sm, dmg: 6 * dm, val: v });
  else if (q < .88) api.addMob(a, 'inf', { hp: 60 * hm, sp: 2.9 * sm, dmg: 8 * dm, val: v, every: 1.3 });
  else api.addMob(a, big ? 'mech' : 'tank', { hp: 180 * hm, sp: 1.9 * sm, dmg: 14 * dm, val: 2 * v, reach: 1.6, every: 1.8, big: !!big }); };
// kogels: rechtuit vliegende bollen. hit(b) wordt geroepen als er een de held raakt.
const bullets = (a, dt, col, rad, hit) => { for (let i = a.bs.length - 1; i >= 0; i--) { const b = a.bs[i]; b.x += b.vx * dt; b.z += b.vz * dt;
    if (hyp(b.x - CX, b.z - CZ) > AR + .3) { a.bs.splice(i, 1); continue; }
    if (dH(b.x, b.z) < rad) { a.bs.splice(i, 1); hit(b); continue; }
    orb(a, b.x, b.z, .6, .17, col); } };
const shoot = (a, an, v, r0) => a.bs.push({ x: CX + Math.cos(an) * (r0 || 1.3), z: CZ + Math.sin(an) * (r0 || 1.3), vx: Math.cos(an) * v, vz: Math.sin(an) * v });
// zagen: bollen die tussen twee punten heen en weer schuiven
const saw = (a, v) => { let p = pol(rand() * TAU, AR - 1), q = pol(rand() * TAU, AR - 1);
  if (ISLE === 'cross') { const an = Math.floor(rand() * 2) * Math.PI / 2, e = u => ({ x: CX + Math.cos(an) * 7.8 * u - Math.sin(an) * (rand() * 4 - 2), z: CZ + Math.sin(an) * 7.8 * u + Math.cos(an) * (rand() * 4 - 2) }); p = e(1); q = e(-1); }
  else if (hyp(p.x - q.x, p.z - q.z) < 7) return saw(a, v); a.saws.push({ p, q, w: v / hyp(p.x - q.x, p.z - q.z), ph: rand() * TAU }); };
const sawPos = (a, s) => { const f = .5 + .5 * Math.sin(a.age * s.w * 2 + s.ph); return { x: s.p.x + (s.q.x - s.p.x) * f, z: s.p.z + (s.q.z - s.p.z) * f }; };

// ---- bots ----
// Een bot speelt een minigame volgens dezelfde regels als een speler: game.js laat deze code voor hem lopen met hem als held.
// Het enige wat hij zelf inbrengt is bot(a, m): waar wil hij nu heen? Dat geeft een doel { x, z } terug, of niets als hij wil blijven staan.
// Erbij kan: sprint of shield (gebruik het nu), dodge (kogels om te ontwijken, met rad als straal en leash als plek waar hij bij moet blijven),
// en now (dit doel zag hij aankomen, dus geen reactietijd). m is zijn geheugen voor deze minigame, ai.skill hoe goed hij is (0 tot 1). Lopen, uit rode cirkels blijven en de weg
// over bruggen zoeken doet game.js; wat een bot onthoudt, vergeet of te laat ziet staat hier.
// het levende doelwit met de hoogste waarde f(m); zonder f het dichtstbijzijnde
const target = (a, f) => { let b = null, bv = -1e9; for (const m of a.mobs) { if (m.hp <= 0 || m.pass) continue; const v = f ? f(m) : -dH(m.x, m.z); if (v > bv) { bv = v; b = m; } } return b; };
// een plek van waaruit de held m kan raken: een melee-held erbovenop, een afstandsheld op driekwart van zijn bereik
// komt een monster een afstandsheld te na, dan wijkt hij terug, en bij de rand buigt hij af langs de rand
const reach = (t, keep) => { const h = H(), R = api.range(), d = dH(t.x, t.z) || 1, w = Math.max(.9, R * (keep || .75) + (t.big ? .4 : 0)), far = R >= 2.5 && t.dmg > 0;
  if (d <= w + .25 && d >= w * (far ? .8 : .45)) return { x: h.x, z: h.z }; if (d > w) return { x: t.x + (h.x - t.x) / d * w, z: t.z + (h.z - t.z) / d * w };
  let ux = (h.x - t.x) / d, uz = (h.z - t.z) / d; const rx = h.x - CX, rz = h.z - CZ, rc = hyp(rx, rz) || 1;
  if (!api.on(h.x + ux * 2, h.z + uz * 2, .4)) { const tx = -rz / rc, tz = rx / rc, s = tx * ux + tz * uz >= 0 ? 1 : -1; ux = tx * s - rx / rc * .4; uz = tz * s - rz / rc * .4; }
  return { x: h.x + ux * 2.2, z: h.z + uz * 2.2, now: true }; };
const stroll = (m, a, r1) => { if (!m.p || a.age > m.pt || dH(m.p.x, m.p.z) < .5) { m.p = pt(0, r1 || AR - 1.5); m.pt = a.age + 2 + rand() * 3; } return m.p; };
// vechten tegen monsters die op hem af komen. Raakt hij ingesloten of is hij bijna leeg, dan rent hij in een boog weg
const brawl = (a, m, R) => { const h = H(), t = target(a); if (!t) return stroll(m, a, (R || AR) - 2); let n = 0, cx = 0, cz = 0;
  for (const o of a.mobs) { if (o.hp <= 0 || o.pass || !o.dmg) continue; if (dH(o.x, o.z) < 2.6) { n++; cx += o.x; cz += o.z; } }
  if (n >= 3 || (n && h.hp < api.maxHp() * .35)) { cx /= n; cz /= n; const ax = h.x - cx, az = h.z - cz, d = hyp(ax, az) || 1, rx = h.x - CX, rz = h.z - CZ, rc = hyp(rx, rz) || 1; m.dir = m.dir || (rand() < .5 ? 1 : -1);
    let ux = ax / d, uz = az / d; if (rc > (R || AR) - 2.4) { ux = -rz / rc * m.dir - rx / rc * .45; uz = rx / rc * m.dir - rz / rc * .45; } return { x: h.x + ux * 3, z: h.z + uz * 3, sprint: n >= 4 }; }
  return reach(t); };
// naar (tx,tz) lopen en daarbij om gevaren heen sturen; haz is een lijst [x, z, straal]
const steer = (tx, tz, haz, extra) => { const h = H(); let dx = tx - h.x, dz = tz - h.z; const d = hyp(dx, dz) || 1; dx /= d; dz /= d;
  for (const [x, z, R] of haz) { const ex = h.x - x, ez = h.z - z, e = hyp(ex, ez) || 1; if (e >= R) continue; const w = (R - e) / R * 2.4, px = -ez / e, pz = ex / e, s = px * dx + pz * dz >= 0 ? 1 : -1; dx += ex / e * w + px * s * w * .7; dz += ez / e * w + pz * s * w * .7; }
  const l = hyp(dx, dz) || 1, L = Math.min(d, 2.5); return Object.assign({ x: h.x + dx / l * L, z: h.z + dz / l * L }, extra); };

const COL4 = [['ROOD', '#e8372a'], ['BLAUW', '#3d8bff'], ['GEEL', '#f6cf4d'], ['GROEN', '#35cf4a']];
const crate = (a, gold) => { const p = pt(4, AR - .6); add(a, 'crate', { ...still, x: p.x, z: p.z, a: rand() * TAU, hp: gold ? 170 : 60, val: gold ? 4 : 1, gold: !!gold, es: gold ? 1.9 : 1.5 }); };
const sheep = a => { const p = pt(4.5, AR - 1); add(a, 'sheep', { ...prop, x: p.x, z: p.z, wa: rand() * TAU, wt: 0, es: 1.5,
  ai(m, dt) { const h = H(), dx = m.x - h.x, dz = m.z - h.z, d = hyp(dx, dz) || 1;
    if (d < 3.2) { const v = api.speed() * .78; m.x += dx / d * v * dt; m.z += dz / d * v * dt; m.a = Math.atan2(dz, dx); }
    else { m.wt -= dt; if (m.wt <= 0) { m.wt = 1 + rand() * 2; m.wa = rand() * TAU; } m.x += Math.cos(m.wa) * .6 * dt; m.z += Math.sin(m.wa) * .6 * dt; m.a = m.wa; }
    clampIn(m, AR - .5);
    if (hyp(m.x - CX, m.z - CZ) < 2.1) { m.hp = 0; a.pts++; api.ring(m.x, m.z, '#35ff5a', 1.2, .3); } } }); };
const holes = a => { a.holes = []; const n = 5 + 2 * a.n; for (let k = 0; k < 300 && a.holes.length < n; k++) { const p = pt(0, AR - 1.2), r = .9 + rand() * .5;
    if (Math.abs(p.x - CX) > 5.4 || a.holes.some(o => hyp(o.x - p.x, o.z - p.z) < o.r + r + 1.3)) continue; a.holes.push({ x: p.x, z: p.z, r }); } };
// mijnenveld: per kolom een stuk omhoog of omlaag en dan een vak naar de overkant
const minePath = a => { const S = new Set(), n = 5, cols = a.dir > 0 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0]; let r = Math.floor(rand() * n);
  for (const c of cols) { const r2 = Math.max(0, Math.min(n - 1, r + Math.floor(rand() * (2 + Math.min(2, a.n))) * (rand() < .5 ? -1 : 1)));
    for (let y = Math.min(r, r2); y <= Math.max(r, r2); y++) S.add(y * n + c); r = r2; }
  a.path = S; a.walked = new Set(); a.show = 5; };
const BT = { sentry: { n: 'Sentry Gun', cost: 100, dmg: 10, rate: 3, range: 3.2, d: 'Snel en goedkoop.' }, flak: { n: 'Flak Kanon', cost: 180, dmg: 20, rate: 1, range: 3.2, splash: 1.3, d: 'Explosieve schade in een gebied.' },
  cryo: { n: 'Cryo Toren', cost: 160, dmg: 4, rate: .8, range: 2.8, splash: 1.4, slow: 1, d: 'Vertraagt alles in de buurt van de inslag.' }, rail: { n: 'Railgun', cost: 320, dmg: 210, rate: .35, range: 6, d: 'Enorme schade op grote afstand.' } };
const buildAt = (a, k) => { const b = BT[k]; let pad = null, bd = 1.7; for (const p of a.pads) { const d = dH(p.x, p.z); if (!p.t && d < bd) { bd = d; pad = p; } }
  if (!pad) { api.toast('Ga op een gele bouwplek staan', 1500); return; } if (a.gold < b.cost) { api.toast('Te weinig credits', 1500); return; }
  a.gold -= b.cost; pad.t = { k, cd: 0, obj: api.tower(k, pad.x, pad.z, 1.25) }; api.ring(pad.x, pad.z, '#ffc83a', 1, .4); };
const twin = (a, i, hp) => add(a, i ? 'haz' : 'mech', Object.assign({ hp: hp || 700, max: 700, big: true, tint: i ? '#ffb020' : '#c58bff' }, i
  ? { x: CX + 5, z: CZ, sp: 3, dmg: 0, zt: 2.5, mt: 4,
      ai(m, dt) { const h = H(); m.zt -= dt; m.mt -= dt; m.a = Math.atan2(h.z - m.z, h.x - m.x);
        if (m.zt <= 0) { m.zt = 2.6; zone(a, h.x, h.z, 1.8, 1, 22); api.beam(m.x, 1.3, m.z, h.x, .3, h.z, '#ffb020', .06, .25); }
        if (m.mt <= 0 || (dH(m.x, m.z) < 2.5 && m.mt < 5)) { m.mt = 8; const p = pol(Math.atan2(h.z - CZ, h.x - CX) + Math.PI + (rand() - .5) * 1.4, 6.3); m.gx = p.x; m.gz = p.z; }
        if (m.gx != null && go(m, m.gx, m.gz, m.sp, dt) < .05) m.gx = null; } }
  : { x: CX - 5, z: CZ, sp: 2.6, dmg: 0, st: 0, ct: 1.5, // loopt op de held af, haalt uit met een klap rondom en staat daarna even stil
      ai(m, dt) { const h = H(), d = hyp(h.x - m.x, h.z - m.z); m.ct -= dt;
        if (m.st) { if (m.ct <= 0) { m.st = 0; m.ct = .6; } }
        else { m.a = Math.atan2(h.z - m.z, h.x - m.x); if (d > 2) go(m, h.x, h.z, m.sp, dt); else if (m.ct <= 0) { m.st = 1; m.ct = 2.3; zone(a, m.x, m.z, 2.6, 1, 30); } } } }));

const list = [
/* ============ redelijk makkelijk ============ */
{ id: 'coins', isle: 'quad', n: 'Goudregen', tier: 1, T: 45, goal: 22,
  d: 'Munten vallen op de vier eilandjes en blijven even liggen. Ren over de bruggen heen en weer. Een gewone munt is 1 punt, een grote 3.', win: 'Doel: 22 punten in 45 seconden.',
  go: 'Goudregen: pak de munten voordat ze verdwijnen',
  init(a) { a.coins = []; a.sp = 0; },
  upd(a, dt) { a.sp -= dt; if (a.sp <= 0) { a.sp = .5; const p = pt(0, AR); a.coins.push({ x: p.x, z: p.z, t: 0, big: rand() < .15 }); }
    for (let i = a.coins.length - 1; i >= 0; i--) { const c = a.coins[i]; c.t += dt; const fall = Math.max(0, 1 - c.t / 1.1), rest = 7.1 - c.t;
      if (rest <= 0) { a.coins.splice(i, 1); continue; }
      if (fall <= 0 && dH(c.x, c.z) < (c.big ? 1.1 : .9)) { a.pts += c.big ? 3 : 1; api.ring(c.x, c.z, '#ffd24a', 1, .3); a.coins.splice(i, 1); continue; }
      if (fall > 0) mark(a, c.x, c.z, .2 + .4 * (1 - fall), '#000000', .45);
      if (rest > 1.2 || Math.floor(rest * 8) % 2) orb(a, c.x, c.z, .45 + fall * 7, c.big ? .34 : .22, c.big ? '#ffe98a' : '#ffc21a'); } },
  // de munt die het meest oplevert voor de tijd die het kost, en die er nog ligt als hij aankomt
  bot(a) { const sp = api.speed(); let best = null, bv = 0; for (const c of a.coins) { const eta = dH(c.x, c.z) * 1.25 / sp; if (eta > 6.8 - c.t) continue; const v = (c.big ? 3 : 1) / (1 + eta); if (v > bv) { bv = v; best = c; } }
    return best ? { x: best.x, z: best.z } : { x: CX, z: CZ }; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} punten` },

{ id: 'crates', isle: 'quad', n: 'Kratten slopen', tier: 1, T: 60, goal: 16,
  d: 'Op de vier eilandjes staan kratten. Je held slaat vanzelf kapot waar hij bij kan. Een krat is 1 punt, de gouden krat 4.', win: 'Doel: 16 punten in 60 seconden.',
  go: 'Kratten slopen: sla zo veel mogelijk kratten kapot',
  init(a) { a.gt = 12; for (let i = 0; i < 8; i++) crate(a); },
  upd(a, dt) { a.gt -= dt; if (a.gt <= 0) { a.gt = 14; crate(a, true); api.toast('Een gouden krat: 4 punten', 1800); }
    for (let n = alive(a, m => !m.gold); n < 8; n++) crate(a); },
  bot(a, m) { const t = target(a, o => (o.val || 1) * 3 - dH(o.x, o.z)); return t ? reach(t, .7) : stroll(m, a); },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} punten` },

{ id: 'range', isle: 'round', n: 'Schietbaan', tier: 1, T: 50, goal: 30,
  d: 'Doelwitten schuiven door de arena en je held schiet op wat binnen bereik komt. Een groot doelwit is 1 punt, een klein en snel doelwit 3.', win: 'Doel: 30 punten in 50 seconden.',
  go: 'Schietbaan: kom binnen bereik van de doelwitten. Kleine tellen voor 3',
  init(a) { a.sp = 0; },
  upd(a, dt) { a.sp -= dt; if (a.sp > 0 || alive(a) >= 7) return; a.sp = .9; const small = rand() < .3, an = rand() * TAU, p = pol(an, AR - .8), q = pol(an + Math.PI + (rand() - .5) * 1.6, AR - .8);
    add(a, 'target', { x: p.x, z: p.z, hp: small ? 18 : 30, sp: small ? 4.2 : 2.2, dmg: 0, val: small ? 3 : 1, es: small ? 1.05 : 1.75, tint: small ? '#ffd24a' : null, gx: q.x, gz: q.z,
      ai(m, dt) { if (go(m, m.gx, m.gz, m.sp, dt) < .05) m.hp = 0; } }); },
  bot(a, m) { const t = target(a, o => (o.val || 1) * 2 - dH(o.x, o.z)); return t ? reach(t, .6) : { x: CX, z: CZ }; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} punten` },

{ id: 'sprint', isle: 'round', n: 'Sprintrace', tier: 1, T: 26, goal: 24,
  d: 'Drie rondjes door de arena, langs acht poorten per rondje. Groene stroken geven een versnelling, modder remt je af.', win: 'Doel: alle 24 poorten binnen 26 seconden. Hoe sneller, hoe hoger je score.',
  go: 'Sprintrace: drie rondjes langs de gouden poorten. Groen versnelt, modder remt',
  init(a) { a.cp = 0; a.bo = 0; a.pads = []; for (let i = 0; i < 8; i++) { const an = (i + .5) * TAU / 8; a.pads.push(i % 2 ? { ...pol(an, 6.4), mud: true, r: 1.35 } : { ...pol(an, 4.9), r: 1 }); }
    const p = pol(-.6, 6.4); api.place(p.x, p.z, Math.PI / 2 - .6); },
  upd(a, dt) { const N = 24; a.bo -= dt;
    for (const p of a.pads) { const inn = dH(p.x, p.z) < p.r; mark(a, p.x, p.z, p.r, p.mud ? '#5a3d1e' : '#35ff5a', p.mud ? .75 : .45); if (inn && p.mud) a.slow = .5; else if (inn) a.bo = 1.6; }
    if (a.bo > 0) a.slow = 1.6;
    if (a.cp >= N) return; const c = pol(a.cp % 8 * TAU / 8, 6.4), nx = pol((a.cp + 1) % 8 * TAU / 8, 6.4);
    mark(a, c.x, c.z, 1.7, '#f6cf4d', .55); orb(a, c.x, c.z, 1.6, .3, '#f6cf4d'); if (a.cp < N - 1) mark(a, nx.x, nx.z, 1.2, '#f6cf4d', .15);
    if (dH(c.x, c.z) >= 1.7) return; a.cp++; a.pts = a.cp; api.ring(c.x, c.z, '#f6cf4d', 1.7, .3);
    if (a.cp === N) { a.pts = N + Math.ceil(a.t); a.fin = true; } else if (a.cp % 8 === 0) api.toast(`Ronde ${a.cp / 8 + 1} van 3`, 1500); },
  // van poort naar poort door de binnenbocht: daar ligt om en om een versneller, en zo blijft hij uit de modder
  bot(a, m) { if (a.cp >= 24) return null; const k = a.cp % 8, c = pol(k * TAU / 8, 6.4), mid = pol((k - .5) * TAU / 8, 4.9); if (m.k !== a.cp) { m.k = a.cp; m.mid = true; }
    if (m.mid && (dH(mid.x, mid.z) < 1.1 || dH(c.x, c.z) < 2.6)) m.mid = false; return { ...(m.mid ? mid : c), sprint: true, now: true }; },
  sub: (a, sec) => `${left(sec)} · ronde ${Math.min(3, Math.floor(a.cp / 8) + 1)} van 3 · poort ${a.cp % 8 + 1} van 8` },

{ id: 'colors', isle: 'quad', n: 'Kleurvloer', tier: 1, T: 90, goal: 8,
  d: 'Elk van de vier eilandjes krijgt een kleur. Er wordt een kleur omgeroepen: sta op dat eilandje als de tijd om is, want de rest zakt weg, ook de bruggen. Hoe verder je moet lopen, hoe meer tijd je krijgt, maar elke ronde wordt het krapper.', win: 'Doel: 8 van de 10 rondes overleven.',
  go: 'Kleurvloer: ren naar het eilandje met de kleur die wordt omgeroepen',
  init(a) { a.rd = 0; a.ph = 'gap'; a.pt = 2.5; a.cols = [0, 1, 2, 3]; a.col = 0; api.place(CX, CZ); },
  upd(a, dt) { const h = H(), P = QP(), tg = a.cols.indexOf(a.col); a.pt -= dt;
    if (a.ph === 'gap' && a.pt <= 0) { a.rd++; shuffle(a.cols); a.col = Math.floor(rand() * 4); const t = P[a.cols.indexOf(a.col)];
      a.ph = 'run'; a.pt = (1.4 + Math.max(0, dH(t.x, t.z) - QR + .6) / api.speed() * 1.3) * Math.max(1.15, 1.7 - .055 * a.rd); api.toast('Ren naar ' + COL4[a.col][0], 1800); }
    else if (a.ph === 'run' && a.pt <= 0) { a.ph = 'drop'; a.pt = 1.4; }
    else if (a.ph === 'drop' && a.pt <= 0) { a.pts = a.rd; a.ph = 'gap'; a.pt = 1.6; if (a.rd >= 10) { a.fin = true; return; } }
    if (a.ph === 'drop' && dH(P[tg].x, P[tg].z) > QR) { api.ball(h.x, .6, h.z, '#ff5a20', .2, 1.4, .4); h.hp = 0; return; }
    P.forEach((p, i) => { if (a.ph === 'gap') mark(a, p.x, p.z, QR + .1, '#6c727c', .5); else if (a.ph === 'run' || i === tg) mark(a, p.x, p.z, QR + .1, COL4[a.cols[i]][1], .8); else mark(a, p.x, p.z, QR + .4, '#000000', .92); });
    if (a.ph === 'drop') mark(a, CX, CZ, 2, '#000000', .9);
    if (a.ph !== 'gap') orb(a, CX, CZ, 3.2, .6, COL4[a.col][1]); },
  // de kleur wordt omgeroepen: even schakelen, en dan rennen
  bot(a, m) { if (a.ph === 'gap') return { x: CX, z: CZ }; if (a.ph !== 'run') return null; if (m.rd !== a.rd) { m.rd = a.rd; m.t0 = a.age + .25 + rand() * .45; } if (a.age < m.t0) return null;
    const t = QP()[a.cols.indexOf(a.col)]; return { x: t.x, z: t.z, sprint: a.pt < 1.3, now: true }; },
  sub: a => a.ph === 'gap' ? `Ronde ${a.rd} van 10 gehaald` : a.ph === 'run' ? `Ronde ${a.rd} van 10 · ren naar ${COL4[a.col][0]} · ${Math.max(0, a.pt).toFixed(1).replace('.', ',')} s` : `Ronde ${a.rd} van 10 · blijf staan` },

{ id: 'sheep', isle: 'round', n: 'Schapen drijven', tier: 1, T: 60, goal: 12,
  d: 'Schapen lopen voor je weg. Ga achter een schaap staan en drijf het zo het groene hok in het midden in.', win: 'Doel: 12 schapen in het hok binnen 60 seconden.',
  go: 'Schapen drijven: jaag de schapen het groene hok in het midden in',
  init(a) { for (let i = 0; i < 6; i++) sheep(a); },
  upd(a) { mark(a, CX, CZ, 2.1, '#35ff5a', .35); if (alive(a) < 6) sheep(a); },
  // een schaap uitzoeken dat niet tegen de rand staat, er in een boog omheen lopen tot hij erachter staat (gezien vanuit het hok), en dan drijven
  bot(a, m) { const h = H(), free = o => hyp(o.x - CX, o.z - CZ) < AR - 2.4; let s = m.s && m.s.hp > 0 && free(m.s) ? m.s : null, bv = 1e9;
    if (!s) for (const o of a.mobs) { if (o.hp <= 0 || !free(o)) continue; const v = dH(o.x, o.z) + hyp(o.x - CX, o.z - CZ) * .6; if (v < bv) { bv = v; s = o; } } m.s = s; if (!s) return { x: CX, z: CZ }; // staan ze allemaal tegen de rand, dan wachten tot er een losloopt
    const dx = s.x - CX, dz = s.z - CZ, d = hyp(dx, dz) || 1, ux = dx / d, uz = dz / d, mx = h.x - s.x, mz = h.z - s.z, md = hyp(mx, mz) || 1;
    if ((mx * ux + mz * uz) / md < .75 && md < 5) { const a0 = Math.atan2(mz, mx); let df = Math.atan2(uz, ux) - a0; df = Math.atan2(Math.sin(df), Math.cos(df)); const a1 = a0 + Math.sign(df) * Math.min(Math.abs(df), .7); return { x: s.x + Math.cos(a1) * 3.5, z: s.z + Math.sin(a1) * 3.5, now: true }; }
    return { x: s.x + ux * 1.6, z: s.z + uz * 1.6, now: true }; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} schapen in het hok` },

{ id: 'bomb', isle: 'round', n: 'Bommetje doorgeven', tier: 1, T: 90, goal: 2,
  d: 'Jij en drie tegenspelers geven een bom door: wie de bom heeft tikt een ander aan. Met de bom ren je iets sneller. Teruggeven aan wie hem net gaf kan niet meteen. De bom ontploft op een onbekend moment bij wie hem dan vasthoudt.', win: 'Doel: 2 van de 3 rondes overleven.',
  go: 'Bommetje doorgeven: heb jij de bom, tik dan een tegenspeler aan',
  init(a) { a.rd = 0; a.ph = 'gap'; a.pt = 2.5; a.hold = undefined; a.im = 0; a.from = undefined; a.ft = 0; a.fuse = 0;
    for (let i = 0; i < 3; i++) { const p = pol(i * TAU / 3, 4.5); add(a, 'inf', { ...prop, x: p.x, z: p.z, es: 1.9, tint: ['#59c8f2', '#c58bff', '#35cf4a'][i], wa: rand() * TAU, wt: 0, ai() {} }); } },
  upd(a, dt) { const h = H(), sp = api.speed(), ns = a.mobs.filter(m => m.hp > 0); a.pt -= dt; a.im -= dt; a.ft -= dt;
    if (a.ph === 'gap') { if (a.pt > 0) return; if (!ns.length) { a.fin = true; return; }
      a.rd++; a.ph = 'run'; a.fuse = 10 + rand() * 8; a.im = 1.5; a.from = undefined; const all = [null, ...ns]; a.hold = all[Math.floor(rand() * all.length)];
      api.toast(a.hold ? `Ronde ${a.rd}: een tegenspeler heeft de bom. Ren weg!` : `Ronde ${a.rd}: jij hebt de bom. Tik iemand aan!`, 2500); return; }
    a.fuse -= dt; if (a.hold === null) a.slow = 1.15; const two = ns.length < 2, no = a.ft > 0 && !two ? a.from : undefined, hx = a.hold ? a.hold.x : h.x, hz = a.hold ? a.hold.z : h.z;
    for (const m of ns) {
      if (m === a.hold) { let tx = null, tz = 0, bd = 1e9; if (no !== null) { tx = h.x; tz = h.z; bd = hyp(h.x - m.x, h.z - m.z); }
        for (const o of ns) { if (o === m || o === no) continue; const d = hyp(o.x - m.x, o.z - m.z); if (d < bd) { bd = d; tx = o.x; tz = o.z; } }
        if (tx != null) go(m, tx, tz, sp * .97, dt); }
      else { const dx = m.x - hx, dz = m.z - hz, d = hyp(dx, dz) || 1;
        if (d < 4) { let ax = dx / d, az = dz / d; const cx = m.x - CX, cz = m.z - CZ, rc = hyp(cx, cz) || 1;
          if (rc > AR - 2) { const tx = -cz / rc, tz = cx / rc, s = Math.sign(tx * ax + tz * az) || 1; ax = tx * s * .92 - cx / rc * .3; az = tz * s * .92 - cz / rc * .3; } // bij de muur: langs de rand wegrennen
          m.x += ax * sp * .72 * dt; m.z += az * sp * .72 * dt; m.a = Math.atan2(az, ax); }
        else { m.wt -= dt; if (m.wt <= 0) { m.wt = 1 + rand() * 2; m.wa = rand() * TAU; } m.x += Math.cos(m.wa) * 1.2 * dt; m.z += Math.sin(m.wa) * 1.2 * dt; m.a = m.wa; } }
      clampIn(m, AR - .5); }
    if (a.im <= 0) { const give = to => { a.from = a.hold; a.hold = to; a.im = 1; a.ft = 4; const x = to ? to.x : h.x, z = to ? to.z : h.z; api.ring(x, z, '#ff8a2c', 1.2, .3); };
      if (a.hold) { if (no !== null && hyp(h.x - a.hold.x, h.z - a.hold.z) < 1.1) { give(null); api.toast('Jij hebt de bom!', 1500); }
        else for (const o of ns) if (o !== a.hold && o !== no && hyp(o.x - a.hold.x, o.z - a.hold.z) < 1.1) { give(o); break; } }
      else for (const o of ns) if (o !== no && hyp(o.x - h.x, o.z - h.z) < 1.1) { give(o); break; } }
    const bx = a.hold ? a.hold.x : h.x, bz = a.hold ? a.hold.z : h.z, hot = a.fuse < 3;
    orb(a, bx, bz, 2.1, .26 + (hot ? .07 * Math.sin(a.age * 28) : 0), hot ? '#ff3a1a' : '#050505'); mark(a, bx, bz, .9, '#ff3a1a', a.hold ? .3 : .55);
    if (a.fuse > 0) return; api.ball(bx, .8, bz, '#ff8a2c', .3, 3, .6, .9); api.ring(bx, bz, '#ffb060', 3, .5);
    if (!a.hold) { if (a.pts >= a.K.goal) a.fin = true; else h.hp = 0; return; } a.hold.hp = 0; a.hold = undefined; a.pts = a.rd; a.ph = 'gap'; a.pt = 2.5; api.toast(`Ronde ${a.rd} overleefd`, 2000); },
  // met de bom: de dichtstbijzijnde tegenspeler aantikken. Zonder: wegwezen van wie hem heeft, bij de rand langs de muur
  bot(a) { const h = H(), ns = a.mobs.filter(o => o.hp > 0); if (a.ph !== 'run') return null;
    if (a.hold === null) { const no = a.ft > 0 && ns.length > 1 ? a.from : undefined; let t = null, bd = 1e9; for (const o of ns) { if (o === no) continue; const d = dH(o.x, o.z); if (d < bd) { bd = d; t = o; } } return t ? { x: t.x, z: t.z, sprint: a.fuse < 4, now: true } : null; }
    if (!a.hold) return null; const dx = h.x - a.hold.x, dz = h.z - a.hold.z, d = hyp(dx, dz) || 1; if (d > 6) return null;
    let ax = dx / d, az = dz / d; const cx = h.x - CX, cz = h.z - CZ, rc = hyp(cx, cz) || 1; if (rc > AR - 2.2) { const tx = -cz / rc, tz = cx / rc, s = Math.sign(tx * ax + tz * az) || 1; ax = tx * s * .9 - cx / rc * .35; az = tz * s * .9 - cz / rc * .35; }
    return { x: h.x + ax * 3, z: h.z + az * 3, sprint: d < 2.2, now: true }; },
  sub: a => a.ph === 'gap' ? `${a.pts} van 3 rondes overleefd · doel 2` : a.hold ? `Ronde ${a.rd} · een tegenspeler heeft de bom` : `Ronde ${a.rd} · JIJ hebt de bom` },

{ id: 'flags', isle: 'cross', n: 'Vlaggenroof', tier: 1, T: 60, goal: 24, regen: .02,
  d: 'Pak vlaggen in de armen van het kruis en breng ze naar het midden. Elke vlag die je draagt maakt je trager, maar 3 of meer tegelijk inleveren geeft bonuspunten. Bijt een waakhond je, dan laat je een vlag vallen.', win: 'Doel: 24 punten in 60 seconden.',
  go: 'Vlaggenroof: breng vlaggen naar het midden. Meer tegelijk is meer punten, maar je loopt trager',
  init(a) { a.car = 0; a.sp = 6; for (let i = 0; i < 5; i++) { const p = pt(5.8, AR - 1); add(a, 'flag', { ...prop, x: p.x, z: p.z, flag: true, es: 1.5, ai() {} }); } },
  upd(a, dt) { const h = H(); a.sp -= dt; mark(a, CX, CZ, 1.8, a.car ? '#35ff5a' : '#f6cf4d', .4);
    for (const m of a.mobs) if (m.flag && m.hp > 0 && dH(m.x, m.z) < 1) { a.car++; api.ring(m.x, m.z, '#e8372a', 1, .3); const p = pt(5.8, AR - 1); m.x = p.x; m.z = p.z; }
    if (a.car) { a.slow = Math.max(.45, 1 - .11 * a.car); for (let i = 0; i < a.car; i++) orb(a, h.x, h.z, 1.9 + i * .32, .16, '#e8372a');
      if (a.hit) { a.car--; api.toast('Gebeten: je laat een vlag vallen', 1500); }
      else if (dH(CX, CZ) < 1.8) { const n = a.car, p = n + Math.max(0, n - 2); a.pts += p; a.car = 0; api.ring(CX, CZ, '#35ff5a', 2, .4); api.toast(`${n} ${n === 1 ? 'vlag' : 'vlaggen'} ingeleverd: +${p}`, 1500); } }
    if (a.sp <= 0 && alive(a, m => !m.flag) < 3) { a.sp = 7; api.addMob(a, 'dog', { hp: 55, sp: 4.6, dmg: 6 }); } },
  // twee of drie vlaggen verzamelen en dan inleveren; tegen het eind brengt hij weg wat hij heeft
  bot(a, m) { if (!m.n || !a.car && m.had) { m.n = 2 + Math.floor(rand() * 2); } m.had = a.car; if (a.car >= m.n || (a.car && a.t < 8)) return { x: CX, z: CZ };
    let f = null, bd = 1e9; for (const o of a.mobs) { if (!o.flag || o.hp <= 0) continue; const d = dH(o.x, o.z); if (d < bd) { bd = d; f = o; } } return f ? { x: f.x, z: f.z } : { x: CX, z: CZ }; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} punten · je draagt ${a.car}` },

/* ============ gemiddeld ============ */
{ id: 'lava', isle: 'square', n: 'De vloer is lava', tier: 2, T: 60, goal: 59,
  d: 'Tegels knipperen oranje en zakken dan weg in de lava. Na een tijdje komen ze terug. Het gaat steeds sneller, en de tegel onder je voeten is geregeld aan de beurt.', win: 'Doel: 60 seconden overleven.',
  go: 'De vloer is lava: ga van een tegel af zodra hij oranje knippert',
  init(a) { a.gr = grid(6, 2); a.block = a.gr.out; a.st = new Float32Array(36); a.sp = 1.5; a.me = 5; api.place(CX - 1, CZ - 1); },
  upd(a, dt) { const g = a.gr, h = H(), c = g.cell(h.x, h.z); survive(a); a.sp -= dt; a.me -= dt;
    if (a.sp <= 0) { a.sp = Math.max(.34, 1 - .012 * a.age); for (let k = 0; k < 8; k++) { const i = Math.floor(rand() * 36); if (a.st[i] === 0) { a.st[i] = 1.6; break; } } }
    if (a.me <= 0) { a.me = 4; if (c >= 0 && a.st[c] === 0) a.st[c] = 1.6; }
    for (let i = 0; i < 36; i++) { let s = a.st[i]; if (s > 0) { s -= dt; if (s <= 0) s = -7; } else if (s < 0) { s += dt; if (s >= 0) s = 0; } a.st[i] = s; const p = g.pos(i); // s > 0: knippert, s < 0: weg
      if (s < 0) rect(a, p.x, p.z, 2, 2, '#ff3a14', .55 + .2 * Math.sin(a.age * 5 + i));
      else rect(a, p.x, p.z, 1.9, 1.9, s > 0 && Math.floor(s * 6) % 2 ? '#ff8a2c' : '#6c727c', .9); }
    if (c >= 0 && a.st[c] < 0) { h.hp -= api.maxHp() * .55 * dt; if (rand() < dt * 8) api.ball(h.x, .4, h.z, '#ff5a20', .1, .7, .25); } },
  // op een hele tegel blijven staan; knippert of zakt die weg, dan over tegels die er nog liggen naar de dichtstbijzijnde hele
  bot(a, m, ai) { const g = a.gr, h = H(), c = g.cell(h.x, h.z), ok = i => a.st[i] === 0 || a.st[i] > .35 + .9 * ai.skill; // een knipperende tegel heeft hij niet meteen door, de een later dan de ander
    if (c >= 0 && ok(c)) return g.pos(c); const from = new Int8Array(36).fill(-2), q = []; let hit = -1;
    if (c >= 0) { from[c] = -1; q.push(c); } else for (let i = 0; i < 36; i++) if (a.st[i] >= 0) { from[i] = -1; q.push(i); }
    for (let k = 0; k < q.length && hit < 0; k++) { const u = q[k], x = u % 6, y = (u - x) / 6;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx > 5 || ny > 5) continue; const v = ny * 6 + nx; if (from[v] !== -2 || a.st[v] < 0) continue; from[v] = u; if (a.st[v] === 0) { hit = v; break; } q.push(v); } }
    if (hit < 0) { let b = -1, bd = 1e9; for (let i = 0; i < 36; i++) { if (a.st[i] < 0) continue; const p = g.pos(i), d = dH(p.x, p.z) + (a.st[i] > 0 ? 3 : 0); if (d < bd) { bd = d; b = i; } } return b < 0 ? null : { ...g.pos(b), now: true }; }
    while (from[hit] >= 0 && from[hit] !== c) hit = from[hit]; return { ...g.pos(hit), now: true }; },
  sub: (a, sec) => `${left(sec)} · blijf van de lava af` },

{ id: 'lasers', isle: 'round', n: 'Lasergrid', tier: 2, T: 50, goal: 49,
  d: 'Laserlijnen schuiven door de arena. In elke lijn zit een opening, gemarkeerd met groen. Later draait er ook een straal vanuit het midden rond. Met F zet je even een schild op dat alles tegenhoudt.', win: 'Doel: 50 seconden overleven.',
  go: 'Lasergrid: loop door de groene openingen. F zet je schild op',
  init(a) { a.shield = true; a.ls = []; a.sp = 2; a.im = 0; a.rot = rand() * TAU; },
  upd(a, dt) { const h = H(), lx = h.x - CX, lz = h.z - CZ; let hit = false; survive(a); a.sp -= dt; a.im -= dt;
    if (a.sp <= 0) { a.sp = Math.max(1.5, 3.2 - .035 * a.age); a.ls.push({ ph: Math.floor(rand() * 8) * Math.PI / 4, s: -AR, g: (rand() - .5) * 7, v: 3.2 + .03 * a.age }); }
    for (let i = a.ls.length - 1; i >= 0; i--) { const l = a.ls[i]; l.s += l.v * dt; if (l.s > AR) { a.ls.splice(i, 1); continue; }
      const nx = Math.cos(l.ph), nz = Math.sin(l.ph), tx = -nz, tz = nx, L = Math.sqrt(Math.max(0, AR * AR - l.s * l.s)), rot = Math.atan2(tz, tx);
      for (const [t0, t1] of [[-L, Math.min(L, l.g - 1.6)], [Math.max(-L, l.g + 1.6), L]]) { if (t1 - t0 < .1) continue; const m = (t0 + t1) / 2; glow(a, CX + nx * l.s + tx * m, CZ + nz * l.s + tz * m, t1 - t0, rot, '#ff3a1a', .85); }
      if (Math.abs(l.g) < L) mark(a, CX + nx * l.s + tx * l.g, CZ + nz * l.s + tz * l.g, 1.3, '#35ff5a', .28);
      if (Math.abs(lx * nx + lz * nz - l.s) < .4 && Math.abs(lx * tx + lz * tz - l.g) > 1.6) hit = true; }
    if (a.age > 10) { const live = a.age > 12; if (live) a.rot += (.55 + .006 * a.age) * dt; const c = Math.cos(a.rot), s = Math.sin(a.rot); glow(a, CX + c * AR / 2, CZ + s * AR / 2, AR, a.rot, '#ffb020', live ? .85 : .25, live ? .2 : .08);
      if (live && lx * c + lz * s > .6 && Math.abs(lz * c - lx * s) < .45) hit = true; }
    if (hit && a.im <= 0) { a.im = .8; if (api.shield.on) api.ring(h.x, h.z, '#59c8f2', 1.2, .2); else { api.hurt(25); api.ball(h.x, .8, h.z, '#ff3a1a', .2, 1, .25); } } },
  card: () => [api.shield.slot()],
  // voor de lijn die er het eerst is: naar de opening. Is er geen lijn in aantocht, dan voor de draaiende straal uit lopen. Lukt het niet: schild
  bot(a) { const h = H(), lx = h.x - CX, lz = h.z - CZ; let best = null, bt = 2.4;
    for (const l of a.ls) { const u = lx * Math.cos(l.ph) + lz * Math.sin(l.ph), t = (u - l.s) / l.v; if (t < -.15 || t > bt) continue; bt = t; best = l; }
    if (best) { const nx = Math.cos(best.ph), nz = Math.sin(best.ph), u = lx * nx + lz * nz, w = -lx * nz + lz * nx, gw = Math.max(best.g - 1.1, Math.min(best.g + 1.1, w));
      return { x: CX + nx * u - nz * gw, z: CZ + nz * u + nx * gw, shield: Math.abs(w - best.g) > 1.5 && bt < .3, now: true }; }
    if (a.age < 11) return { x: CX + lx * .6, z: CZ + lz * .6 }; const r = Math.max(2.4, Math.min(4.6, hyp(lx, lz))), an = Math.atan2(lz, lx); let da = (an - a.rot) % TAU; if (da < 0) da += TAU;
    return da < 1.5 || da > TAU - .25 ? { ...pol(an + .9, r), shield: da < .22 || da > TAU - .1, now: true } : pol(an, r); },
  sub: (a, sec) => `${left(sec)} · door de groene openingen · F is je schild` },

{ id: 'meteors', isle: 'round', n: 'Meteorenregen', tier: 2, T: 60, goal: 59, regen: .01,
  d: 'Meteoren slaan in waar een rode cirkel verschijnt: hoe voller de cirkel, hoe dichterbij de inslag. Het tempo loopt op en om de paar seconden komt er een grote recht op je af.', win: 'Doel: 60 seconden overleven.',
  go: 'Meteorenregen: blijf uit de rode cirkels',
  init(a) { a.sp = 1; a.big = 9; a.mt = []; },
  upd(a, dt) { const h = H(), met = (x, z, r, T, dmg) => { zone(a, x, z, r, T, dmg); a.mt.push({ x, z, r, t: T }); }; survive(a); a.sp -= dt; a.big -= dt;
    if (a.sp <= 0) { a.sp = Math.max(.24, 1 - .014 * a.age); const p = rand() < .25 ? { x: h.x + rand() - .5, z: h.z + rand() - .5 } : pt(0, AR - .5); met(p.x, p.z, 1.5 + rand() * .8, 1.4, 34); }
    if (a.big <= 0) { a.big = 8; met(h.x, h.z, 3.6, 2.2, 60); api.toast('Een grote meteoor!', 1500); }
    for (let i = a.mt.length - 1; i >= 0; i--) { const m = a.mt[i]; m.t -= dt; if (m.t <= 0) a.mt.splice(i, 1); else orb(a, m.x + m.t * 2.5, m.z, .5 + m.t * 7, m.r * .22, '#ff8a2c'); } },
  bot(a, m) { return stroll(m, a, AR - 2.5); },
  sub: (a, sec) => `${left(sec)} · blijf uit de rode cirkels` },

{ id: 'king', isle: 'round', n: 'Koning van de heuvel', tier: 2, T: 60, goal: 35, regen: .02,
  d: 'Sta in de cirkel in het midden om punten te verdienen. Tanks nemen een aanloop, tonen een rode baan en rammen je dan de cirkel uit. De cirkel wordt steeds kleiner.', win: 'Doel: 35 seconden op de heuvel binnen 60 seconden.',
  go: 'Koning van de heuvel: blijf in de cirkel en ontwijk de rammende tanks',
  init(a) { a.sp = 3; },
  upd(a, dt) { const R = Math.max(1.7, 2.8 - .018 * a.age), inn = dH(CX, CZ) <= R; if (inn) a.pts += dt; mark(a, CX, CZ, R, inn ? '#35ff5a' : '#f6cf4d', .4); a.sp -= dt;
    if (a.sp > 0 || alive(a) >= 3) return; a.sp = 6;
    add(a, 'tank', { hp: 170, sp: 2.4, dmg: 0, st: 0, ct: 0,
      ai(m, dt) { const h = H(), dx = h.x - m.x, dz = h.z - m.z, d = hyp(dx, dz) || 1; m.ct -= dt;
        if (m.st === 0) { m.a = Math.atan2(dz, dx); if (d > 4.5) { m.x += dx / d * m.sp * dt; m.z += dz / d * m.sp * dt; } else if (m.ct <= 0) { m.st = 1; m.ct = .75; m.ux = dx / d; m.uz = dz / d; } }
        else if (m.st === 1) { rect(a, m.x + m.ux * 3.5, m.z + m.uz * 3.5, 7, .8, '#ff3a1a', .4, Math.atan2(m.uz, m.ux)); if (m.ct <= 0) { m.st = 2; m.ct = .7; } }
        else { m.x += m.ux * 10 * dt; m.z += m.uz * 10 * dt; clampIn(m, AR - .5);
          if (d < 1.2) { api.push(m.ux * 3.6, m.uz * 3.6); api.hurt(8); api.ring(h.x, h.z, '#ff8a2c', 1.4, .3); m.st = 0; m.ct = 2; } else if (m.ct <= 0) { m.st = 0; m.ct = 1.5; } } } }); },
  // in de cirkel blijven; toont een tank zijn rode baan, dan dwars eruit stappen. Die baan ziet hij niet meteen
  bot(a, m) { const h = H(); m.seen = m.seen || new Map();
    for (const t of a.mobs) { if (t.hp <= 0) continue; if (!t.st) { m.seen.delete(t); continue; } if (!m.seen.has(t)) m.seen.set(t, a.age + .15 + rand() * .3); if (a.age < m.seen.get(t)) continue;
      const px = h.x - t.x, pz = h.z - t.z, al = px * t.ux + pz * t.uz, side = px * t.uz - pz * t.ux; if (al > -1 && al < 8.5 && Math.abs(side) < 1.5) { const s = side >= 0 ? 1 : -1; return { x: h.x + t.uz * s * 2, z: h.z - t.ux * s * 2, sprint: Math.abs(side) < .5, now: true }; } }
    return { x: CX, z: CZ }; },
  sub: (a, sec) => `${left(sec)} · ${Math.floor(a.pts)} van ${a.K.goal} seconden op de heuvel` },

{ id: 'convoy', isle: 'cross', n: 'Konvooi escorteren', tier: 2, T: 75, goal: 1, regen: .015,
  d: 'Een wagen rijdt langzaam over de lange arm van het kruis. Honden en soldaten komen uit alle vier de armen en vallen de wagen aan, een enkeling komt op jou af. Schakel ze uit voordat de wagen kapot is.', win: 'Doel: de wagen haalt de overkant. Hoe heler de wagen, hoe hoger je score.',
  go: 'Konvooi: bescherm de wagen tot hij aan de overkant is',
  init(a) { a.sp = 3; a.cart = add(a, 'cart', { x: CX - 7.4, z: CZ, a: 0, hp: 480, pass: true, sp: 0, dmg: 0, es: 1.9,
      ai(m, dt) { m.x += 14.8 / 62 * dt; m.a = 0; if (m.x >= CX + 7.4) { a.pts = Math.max(1, Math.round(m.hp / m.max * 100)); a.fin = true; } } }); api.place(CX - 5.5, CZ + 1.5, 0); },
  upd(a, dt) { const c = a.cart; rect(a, CX, CZ, 15.6, 1, '#5a4a36', .6); mark(a, CX + 7.4, CZ, 1.2, '#35ff5a', .4); if (c.hp <= 0) { a.fail = true; a.fin = true; return; }
    a.sp -= dt; if (a.sp > 0 || alive(a) >= 10) return; a.sp = Math.max(1.5, 2.6 - .02 * a.age); const dog = rand() < .6;
    if (rand() < .22) api.addMob(a, dog ? 'dog' : 'inf', { hp: dog ? 35 : 60, sp: dog ? 3.9 : 2.9, dmg: dog ? 6 : 8 });
    else add(a, dog ? 'dog' : 'inf', { hp: dog ? 35 : 60, sp: dog ? 3.9 : 2.9, dmg: 0, bite: dog ? 6 : 9, cd: 0,
      ai(m, dt) { if (hyp(c.x - m.x, c.z - m.z) > 1.2) walk(m, c.x, c.z, m.sp, dt); else { m.cd -= dt; if (m.cd <= 0) { m.cd = 1; c.hp -= m.bite; api.ring(c.x, c.z, '#ff6a4e', .9, .2); } } } }); },
  // wie het dichtst bij de wagen is eerst; is het rustig, dan loopt hij met de wagen mee
  bot(a) { const c = a.cart, t = target(a, o => -hyp(o.x - c.x, o.z - c.z)); return t ? reach(t, .7) : { x: c.x + 1.2, z: c.z + 1.3 }; },
  sub: (a, sec) => `${left(sec)} · wagen ${Math.max(0, Math.ceil(a.cart.hp / a.cart.max * 100))}% heel` },

{ id: 'simon', isle: 'quad', n: 'Simon zegt', tier: 2, T: 170, goal: 4,
  d: 'De vier eilandjes lichten in een volgorde op, elk in zijn eigen kleur. Loop daarna dezelfde volgorde na door op elk eilandje in de cirkel te gaan staan. Via het midden kom je overal zonder een ander eilandje te raken. Elke ronde komt er een stap bij. Je mag twee fouten maken.', win: 'Doel: 4 van de 6 rondes halen.',
  go: 'Simon zegt: onthoud de volgorde van de eilandjes en loop hem na',
  init(a) { a.seq = []; a.rd = 0; a.ph = 'gap'; a.pt = 2.5; a.i = 0; a.lives = 3; a.fl = -1; a.ft = 0; a.fc = '#35ff5a'; a.last = -1; api.place(CX, CZ); },
  upd(a, dt) { const h = H(), P = QP(); let at = -1; a.pt -= dt; a.ft -= dt; P.forEach((p, i) => { if (dH(p.x, p.z) < 1.5) at = i; });
    if (a.ph === 'gap' && a.pt <= 0) { if (a.rd >= 6) { a.fin = true; return; } a.rd++; while (a.seq.length < a.rd + 2) { let k; do k = Math.floor(rand() * 4); while (k === a.seq[a.seq.length - 1]); a.seq.push(k); }
      a.ph = 'show'; a.i = 0; a.pt = .8; api.toast(`Ronde ${a.rd}: kijk goed`, 1500); }
    else if (a.ph === 'show' && a.pt <= 0) { a.i++; a.pt = .8; if (a.i >= a.seq.length) { a.ph = 'play'; a.i = 0; a.last = at; api.toast('Jouw beurt', 1200); } }
    else if (a.ph === 'play' && at !== a.last) { a.last = at;
      if (at >= 0 && at === a.seq[a.i]) { a.i++; a.fl = at; a.ft = .4; a.fc = '#ffffff'; api.ring(P[at].x, P[at].z, COL4[at][1], 2.4, .4); if (a.i >= a.seq.length) { a.pts = a.rd; a.ph = 'gap'; a.pt = 1.8; api.toast('Goed!', 1200); } }
      else if (at >= 0) { a.fl = at; a.ft = .7; a.fc = '#000000'; a.lives--; h.hp = api.maxHp() * a.lives / 3; if (a.lives <= 0) return; a.ph = 'show'; a.i = 0; a.pt = 1.6; api.toast('Fout! Kijk opnieuw', 1500); } }
    P.forEach((p, i) => { const lit = a.ph === 'show' && a.seq[a.i] === i && a.pt > .15 && a.pt <= .8, fl = a.ft > 0 && a.fl === i;
      mark(a, p.x, p.z, QR + .1, fl ? a.fc : COL4[i][1], lit ? .95 : fl ? .8 : .22); mark(a, p.x, p.z, 1.5, lit ? '#ffffff' : COL4[i][1], lit ? .8 : .45); if (lit) orb(a, p.x, p.z, 2.2, .5, COL4[i][1]); }); },
  // hij onthoudt de volgorde, maar hoe langer die is, hoe groter de kans dat hij een stap verkeerd heeft
  bot(a, m) { const P = QP(); if (a.ph !== 'play') { m.key = null; return { x: CX, z: CZ }; }
    if (!m.key) { m.key = 1; m.plan = a.seq.map((k, j) => rand() < Math.max(0, j - 2) * .035 ? (k + 1 + Math.floor(rand() * 3)) % 4 : k); } const t = P[m.plan[Math.min(a.i, m.plan.length - 1)]]; return { x: t.x, z: t.z }; },
  sub: a => (a.ph === 'show' ? `Ronde ${a.rd} van 6 · kijk goed` : a.ph === 'play' ? `Ronde ${a.rd} van 6 · stap ${a.i + 1} van ${a.seq.length}` : `${a.pts} van 6 rondes gehaald`) + ` · ${a.lives} ${a.lives === 1 ? 'leven' : 'levens'}` },

{ id: 'ice', isle: 'square', n: 'IJsbaan', tier: 2, T: 60, goal: 2,
  d: 'De vloer is spekglad: je held komt traag op gang en glijdt door. Steek over naar het groene vlak zonder in een wak te glijden. Na elke oversteek keert de richting om en komen er wakken bij.', win: 'Doel: 2 keer oversteken in 60 seconden.',
  go: 'IJsbaan: glij naar het groene vlak en blijf uit de wakken',
  init(a) { a.ice = 2.2; a.dir = 1; a.n = 0; holes(a); api.place(CX - 7.2, CZ, 0); },
  upd(a) { const h = H(), gx = CX + a.dir * 7.2; floor(a, '#bfe9ff', .16); mark(a, gx, CZ, 1.3, '#35ff5a', .5); mark(a, CX - a.dir * 7.2, CZ, 1.3, '#f6cf4d', .2);
    for (const o of a.holes) { mark(a, o.x, o.z, o.r, '#000308', .94); if (dH(o.x, o.z) < o.r - .15) { api.hurt(12); api.ball(h.x, .4, h.z, '#9fe8ff', .2, 1.2, .4); api.place(CX - a.dir * 7.2, CZ); api.toast('Je zakt door het ijs', 1500); } }
    if (dH(gx, CZ) < 1.3) { a.n++; a.pts = a.n; a.dir = -a.dir; holes(a); api.ring(gx, CZ, '#35ff5a', 1.6, .4); api.toast(`Oversteek ${a.n} gehaald. Nu terug!`, 1500); } },
  // op het ijs stuur je vooruit: mikken op de overkant en om de wakken heen. Wie minder ver vooruitkijkt, glijdt er vaker in
  bot(a, m, ai) { const h = H(), gx = CX + a.dir * 7.2, look = .1 + .45 * ai.skill, px = h.x + (h.vx || 0) * look, pz = h.z + (h.vz || 0) * look; let fx = gx - h.x, fz = (CZ - h.z) * (Math.abs(gx - h.x) < 3 ? 1.4 : .35); const fl = hyp(fx, fz) || 1; fx /= fl; fz /= fl;
    for (const o of a.holes) { const dx = px - o.x, dz = pz - o.z, d = hyp(dx, dz) || 1, R = o.r + .7 + .8 * ai.skill; if (d >= R) continue; const k = (R - d) / R * 2.8, s = dz >= 0 ? 1 : -1; fx += dx / d * k; fz += dz / d * k + s * k * .5; }
    if (!(a.age < m.et)) { m.et = a.age + .5; m.er = (rand() - .5) * 2.4 * (1 - ai.skill); } const c = Math.cos(m.er), s = Math.sin(m.er); // op glad ijs stuurt niemand precies
    return { x: h.x + (fx * c - fz * s) * 3, z: h.z + (fx * s + fz * c) * 3, now: true }; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} keer overgestoken` },

{ id: 'waves', isle: 'cross', n: 'Golfsprint', tier: 2, T: 80, goal: 1, regen: .015,
  d: 'Vijf snelle golven stormen door de vier armen van het kruis op je vlag in het midden af. Er staan geen torens: alleen je held houdt ze tegen. Is een golf op, dan komt de volgende meteen.', win: 'Doel: de vlag staat nog na de vijfde golf. Hoe heler de vlag, hoe hoger je score.',
  go: 'Golfsprint: verdedig de vlag in het midden tegen vijf golven',
  init(a) { a.flag = add(a, 'flag', { ...still, x: CX, z: CZ, hp: 360, pass: true, es: 2.2 }); a.w = 0; a.pt = 3; a.q = 0; a.qt = 0; api.place(CX + 1.5, CZ + 1.5); },
  upd(a, dt) { const f = a.flag, n = alive(a, m => m !== f); mark(a, CX, CZ, 1.4, '#59c8f2', .3); if (f.hp <= 0) { a.fail = true; a.fin = true; return; } a.pt -= dt;
    if (a.q > 0) { a.qt -= dt; if (a.qt > 0) return; a.qt = .28; a.q--; const dog = rand() < .6;
      add(a, dog ? 'dog' : 'inf', { hp: dog ? 22 : 38, sp: dog ? 4.2 : 3, dmg: 0, bite: dog ? 3 : 5, cd: .5,
        ai(m, dt) { if (hyp(f.x - m.x, f.z - m.z) > 1.1) go(m, f.x, f.z, m.sp, dt); else { m.cd -= dt; if (m.cd <= 0) { m.cd = 1.5; f.hp -= m.bite; api.ring(f.x, f.z, '#ff6a4e', .9, .2); } } } }); }
    else if (a.w >= 5) { if (!n) { a.pts = Math.max(1, Math.round(f.hp / f.max * 100)); a.fin = true; } }
    else if (a.pt <= 0 || (!n && a.w > 0 && a.pt < 10)) { a.w++; a.q = 3 + a.w; a.pt = 12; api.toast(`Golf ${a.w} van 5`, 1500); } },
  bot(a) { const f = a.flag, t = target(a, o => -hyp(o.x - f.x, o.z - f.z)); return t ? reach(t, .7) : { x: CX + 1.2, z: CZ + 1.2 }; },
  sub: (a, sec) => `${left(sec)} · golf ${Math.max(1, a.w)} van 5 · vlag ${Math.max(0, Math.ceil(a.flag.hp / a.flag.max * 100))}%` },

{ id: 'jump', isle: 'square', n: 'Springparcours', tier: 2, T: 60, goal: 4,
  d: 'Tussen jou en de overkant ligt een afgrond met vijf rijen platforms die heen en weer schuiven. Stap over als twee platforms naast elkaar liggen; een platform neemt je mee. Val je, dan begin je weer aan de rand.', win: 'Doel: 4 keer oversteken in 60 seconden.',
  go: 'Springparcours: stap van platform naar platform naar de overkant',
  init(a) { a.dir = 1; a.n = 0; a.off = 0; a.pl = []; for (let i = 0; i < 5; i++) a.pl.push({ x: CX - 4.8 + i * 2.4, amp: 2.2 + rand() * 1.2, w: .55 + rand() * .5, ph: rand() * TAU }); api.place(CX - 7.3, CZ, 0); },
  upd(a, dt) { const h = H(), sx = CX - a.dir * 7.3, gx = CX + a.dir * 7.3, onPad = x => Math.abs(h.x - x) <= 1.3 && Math.abs(h.z - CZ) <= 1.9; let vz = null;
    floor(a, '#000000', .88); rect(a, sx, CZ, 2.6, 3.8, '#8f7a58', .95); rect(a, gx, CZ, 2.6, 3.8, '#35cf4a', .9);
    for (const p of a.pl) { const z = CZ + Math.sin(a.age * p.w + p.ph) * p.amp; rect(a, p.x, z, 2.4, 2.8, '#59616e', .97); if (Math.abs(h.x - p.x) <= 1.2 && Math.abs(h.z - z) <= 1.4) vz = Math.cos(a.age * p.w + p.ph) * p.amp * p.w; }
    if (onPad(gx)) { a.n++; a.pts = a.n; a.dir = -a.dir; a.off = 0; api.ring(gx, CZ, '#35ff5a', 1.6, .4); api.toast(`Oversteek ${a.n} gehaald. Nu terug!`, 1500); return; }
    if (vz != null) { h.z += vz * dt; a.off = 0; } else if (onPad(sx)) a.off = 0; else a.off += dt;
    if (a.off > .14) { a.off = 0; api.hurt(25); api.ball(h.x, .3, h.z, '#8fb6ff', .2, 1.2, .4); api.place(sx, CZ); api.toast('Je valt in de afgrond', 1500); } },
  // wachten tot het volgende platform naast het zijne ligt en dan in één keer oversteken. Schat hij het verkeerd in, dan valt hij
  bot(a) { const h = H(), t = a.age, zOf = i => CZ + Math.sin(t * a.pl[i].w + a.pl[i].ph) * a.pl[i].amp, vOf = i => Math.cos(t * a.pl[i].w + a.pl[i].ph) * a.pl[i].amp * a.pl[i].w;
    const cur = Math.max(-1, Math.min(5, Math.round((h.x - (CX - 4.8)) / 2.4))), nx = cur + a.dir, cx = k => k < 0 ? CX - 7.3 : k > 4 ? CX + 7.3 : CX - 4.8 + k * 2.4, on = cur >= 0 && cur <= 4, myZ = on ? zOf(cur) : CZ, myV = on ? vOf(cur) : 0;
    const edge = nx < 0 || nx > 4, zn = edge ? CZ : zOf(nx), vn = edge ? 0 : vOf(nx), tol = edge ? 1.5 : .75, dz = zn - h.z;
    if (Math.abs(dz) < tol && Math.abs(dz + (vn - myV) * .4) < tol + .3) return { x: cx(nx) + (edge ? a.dir * .4 : 0), z: edge ? h.z : zn, now: true };
    const lim = on ? 1 : 1.5; return { x: cx(cur), z: myZ + Math.max(-lim, Math.min(lim, zn - myZ)), now: true }; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} keer overgestoken` },

{ id: 'gens', isle: 'cross', n: 'Generatoren', tier: 2, T: 60, goal: 59,
  d: 'Aan het eind van elke arm van het kruis staat een generator die langzaam leegloopt. Ga ernaast staan om er een op te laden. Drones hechten zich aan een generator en zuigen hem sneller leeg: schiet ze eraf. Valt er een uit, dan is het voorbij.', win: 'Doel: alle vier 60 seconden aan de praat houden.',
  go: 'Generatoren: laad ze op door ernaast te staan en schiet de drones eraf',
  init(a) { a.gs = []; for (let i = 0; i < 4; i++) { const p = pol(i * TAU / 4, 6.4); a.gs.push(add(a, 'gen', { ...still, x: p.x, z: p.z, hp: 70, max: 100, pass: true, es: 1.6 })); } a.sp = 6; api.place(CX, CZ); },
  upd(a, dt) { const dr = 2.6 + .02 * a.age; survive(a);
    for (const g of a.gs) { const near = dH(g.x, g.z) < 2.2; g.hp = Math.min(100, g.hp + ((near ? 44 : 0) - dr) * dt); mark(a, g.x, g.z, 2.2, near ? '#35ff5a' : g.hp < 30 ? '#e8372a' : '#59c8f2', near ? .4 : .25);
      if (g.hp <= 0) { api.toast('Een generator is uitgevallen', 2500); a.fail = true; a.fin = true; return; } }
    a.sp -= dt; if (a.sp > 0) return; a.sp = Math.max(3.5, 7 - .05 * a.age);
    add(a, 'drone', { hp: 45, sp: 3.2, dmg: 0, gen: a.gs[Math.floor(rand() * 4)],
      ai(m, dt) { const g = m.gen; if (hyp(g.x - m.x, g.z - m.z) > 1.1) go(m, g.x, g.z, m.sp, dt); else { g.hp -= 7 * dt; if (rand() < dt * 5) api.beam(m.x, 1, m.z, g.x, 1.6, g.z, '#ff5a3c', .05, .12); } } }); },
  // bij de generator die het hardst leegloopt gaan staan, en pas wisselen als die weer vol genoeg is of een andere bijna uitvalt
  bot(a, m) { const need = g => { let n = 0; for (const o of a.mobs) if (o.hp > 0 && o.gen === g) n++; return g.hp - 14 * n; }; let low = a.gs[0]; for (const g of a.gs) if (need(g) < need(low)) low = g;
    if (!m.g || m.g.hp >= 92 || need(low) < Math.min(28, need(m.g) - 30)) m.g = low; const g = m.g; return { x: g.x - (g.x - CX) * .14, z: g.z - (g.z - CZ) * .14 }; },
  sub: (a, sec) => `${left(sec)} · zwakste generator ${Math.max(0, Math.ceil(Math.min(...a.gs.map(g => g.hp))))}%` },

{ id: 'mines', isle: 'square', n: 'Mijnenveld', tier: 2, T: 75, goal: 3,
  d: 'Vijf seconden lang zie je het veilige pad door een veld van 25 tegels. Daarna loop je het uit je hoofd. Stap je op een verkeerde tegel, dan ontploft een mijn en begin je opnieuw; drie mijnen is te veel.', win: 'Doel: 3 keer oversteken in 75 seconden.',
  go: 'Mijnenveld: onthoud het groene pad. Na vijf seconden verdwijnt het',
  init(a) { a.gr = grid(5, 2.2); a.block = (x, z) => Math.abs(x - CX) < 5.5 && Math.abs(z - CZ) > 5.5; a.n = 0; a.dir = 1; minePath(a); api.place(CX - 7, CZ, 0); },
  upd(a, dt) { const g = a.gr, h = H(), c = g.cell(h.x, h.z); a.show -= dt;
    for (let i = 0; i < 25; i++) { const p = g.pos(i), sh = a.show > 0 && a.path.has(i), wk = a.walked.has(i); rect(a, p.x, p.z, 2.08, 2.08, sh || wk ? '#35cf4a' : '#4a5260', sh ? .9 : wk ? .55 : .8); }
    mark(a, CX + a.dir * 7, CZ, 1.3, '#35ff5a', .4);
    if (c >= 0 && a.path.has(c)) a.walked.add(c);
    else if (c >= 0) { h.hp -= api.maxHp() * .34; api.ball(h.x, .5, h.z, '#ff8a2c', .3, 2.2, .5, .9); api.ring(h.x, h.z, '#ffb060', 2.2, .4); api.place(CX - a.dir * 7, CZ); a.show = 1.5; api.toast('Boem! Een mijn', 1500); }
    if ((h.x - CX) * a.dir > 5.6) { a.n++; a.pts = a.n; a.dir = -a.dir; minePath(a); api.toast(`Oversteek ${a.n} gehaald. Onthoud het nieuwe pad!`, 2000); } },
  // eerst het pad bekijken en inprenten zolang het te zien is. Niet elke tegel blijft hangen: waar zijn geheugen een gat heeft, gokt hij
  bot(a, m, ai) { const g = a.gr, h = H(), n = 5, key = a.n + ':' + a.dir, start = CX - a.dir * 7, cells = [...a.path];
    if (m.key !== key || (a.show > 0 && !m.fresh) || (m.wi > 1 && Math.abs(h.x - start) < .6)) { // nieuw pad, het pad is weer te zien, of terug bij af na een mijn
      if (m.key !== key || (a.show > 0 && !m.fresh)) m.know = new Set(cells.filter(() => rand() < .78 + .19 * ai.skill)); if (m.key !== key) m.t0 = a.age + 2 + rand() * 2.5; m.key = key; m.fresh = a.show > 0; m.wi = 0;
      const cost = i => m.know.has(i) || a.walked.has(i) ? 1 : 7, c0 = a.dir > 0 ? 0 : n - 1, c1 = n - 1 - c0, dist = new Float32Array(25).fill(1e9), prev = new Int8Array(25).fill(-1), done = new Uint8Array(25);
      for (let r = 0; r < n; r++) dist[r * n + c0] = cost(r * n + c0);
      for (;;) { let u = -1, bd = 1e9; for (let i = 0; i < 25; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; } if (u < 0) break; done[u] = 1; const x = u % n, y = (u - x) / n;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue; const v = Y * n + X; if (bd + cost(v) < dist[v]) { dist[v] = bd + cost(v); prev[v] = u; } } }
      let end = c1, route = []; for (let r = 0; r < n; r++) if (dist[r * n + c1] < dist[end]) end = r * n + c1; for (let c = end; c >= 0; c = prev[c]) route.unshift(g.pos(c));
      m.route = [{ x: CX - a.dir * 6.4, z: route[0].z }, ...route, { x: CX + a.dir * 6.8, z: route[route.length - 1].z }]; }
    if (a.show <= 0) m.fresh = false; if (a.age < m.t0) return null; const w = m.route[Math.min(m.wi, m.route.length - 1)]; if (dH(w.x, w.z) < .3 && m.wi < m.route.length - 1) m.wi++; return { ...m.route[Math.min(m.wi, m.route.length - 1)], now: true }; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} keer overgestoken` + (a.show > 0 ? ` · pad nog ${Math.ceil(a.show)} s zichtbaar` : '') },

{ id: 'build', isle: 'square', n: 'Bouwrace', tier: 2, T: 125, goal: 28,
  d: 'Je krijgt 700 credits en 60 seconden. Ga op een gele bouwplek staan en kies met 1 tot 4 een toren. Daarna loopt één megagolf van 36 vijanden over het pad. Je held vecht mee.', win: 'Doel: 28 van de 36 vijanden uitschakelen.',
  go: 'Bouwrace: 60 seconden bouwen met 700 credits. Ga op een gele plek staan en druk op 1 tot 4',
  init(a) { a.gold = 700; a.ph = 'build'; a.pt = 60; a.q = 0; a.qt = 0; a.dead = 0; a.leaks = 0;
    a.wp = [[-7.4, -4], [4, -4], [4, 0], [-4, 0], [-4, 4], [7.4, 4]].map(([x, z]) => ({ x: CX + x, z: CZ + z }));
    a.pads = [[-3, -2], [-.5, -2], [2, -2], [-2, 2], [.5, 2], [3, 2], [6, -2], [-6, 2], [0, -6], [0, 6]].map(([x, z]) => ({ x: CX + x, z: CZ + z, t: null })); api.place(CX - .5, CZ - 2); },
  card(a) { if (a.ph !== 'build') return []; const s = Object.keys(BT).map((k, i) => ({ ic: k, key: String(i + 1), n: BT[k].n, cost: BT[k].cost, poor: a.gold < BT[k].cost, d: BT[k].d + ' Ga op een gele bouwplek staan.', act: () => buildAt(a, k) }));
    s[11] = { ic: 'up', key: 'G', n: 'Stuur de megagolf', d: 'Klaar met bouwen? Stuur de golf meteen.', act: () => { a.pt = 0; } }; return s; },
  upd(a, dt) { for (let i = 0; i < 5; i++) { const p = a.wp[i], q = a.wp[i + 1]; rect(a, (p.x + q.x) / 2, (p.z + q.z) / 2, Math.abs(q.x - p.x) + 1, Math.abs(q.z - p.z) + 1, '#6a4a36', .85); }
    for (const p of a.pads) if (!p.t) mark(a, p.x, p.z, .8, dH(p.x, p.z) < 1.7 ? '#35ff5a' : '#f6cf4d', .45);
    if (a.ph === 'build') { a.pt -= dt; if (a.pt <= 0) { a.ph = 'wave'; a.q = 36; a.qt = 0; api.toast('De megagolf komt eraan!', 2500); } }
    else if (a.q > 0) { a.qt -= dt; if (a.qt <= 0) { a.qt = .5; a.q--; const k = a.q % 6 === 0 ? 'tank' : a.q % 3 === 0 ? 'dog' : 'inf';
        add(a, k, { x: a.wp[0].x, z: a.wp[0].z, hp: k === 'tank' ? 480 : k === 'dog' ? 60 : 110, sp: k === 'tank' ? 1.2 : k === 'dog' ? 2.6 : 1.7, dmg: 0, wi: 1, prog: 0, slT: 0, die() { a.dead++; },
          ai(m, dt) { const w = a.wp[m.wi], v = m.sp * (m.slT > 0 ? .5 : 1); m.slT -= dt; m.prog += v * dt; if (go(m, w.x, w.z, v, dt) < .05 && ++m.wi >= a.wp.length) { m.hp = 0; a.leaks++; } } }); } }
    else if (!alive(a)) { a.pts = a.dead; a.fin = true; return; }
    for (const p of a.pads) { const t = p.t; if (!t) continue; const b = BT[t.k]; t.cd -= dt; if (t.cd > 0) continue; let best = null;
      for (const m of a.mobs) if (m.hp > 0 && hyp(m.x - p.x, m.z - p.z) <= b.range && (!best || m.prog > best.prog)) best = m;
      if (!best) { t.cd = 0; continue; } t.cd = 1 / b.rate; if (t.obj) t.obj.userData.head.rotation.y = -Math.atan2(best.z - p.z, best.x - p.x);
      api.beam(p.x, .9, p.z, best.x, .5, best.z, t.k === 'rail' ? '#45c8ff' : t.k === 'cryo' ? '#bff3ff' : '#ffd98a', t.k === 'rail' ? .13 : .05, t.k === 'rail' ? .28 : .1);
      if (b.splash) { api.ring(best.x, best.z, b.slow ? '#9fe8ff' : '#ffb060', b.splash, .3); for (const m of a.mobs) if (m.hp > 0 && hyp(m.x - best.x, m.z - best.z) <= b.splash) { if (b.slow) m.slT = 1.8; api.mobHit(m, b.dmg); } }
      else api.mobHit(best, b.dmg); }
    a.pts = a.dead; },
  // drie torens langs het pad zetten, de golf sturen en dan meevechten bij de vijand die het verst is
  bot(a, m) { if (a.ph === 'build') { if (!m.plan) { const set = [[['rail', 'flak', 'flak']], [['rail', 'cryo', 'flak']], [['flak', 'flak', 'cryo', 'sentry']]][Math.floor(rand() * 3)][0], pads = shuffle([0, 1, 2, 3, 4, 5]); m.plan = set.map((k, i) => [a.pads[pads[i]], k]); }
      while (m.plan.length && (m.plan[0][0].t || a.gold < BT[m.plan[0][1]].cost)) m.plan.shift();
      if (!m.plan.length) { if (!m.send) m.send = a.age + 1 + rand() * 4; if (a.age > m.send) a.pt = 0; return { x: a.wp[3].x, z: a.wp[3].z + 1.5 }; }
      const [p, k] = m.plan[0]; if (dH(p.x, p.z) < .9) buildAt(a, k); return { x: p.x, z: p.z }; }
    const t = target(a, o => o.prog || 0); return t ? reach(t, .7) : { x: a.wp[4].x, z: a.wp[4].z - 1.5 }; },
  sub: a => a.ph === 'build' ? `Bouwen: nog ${Math.ceil(a.pt)} s · ${a.gold} credits · G stuurt de golf` : `${a.dead} uitgeschakeld · ${a.leaks} ontsnapt · doel ${a.K.goal}` },

/* ============ uitdagend ============ */
{ id: 'dark', isle: 'round', n: 'Stroomuitval', tier: 3, T: 60, goal: 59, regen: .012,
  d: 'Het licht valt uit. Je ziet alleen een kleine lichtkring rond je held, en monsters duiken pas op als ze vlakbij zijn. Elk monster dat je uitschakelt geeft wat levenspunten terug.', win: 'Doel: 60 seconden overleven.',
  go: 'Stroomuitval: je ziet alleen wat vlak bij je is. Blijf in beweging',
  init(a) { a.dark = 3.4; a.sp = 2; },
  upd(a, dt) { const h = H(); survive(a); mark(a, h.x, h.z, a.dark, '#ffe2b0', .07); a.sp -= dt; if (a.sp <= 0 && alive(a) < 9) { a.sp = Math.max(1.1, 2.3 - .02 * a.age); hunters(a); } },
  bot(a, m) { return brawl(a, m); },
  sub: (a, sec) => `${left(sec)} · overleef het donker` },

{ id: 'mirror', isle: 'round', n: 'Spiegelwereld', tier: 3, T: 45, goal: 10,
  d: 'De besturing staat omgekeerd: vooruit is achteruit en links is rechts. Loop zo langs tien bakens, om de rode stekelvelden heen en tussen de schuivende zagen door.', win: 'Doel: 10 bakens in 45 seconden. Hoe sneller, hoe hoger je score.',
  go: 'Spiegelwereld: je besturing staat omgekeerd. Haal de groene bakens',
  init(a) { a.flip = true; a.n = 0; a.im = 0; a.tr = []; a.saws = []; for (let k = 0; k < 300 && a.tr.length < 7; k++) { const p = pt(2.8, AR - 1.2); if (!a.tr.some(o => hyp(o.x - p.x, o.z - p.z) < 3.2)) a.tr.push(p); }
    for (let i = 0; i < 3; i++) saw(a, 3 + i * .6); this.next(a); api.place(CX, CZ); },
  next(a) { for (let k = 0; k < 300; k++) { const p = pt(1, AR - 1.2); if (dH(p.x, p.z) > 6 && !a.tr.some(o => hyp(o.x - p.x, o.z - p.z) < 2.2)) { a.b = p; return; } } a.b = pol(rand() * TAU, 3); },
  upd(a, dt) { const h = H(); let hit = 0; a.im -= dt;
    for (const o of a.tr) { mark(a, o.x, o.z, 1, '#e8372a', .55); if (dH(o.x, o.z) < 1) hit = 20; }
    for (const s of a.saws) { const p = sawPos(a, s); orb(a, p.x, p.z, .5, .45, '#ff3a1a'); mark(a, p.x, p.z, .7, '#ff3a1a', .3); if (dH(p.x, p.z) < .95) hit = 24; }
    if (hit && a.im <= 0) { a.im = .9; api.hurt(hit); api.ball(h.x, .8, h.z, '#ff3a1a', .2, 1, .25); }
    mark(a, a.b.x, a.b.z, 1.1, '#35ff5a', .5); orb(a, a.b.x, a.b.z, 1.5, .3, '#35ff5a');
    if (dH(a.b.x, a.b.z) >= 1.1) return; a.n++; a.pts = a.n; api.ring(a.b.x, a.b.z, '#35ff5a', 1.5, .3);
    if (a.n >= 10) { a.pts = 10 + Math.ceil(a.t); a.fin = true; } else this.next(a); },
  bot(a) { return steer(a.b.x, a.b.z, [...a.tr.map(o => [o.x, o.z, 2.1]), ...a.saws.map(s => { const p = sawPos(a, s); return [p.x, p.z, 2.3]; })]); },
  sub: (a, sec) => `${left(sec)} · baken ${Math.min(10, a.n + 1)} van 10 · besturing omgekeerd` },

{ id: 'shrink', isle: 'round', n: 'Krimpende arena', tier: 3, T: 70, goal: 69, regen: .02,
  d: 'Een giftige ring sluit de arena in tot er een klein rondje overblijft. Buiten de groene kring verlies je snel levenspunten, en ondertussen blijven er monsters op je af komen.', win: 'Doel: 70 seconden overleven.',
  go: 'Krimpende arena: blijf binnen de groene kring en houd de monsters van je af',
  init(a) { a.sp = 2; },
  upd(a, dt) { const h = H(), R = AR - (AR - 4.2) * Math.min(1, a.age / 60); survive(a); mark(a, CX, CZ, 9.1, '#8a2be2', .3, .06); mark(a, CX, CZ, R, '#35ff5a', .22, .064);
    if (dH(CX, CZ) > R) { h.hp -= 20 * dt; if (rand() < dt * 6) api.ball(h.x, .6, h.z, '#b06aff', .1, .7, .3, .6); }
    a.sp -= dt; if (a.sp <= 0 && alive(a) < 5) { a.sp = Math.max(1.3, 2.2 - .02 * a.age); hunters(a, { val: 2, dmg: .75 }); } },
  // vechten, maar binnen de kring blijven
  bot(a, m) { const R = Math.max(1, AR - (AR - 4.2) * Math.min(1, a.age / 60) - 1.2), g = brawl(a, m, R + 1.2), d = hyp(g.x - CX, g.z - CZ); return d > R ? { ...g, x: CX + (g.x - CX) * R / d, z: CZ + (g.z - CZ) * R / d } : g; },
  sub: (a, sec) => `${left(sec)} · blijf in de groene kring` },

{ id: 'notower', isle: 'square', n: 'Torenloos', tier: 3, T: 75, goal: 1, regen: .01,
  d: 'Je torens staan uit. Hun stroom gaat naar je held, die daardoor twee keer zo snel aanvalt. Veertig vijanden lopen over drie banen van links naar rechts en letten niet op jou.', win: 'Doel: laat er minder dan 5 door. Elke uitgeschakelde vijand is een punt.',
  go: 'Torenloos: je held valt dubbel zo snel aan. Laat er minder dan vijf door',
  init(a) { a.haste = 2; a.q = 40; a.qt = 2.5; a.dead = 0; a.leaks = 0; },
  upd(a, dt) { for (const z of [-3, 0, 3]) rect(a, CX, CZ + z, 16.4, 1, '#6a4a36', .7); a.qt -= dt;
    if (a.q > 0 && a.qt <= 0) { a.qt = Math.max(.75, 1.6 - .018 * a.age); a.q--; const k = a.q % 5 === 0 ? 'tank' : a.q % 2 ? 'inf' : 'dog';
      add(a, k, { x: CX - 8, z: CZ + [-3, 0, 3][Math.floor(rand() * 3)], a: 0, hp: k === 'tank' ? 150 : k === 'inf' ? 42 : 26, sp: k === 'tank' ? 1.4 : k === 'inf' ? 2.1 : 3.1, dmg: 0, die() { a.dead++; },
        ai(m, dt) { m.x += m.sp * dt; m.a = 0; if (m.x > CX + 8) { m.hp = 0; a.leaks++; api.toast(`Doorgebroken: ${a.leaks} van 5`, 1200); } } }); }
    a.pts = a.dead; if (a.leaks >= 5) { a.fail = true; a.fin = true; } else if (a.q <= 0 && !alive(a)) a.fin = true; },
  // wie het dichtst bij de overkant is eerst
  bot(a) { const t = target(a, o => o.x); return t ? reach(t, .7) : { x: CX + 1, z: CZ }; },
  sub: a => `${a.dead} uitgeschakeld · ${a.leaks} van 5 door · nog ${a.q + alive(a)} te gaan` },

{ id: 'twins', isle: 'round', n: 'Tweelingbazen', tier: 3, T: 120, goal: 100, regen: .015,
  d: 'Twee bazen: de paarse loopt op je af en haalt uit met een klap rondom (stap uit de rode cirkel), de oranje blijft op afstand en legt inslagen onder je voeten. Valt de ene, dan moet de andere binnen 6 seconden volgen, anders staat de eerste weer op met halve levens. Je held valt aan wat het dichtst bij staat.', win: 'Doel: beide bazen vellen binnen 2 minuten.',
  go: 'Tweelingbazen: vel ze vlak na elkaar, anders staat de eerste weer op',
  init(a) { a.pair = [twin(a, 0), twin(a, 1)]; a.down = -1; a.rv = 0; api.place(CX, CZ + 5, -Math.PI / 2); },
  upd(a, dt) { const [p, q] = a.pair, won = () => { a.pts = 100 + Math.ceil(a.t); a.fin = true; };
    if (p.hp <= 0 && q.hp <= 0) return won();
    if (a.down < 0) { const i = p.hp <= 0 ? 0 : q.hp <= 0 ? 1 : -1; if (i >= 0) { a.down = i; a.rv = 6; api.toast('Eén is geveld. Vel de ander binnen 6 seconden!', 3000); } return; }
    a.rv -= dt; if (a.rv > 0) return; a.pair[a.down] = twin(a, a.down, 350); a.down = -1; api.toast('Te laat: de tweeling staat weer op met halve levens.', 3000); },
  // de baas met de meeste levens eerst, zodat ze kort na elkaar vallen; en zo gaan staan dat juist die het dichtst bij is
  bot(a, m) { const [p, q] = a.pair, h = H(), fp = p.hp / p.max, fq = q.hp / q.max, t = p.hp <= 0 ? q : q.hp <= 0 ? p : fp > fq + .08 ? p : fq > fp + .08 ? q : m.t && m.t.hp > 0 ? m.t : p, o = t === p ? q : p; m.t = t;
    const d = dH(t.x, t.z) || 1, w = Math.max(1.1, api.range() * .8); let x = t.x + (h.x - t.x) / d * w, z = t.z + (h.z - t.z) / d * w;
    if (o.hp > 0 && hyp(x - o.x, z - o.z) < w + .8) { const ex = t.x - o.x, ez = t.z - o.z, e = hyp(ex, ez) || 1; x = t.x + ex / e * w; z = t.z + ez / e * w; } return { x, z }; },
  sub: (a, sec) => { const f = m => Math.max(0, Math.ceil(m.hp / m.max * 100)) + '%'; return `${left(sec)} · paars ${f(a.pair[0])} · oranje ${f(a.pair[1])}` + (a.down >= 0 ? ` · nog ${Math.ceil(a.rv)} s!` : ''); } },

{ id: 'hunter', isle: 'round', n: 'Jager', tier: 3, T: 60, goal: 18, regen: .01,
  d: 'Een onverslaanbaar monster jaagt op je en wordt steeds sneller. Het neemt wijde bochten, dus een scherpe haak schudt het af. Raakt het je, dan vlieg je weg en verlies je veel levenspunten. Pak ondertussen de gouden bollen.', win: 'Doel: 18 bollen in 60 seconden.',
  go: 'Jager: pak de gouden bollen en blijf uit de klauwen van de jager',
  init(a) { a.or = []; for (let i = 0; i < 4; i++) a.or.push(pt(1, AR - 1));
    a.hu = add(a, 'mech', { ...prop, x: CX, z: CZ, es: 2.7, tint: '#ff3a1a', vx: 0, vz: 0, st: 2.5,
      ai(m, dt) { const h = H(), v = api.speed() * (.82 + .0065 * a.age), dx = h.x - m.x, dz = h.z - m.z, d = hyp(dx, dz) || 1; m.st -= dt; if (m.st > 0) return;
        m.vx += (dx / d * v - m.vx) * 2 * dt; m.vz += (dz / d * v - m.vz) * 2 * dt; m.x += m.vx * dt; m.z += m.vz * dt; clampIn(m, AR - .6); m.a = Math.atan2(m.vz, m.vx);
        if (d < 1.5) { api.hurt(38); api.push(dx / d * 3, dz / d * 3); api.ring(h.x, h.z, '#ff3a1a', 1.6, .3); m.st = 1.6; m.vx = m.vz = 0; } } }); api.place(CX + 6, CZ, Math.PI); },
  upd(a) { mark(a, a.hu.x, a.hu.z, 1.5, '#ff3a1a', a.hu.st > 0 ? .12 : .3);
    for (let i = 0; i < a.or.length; i++) { const o = a.or[i]; orb(a, o.x, o.z, .7, .26, '#ffc21a'); mark(a, o.x, o.z, .6, '#ffc21a', .3);
      if (dH(o.x, o.z) < 1) { a.pts++; api.ring(o.x, o.z, '#ffd24a', 1, .3); let p; do p = pt(1, AR - 1); while (dH(p.x, p.z) < 5); a.or[i] = p; } } },
  // bollen pakken die niet bij de jager liggen; komt hij te dichtbij, dan een scherpe haak dwars op zijn vaart
  bot(a) { const h = H(), u = a.hu, dx = h.x - u.x, dz = h.z - u.z, d = hyp(dx, dz) || 1;
    if (u.st <= 0 && d < 3.4) { const v = hyp(u.vx, u.vz) || 1, px = -u.vz / v, pz = u.vx / v, s = px * dx + pz * dz >= 0 ? 1 : -1; return { x: h.x + px * s * 3 + dx / d, z: h.z + pz * s * 3 + dz / d, sprint: d < 2.4, now: true }; }
    let o = null, bv = 1e9; for (const p of a.or) { const hu = hyp(p.x - u.x, p.z - u.z), v = dH(p.x, p.z) + (hu < 3 ? 6 : 0) - Math.min(hu, 6) * .3; if (v < bv) { bv = v; o = p; } } return o ? { x: o.x, z: o.z } : null; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} bollen` },

/* ============ heel uitdagend ============ */
{ id: 'bullets', isle: 'round', n: 'Bullet hell', tier: 4, T: 45, goal: 44,
  d: 'De toren in het midden vuurt patronen af: eerst een draaiende spiraal, na 10 seconden ringen met één opening en na 30 seconden ook gerichte waaiers. Eén treffer en je ligt eruit.', win: 'Doel: 45 seconden overleven zonder één treffer.',
  go: 'Bullet hell: één treffer is dodelijk. Zoek de gaten tussen de kogels',
  init(a) { a.bs = []; a.block = (x, z) => hyp(x - CX, z - CZ) < 1.5; api.tower('geers', CX, CZ, 1.5); a.c1 = 0; a.c2 = 2; a.c3 = 1; a.sa = rand() * TAU; },
  upd(a, dt) { const h = H(), lvl = Math.floor(a.age / 10), arms = lvl > 3 ? 3 : 2; survive(a);
    if (a.age > 2.5) { a.c1 -= dt; a.c2 -= dt; a.c3 -= dt; a.sa += dt * (1.2 + .12 * lvl);
      if (a.c1 <= 0) { a.c1 = .26; for (let k = 0; k < arms; k++) shoot(a, a.sa + k * TAU / arms, 3.4); }
      if (lvl >= 1 && a.c2 <= 0) { a.c2 = Math.max(2, 3.2 - .3 * lvl); const g = rand() * TAU; for (let k = 0; k < 20; k++) { const an = k * TAU / 20; let da = Math.abs(an - g) % TAU; if (da > Math.PI) da = TAU - da; if (da > .7) shoot(a, an, 2.6); } }
      if (lvl >= 3 && a.c3 <= 0) { a.c3 = 1.8; const an = Math.atan2(h.z - CZ, h.x - CX); for (let k = -1; k <= 1; k++) shoot(a, an + k * .2, 4.2); } }
    bullets(a, dt, '#ff7a3c', .36, () => { api.ball(h.x, .8, h.z, '#ff3a1a', .2, 1.4, .3); api.hurt(1e6); }); },
  // ver van de toren is de meeste ruimte tussen de kogels
  bot(a) { const h = H(), an = Math.atan2(h.z - CZ, h.x - CX); return { ...pol(an, 6.3), dodge: a.bs, rad: .62, now: true }; },
  sub: (a, sec) => `${left(sec)} · één treffer is dodelijk` },

{ id: 'relay', isle: 'cross', n: 'Estafette', tier: 4, T: 36, goal: 12,
  d: 'Breng het stokje twaalf keer van post naar post over het kruis. De zagen schuiven langs de armen. Na elke overdracht komt er een zaag bij en er vallen inslagen op je hielen. Het team deelt één balk van vijf levens die niet herstelt: elke fout telt voor iedereen.', win: 'Doel: 12 overdrachten in 36 seconden met hooguit 4 fouten.',
  go: 'Estafette: breng het stokje naar de groene post. Vijf levens voor het hele parcours',
  init(a) { a.n = 0; a.im = 0; a.bar = 5; a.saws = []; a.zt = 3; a.st = [0, 1, 2, 3].map(i => pol(i * TAU / 4, 6.9)); a.to = 2; saw(a, 3.2); saw(a, 3.6); saw(a, 4); api.place(a.st[0].x, a.st[0].z); },
  upd(a, dt) { const h = H(), t = a.st[a.to]; a.im -= dt; a.zt -= dt;
    if (a.hit && a.im <= 0) { a.bar--; a.im = 1; api.toast(a.bar > 0 ? `Fout! Nog ${a.bar} ${a.bar === 1 ? 'leven' : 'levens'}` : 'De balk is leeg', 1500); }
    h.hp = api.maxHp() * a.bar / 5; if (a.bar <= 0) return;
    for (const s of a.st) mark(a, s.x, s.z, 1.3, s === t ? '#35ff5a' : '#6c727c', s === t ? .5 : .2); orb(a, t.x, t.z, 1.6, .28, '#35ff5a'); orb(a, h.x, h.z, 2.05, .2, '#f6cf4d');
    for (const s of a.saws) { const p = sawPos(a, s); orb(a, p.x, p.z, .5, .45, '#ff3a1a'); mark(a, p.x, p.z, .7, '#ff3a1a', .3); if (a.im <= 0 && dH(p.x, p.z) < .95) { api.hurt(1); api.ball(h.x, .8, h.z, '#ff3a1a', .2, 1, .25); } }
    if (a.zt <= 0) { a.zt = Math.max(1.2, 2.4 - .12 * a.n); zone(a, h.x, h.z, 1.7, .9, 1); }
    if (dH(t.x, t.z) >= 1.3) return; a.n++; a.pts = a.n; api.ring(t.x, t.z, '#35ff5a', 1.6, .4);
    if (a.n >= 12) { a.pts = 12 + Math.ceil(a.t); a.fin = true; return; } let k; do k = Math.floor(rand() * 4); while (k === a.to); a.to = k; if (a.saws.length < 11) saw(a, 3.6 + a.n * .25); },
  bot(a) { const t = a.st[a.to]; return steer(t.x, t.z, a.saws.map(s => { const p = sawPos(a, s); return [p.x, p.z, 2.2]; }), { sprint: true }); },
  sub: (a, sec) => `${left(sec)} · overdracht ${Math.min(12, a.n + 1)} van 12 · ${a.bar} van 5 levens` },

{ id: 'geers', isle: 'round', n: 'De Geers draait door', tier: 4, T: 100, goal: 3, regen: .02,
  d: 'Een op hol geslagen superturret vuurt op je vanuit het midden. Zet hem uit met de drie schakelaars aan de rand: blijf even op een schakelaar staan om hem aan te zetten. Hij blijft maar kort aan, dus alle drie moeten in één ren branden. Dat moet drie keer, en elke keer wordt The Geers kwader.', win: 'Doel: 3 keer alle schakelaars tegelijk aan binnen 100 seconden.',
  go: 'De Geers draait door: zet alle drie de schakelaars aan voordat de eerste weer uitvalt',
  init(a) { a.block = (x, z) => hyp(x - CX, z - CZ) < 1.7; api.tower('geers', CX, CZ, 1.9); a.phs = 0; a.bs = []; a.c1 = 3; a.c2 = 5; a.rot = rand() * TAU; a.im = 0; this.place(a); },
  place(a) { const o = rand() * TAU; a.sw = [0, 1, 2].map(i => ({ ...pol(o + i * TAU / 3, 6.6), t: 0, h: 0 })); },
  upd(a, dt) { const h = H(), lx = h.x - CX, lz = h.z - CZ, win = 22.6 / api.speed() + 3.8; let on = 0; a.im -= dt; a.c1 -= dt; a.c2 -= dt;
    for (const s of a.sw) { const near = dH(s.x, s.z) < 1.3; if (s.t > 0) s.t -= dt; else if (near) { s.h += dt; if (s.h >= 1) { s.t = win; s.h = 0; api.ring(s.x, s.z, '#35ff5a', 1.6, .4); } } else s.h = 0;
      if (s.t > 0) on++; mark(a, s.x, s.z, 1.3, s.t > 0 ? '#35ff5a' : '#f6cf4d', s.t > 0 ? .25 + .55 * s.t / win : .35 + .4 * s.h); orb(a, s.x, s.z, 1.3, .22, s.t > 0 ? '#35ff5a' : '#f6cf4d'); }
    if (on >= 3) { a.phs++; a.pts = a.phs; api.ball(CX, 1.5, CZ, '#ffc83a', .5, 6, .7, .8); api.ring(CX, CZ, '#ffc83a', 8, .6); a.bs.length = 0; a.zones.length = 0;
      if (a.phs >= 3) { a.pts = 3 + Math.ceil(a.t); a.fin = true; return; } this.place(a); a.c1 = 2.5; api.toast(`Schakeling ${a.phs} van 3 gelukt. The Geers wordt kwader!`, 2500); }
    if (a.c1 <= 0) { a.c1 = [.46, .36, .28][a.phs]; shoot(a, Math.atan2(lz, lx) + (rand() - .5) * .5, 5.5, 1.5); }
    if (a.age > 3) { a.rot += (.36 + .1 * a.phs) * dt; // een draaiende straal, en vanaf de derde schakeling twee
      for (let k = 0; k < (a.phs > 1 ? 2 : 1); k++) { const c = Math.cos(a.rot + k * Math.PI), s = Math.sin(a.rot + k * Math.PI); glow(a, CX + c * AR / 2, CZ + s * AR / 2, AR, a.rot, '#ffb020', .85, .2);
        if (a.im <= 0 && lx * c + lz * s > .6 && Math.abs(lz * c - lx * s) < .45) { a.im = .8; api.hurt(22); api.ball(h.x, .8, h.z, '#ffb020', .2, 1, .25); } } }
    if (a.phs >= 1 && a.c2 <= 0) { a.c2 = 5.5 - a.phs; for (let k = 0; k < 3; k++) { const an = rand() * TAU, d = k ? 2.2 : 0; zone(a, h.x + Math.cos(an) * d, h.z + Math.sin(an) * d, 1.7, 1.1, 30); } }
    bullets(a, dt, '#ffc83a', .45, () => { api.hurt(10); api.ball(h.x, .8, h.z, '#ffc83a', .1, .6, .2); }); },
  // de dichtstbijzijnde schakelaar die nog uit staat, en daar blijven staan tot hij aan is; ondertussen de kogels ontwijken zonder eraf te stappen
  bot(a, m) { let s = m.s && m.s.t <= 0 && a.sw.includes(m.s) ? m.s : null, bd = 1e9; if (!s) for (const o of a.sw) { if (o.t > 0) continue; const d = dH(o.x, o.z); if (d < bd) { bd = d; s = o; } } m.s = s; if (!s) return null;
    const on = dH(s.x, s.z) < 1.2; return { x: s.x - (s.x - CX) * .05, z: s.z - (s.z - CZ) * .05, dodge: a.bs, rad: .7, leash: on ? { x: s.x, z: s.z, r: 1.15 } : null, sprint: !on }; },
  sub: (a, sec) => `${left(sec)} · schakeling ${Math.min(3, a.phs + 1)} van 3 · ${a.sw.filter(s => s.t > 0).length} van 3 schakelaars aan` },

{ id: 'horde', isle: 'round', n: 'Overleef de 100', tier: 4, T: 100, goal: 99,
  d: 'Een eindeloze horde die elke 10 seconden sterker en sneller wordt en met meer tegelijk binnenkomt. Elk monster dat je uitschakelt geeft wat levenspunten terug. Blijf lopen en laat je niet insluiten.', win: 'Doel: 100 seconden overleven.',
  go: 'Overleef de 100: de horde wordt elke 10 seconden sterker',
  init(a) { a.sp = 1.5; a.lv = 0; },
  upd(a, dt) { const L = Math.floor(a.age / 10); survive(a); if (L > a.lv) { a.lv = L; api.toast(`Golf ${L + 1} van 10: de horde wordt sterker`, 1800); } a.sp -= dt;
    if (a.sp <= 0 && alive(a) < 15) { a.sp = Math.max(.5, 2.1 * Math.pow(.86, L)); hunters(a, { hp: Math.pow(1.19, L), dmg: Math.pow(1.11, L), sp: 1 + .022 * L, big: L > 4 }); } },
  bot(a, m) { return brawl(a, m); },
  sub: (a, sec) => `${left(sec)} · golf ${Math.min(10, a.lv + 1)} van 10` }
];
list.center = (x, z, k) => { CX = x; CZ = z; ISLE = k; };
return list;
};
