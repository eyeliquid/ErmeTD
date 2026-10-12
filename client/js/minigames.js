// De minigames. In een potje kiest game.js er op de tientallen een willekeurige uit (level 50 is altijd De Slapende Geers);
// via de knop Minigames in de lobby speel je ze los.
//
// Elke minigame is een beschrijving:
//   id, n      sleutel en naam
//   isle       het eiland waarop hij gespeeld wordt: round (rond), square (vierkant), cross (kruis), quad (vier eilandjes), casino of track (racecircuit)
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

// ---- autorace ----
const RSTEP = 15; // een poort per 15 punten van de baan: 12 poorten per ronde
// een willekeurige gesloten baan: negen punten rond het midden op wisselende afstand, glad gemaakt tot 180 punten. Het zaad volgt uit het potje (a.rnd), dus iedereen rijdt dezelfde baan.
const raceTrack = a => { const n = 9, cp = [], R = a.rnd; for (let i = 0; i < n; i++) { const an = i / n * TAU + (R() - .5) * .35, r = 5.4 + R() * 3.8; cp.push([Math.cos(an) * r, Math.sin(an) * r]); }
  const P = [], M = 20, cl = v => Math.max(-9.6, Math.min(9.6, v));
  for (let i = 0; i < n; i++) { const p0 = cp[(i - 1 + n) % n], p1 = cp[i], p2 = cp[(i + 1) % n], p3 = cp[(i + 2) % n];
    for (let k = 0; k < M; k++) { const t = k / M, t2 = t * t, t3 = t2 * t, f = (q0, q1, q2, q3) => .5 * (2 * q1 + (q2 - q0) * t + (2 * q0 - 5 * q1 + 4 * q2 - q3) * t2 + (3 * q1 - q0 - 3 * q2 + q3) * t3);
      P.push({ x: CX + cl(f(p0[0], p1[0], p2[0], p3[0])), z: CZ + cl(f(p0[1], p1[1], p2[1], p3[1])) }); } }
  a.trk = P; };

// ---- vissen ----
const FISH = [{ v: 1, col: '#ff9a3c', s: .2, sp: 2.4, w: 46 }, { v: 3, col: '#3d8bff', s: .32, sp: 1.4, w: 26 }, { v: 8, col: '#ffd24a', s: .24, sp: 3.4, w: 8 }, { v: -3, col: '#6a4a30', s: .26, sp: .6, w: 20 }];
const newFish = a => { let r = rand() * 100, k = FISH[0]; for (const f of FISH) { if (r < f.w) { k = f; break; } r -= f.w; } const p = pol(rand() * TAU, 1.2 + rand() * 3.8); a.fs.push({ x: p.x, z: p.z, dir: rand() * TAU, tt: rand(), k }); };
// de dobber: 2,3 voor de held, richting het midden van de vijver
const bobber = () => { const h = H(), d = dH(CX, CZ) || 1; return { x: h.x + (CX - h.x) / d * 2.3, z: h.z + (CZ - h.z) / d * 2.3 }; };
const fishReel = a => { if (a.cd > 0) return; a.cd = .7; const b = bobber(); let got = null;
  for (const f of a.fs) if (hyp(f.x - b.x, f.z - b.z) < .55 + f.k.s) { got = f; break; }
  if (!got) { api.ring(b.x, b.z, '#8fb6ff', .6, .25); return; }
  a.fs.splice(a.fs.indexOf(got), 1); newFish(a); a.pts = Math.max(0, a.pts + got.k.v); api.ring(b.x, b.z, got.k.col, 1.2, .35); api.ball(b.x, .6, b.z, got.k.col, .1, .6, .3);
  api.toast(got.k.v < 0 ? 'Een oude laars: −3' : `Beet! +${got.k.v}`, 1000); };

// ---- vier op een rij ----
const C4C = .55; // een vak is 0,55 breed; een bord is 7 kolommen bij 6 rijen
// acht borden op het vierkante eiland, vier aan elke kant van een middenstrook. z0 is de strook waar je voor het bord staat.
const c4Board = j => { const s = j < 4 ? -1 : 1, x = CX - 6.15 + (j % 4) * 4.1; return { x, s, z0: CZ + s * 3.65, row: r => CZ + s * (4.875 + (5 - r) * C4C) }; };
const c4Peer = (a, id) => a.local ? a.vp[id] : (api.peers(a).find(p => p.id === id) || {}).lp;
// de stand van mijn partij: het bord, wie aan zet is, en een winnaar (1 of 2) of een vol bord
function c4Game(a) { const o = c4Peer(a, a.opp), om = o && o.k === a.k ? o.mv || '' : '', p1 = a.p1 ? a.mv : om, p2 = a.p1 ? om : a.mv, g = { b: Array.from({ length: 7 }, () => []), turn: 1, win: 0, full: false, n: 0 };
  for (let i = 0; i < 42; i++) { const s = i % 2 ? p2 : p1, c = s[i >> 1]; if (c == null) { g.turn = i % 2 ? 2 : 1; break; } const col = g.b[+c]; if (col.length >= 6) continue; col.push(i % 2 ? 2 : 1); g.n++;
    if (!g.win && c4Four(g.b, +c, col.length - 1)) g.win = col[col.length - 1]; if (g.n >= 42) g.full = true; }
  return g; }
function c4Four(b, c, r) { const v = b[c][r], at = (x, y) => x >= 0 && x < 7 && y >= 0 && b[x][y] === v;
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { let n = 1; for (const s of [1, -1]) for (let k = 1; k < 4 && at(c + dx * k * s, r + dy * k * s); k++) n++; if (n >= 4) return true; } return false; }
// een zet voor een computer: winnen als het kan, de ander blokkeren, niets weggeven, en liefst in het midden. noise: kans op een willekeurige zet
function c4Ai(g, me, noise) { const ok = [0, 1, 2, 3, 4, 5, 6].filter(c => g.b[c].length < 6), tryC = (c, p) => { g.b[c].push(p); const w = c4Four(g.b, c, g.b[c].length - 1); g.b[c].pop(); return w; };
  if (!ok.length) return 3; if (rand() < noise) return ok[Math.floor(rand() * ok.length)];
  for (const c of ok) if (tryC(c, me)) return c; for (const c of ok) if (tryC(c, 3 - me)) return c;
  const safe = ok.filter(c => { g.b[c].push(me); const bad = g.b[c].length < 6 && tryC(c, 3 - me); g.b[c].pop(); return !bad; });
  const pool = safe.length ? safe : ok; return pool.sort((p, q) => Math.abs(p - 3) - Math.abs(q - 3) + (rand() - .5) * 1.5)[0]; }
const c4Col = a => { const b = a.board, h = H(); if (!b || Math.abs(h.z - b.z0) > .9 || Math.abs(h.x - b.x) > 1.95) return -1; return Math.max(0, Math.min(6, Math.floor((h.x - (b.x - 1.925)) / C4C))); };
function c4Drop(a, c) { if (a.ph !== 'play' || c < 0) return; const g = c4Game(a); if (g.turn !== (a.p1 ? 1 : 2) || g.win || g.full || g.b[c].length >= 6) return;
  a.mv += c; a.lp = { h: a.h, k: a.k, mv: a.mv }; a.turnT = 12; a.botT = .8 + rand() * 1.8; api.ring(a.board.x + (c - 3) * C4C, a.board.row(g.b[c].length), a.p1 ? '#e8372a' : '#f6cf4d', .5, .3); }
// indelen: iedereen die meedoet, in een volgorde die voor elke speler gelijk is
function c4Start(a) { const ids = [api.me, ...api.peers(a).map(p => p.id)].sort(), R = a.rnd; a.names = { [api.me]: 'jou' }; for (const p of api.peers(a)) a.names[p.id] = p.name;
  a.local = ids.length < 2; if (a.local) { a.vp = {}; for (let i = 1; i < 8; i++) { const id = 'cpu' + i; ids.push(id); a.vp[id] = { h: '', k: 0, mv: '' }; a.names[id] = 'Computer ' + i; } a.aiT = 1.5; }
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  a.ids = ids.slice(0, 16); a.rounds = Math.ceil(Math.log2(a.ids.length)); if (!a.ids.includes(api.me)) { a.ph = 'out'; a.res = 'Het toernooi is vol: je kijkt deze keer toe'; a.fail = true; a.fin = true; return; }
  a.ph = 'wait'; }
// de uitslag van een partij tussen x en y in ronde k: de winnaar, of null als hij nog loopt
function c4Winner(a, x, y, k) { const hx = x === api.me ? a.h : (c4Peer(a, x) || {}).h || '', hy = y === api.me ? a.h : (c4Peer(a, y) || {}).h || '';
  if (hx[k] === 'W' || hy[k] === 'L') return x; if (hy[k] === 'W' || hx[k] === 'L') return y; return null; }
// wie er in ronde k nog meedoen, of null als een partij in een eerdere ronde nog loopt
function c4Alive(a, k) { let L = a.ids; for (let r = 0; r < k; r++) { const n = []; for (let i = 0; i < L.length; i += 2) { if (i + 1 >= L.length) { n.push(L[i]); continue; } const w = c4Winner(a, L[i], L[i + 1], r); if (!w) return null; n.push(w); } L = n; } return L; }
// mijn volgende partij: [tegenstander, ik begin, bord], 'champ' als ik gewonnen heb, of null als ik nog moet wachten
function c4Next(a) { const L = c4Alive(a, a.k); if (!L) return null; if (L.length === 1) return 'champ'; const i = L.indexOf(api.me); if (i < 0) return null;
  if (i % 2 === 0 && i + 1 >= L.length) { a.h += 'W'; a.k++; a.lp = { h: a.h, k: a.k, mv: '' }; api.toast('Je hebt een vrije ronde', 1800); return null; }
  const j = i ^ 1; return [L[j], i % 2 === 0, i >> 1]; }
function c4Pair(a, nx) { const [opp, p1, slot] = nx; a.opp = opp; a.p1 = p1; a.board = c4Board(slot); a.mv = ''; a.lp = { h: a.h, k: a.k, mv: '' }; a.ph = 'play'; a.turnT = 12; a.oppT = 20; a.oppName = a.names[opp] || 'een tegenstander';
  if (a.local) a.vp[opp].k = a.k, a.vp[opp].mv = '';
  api.place(a.board.x, a.board.z0, a.board.s < 0 ? -Math.PI / 2 : Math.PI / 2); api.toast(`Ronde ${a.k + 1}: jij tegen ${a.oppName}. Jij speelt ${p1 ? 'rood en begint' : 'geel'}`, 2600); }
function c4Result(a, won, forfeit) { a.h += won ? 'W' : 'L';
  if (a.local) { a.vp[a.opp].h += won ? 'L' : 'W'; // de andere computerpartijen van deze ronde krijgen een willekeurige winnaar
    const R0 = c4AliveLocal(a, a.k); for (let i = 0; i < R0.length; i += 2) { const x = R0[i], y = R0[i + 1]; if (!y || x === api.me || y === api.me || x === a.opp || y === a.opp || a.vp[x].h.length > a.k) continue; const w = rand() < .5; a.vp[x].h += w ? 'W' : 'L'; a.vp[y].h += w ? 'L' : 'W'; } }
  a.lp = { h: a.h, k: a.k, mv: a.mv };
  if (!won) { a.pts = a.k; a.res = `Verloren van ${a.oppName}`; api.toast(`${a.oppName} wint. Je bent uitgeschakeld.`, 2500); a.ph = 'out'; a.fail = true; a.fin = true; return; }
  a.pts = a.k + 1; a.k++; a.ph = 'wait'; api.toast(forfeit ? `${a.oppName} komt niet meer opdagen: je gaat door` : `Gewonnen van ${a.oppName}!`, 2200); }
// zonder netwerk: wie er in ronde k meedoen, op basis van wat al bekend is (een lopende partij telt als nog open)
function c4AliveLocal(a, k) { let L = a.ids; for (let r = 0; r < k; r++) { const n = []; for (let i = 0; i < L.length; i += 2) n.push(i + 1 >= L.length ? L[i] : c4Winner(a, L[i], L[i + 1], r) || L[i]); L = n; } return L; }
function c4Draw(a, g) { const b = a.board, c = c4Col(a), mine = g.turn === (a.p1 ? 1 : 2);
  rect(a, b.x, CZ + b.s * 6.525, 3.95, 3.4, '#1d3a7a', .95); rect(a, b.x, b.z0, 3.95, 1.4, mine ? '#35cf4a' : '#3a4252', .35);
  if (c >= 0 && mine) rect(a, b.x + (c - 3) * C4C, CZ + b.s * 5.9, C4C - .06, 4.6, '#ffffff', .18);
  for (let x = 0; x < 7; x++) for (let r = 0; r < 6; r++) { const v = g.b[x][r]; mark(a, b.x + (x - 3) * C4C, b.row(r), .22, v === 1 ? '#e8372a' : v === 2 ? '#f6cf4d' : '#08101e', v ? .95 : .85); } }

// ---- snoepjesrijen ----
const CC = 1.7, CANDY = ['#e8372a', '#ff9a3c', '#f6cf4d', '#35cf4a', '#3d8bff', '#b06aff'];
const candyPos = i => ({ x: CX - 6.8 + ((i % 8) + .5) * CC, z: CZ - 6.8 + ((i >> 3) + .5) * CC });
const candyCell = () => { const h = H(), c = Math.floor((h.x - CX + 6.8) / CC), r = Math.floor((h.z - CZ + 6.8) / CC); return c < 0 || r < 0 || c > 7 || r > 7 ? -1 : r * 8 + c; };
// zou kleur t op plek i meteen een rij van drie maken met wat er links of boven al ligt?
const candyLine = (g, i, t) => { const c = i % 8, r = i >> 3; return (c >= 2 && g[i - 1] === t && g[i - 2] === t) || (r >= 2 && g[i - 8] === t && g[i - 16] === t); };
function candyRuns(g) { const out = new Set();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8;) { let e = c; while (e + 1 < 8 && g[r * 8 + e + 1] === g[r * 8 + c] && g[r * 8 + c] >= 0) e++; if (e - c >= 2) for (let k = c; k <= e; k++) out.add(r * 8 + k); c = e + 1; }
  for (let c = 0; c < 8; c++) for (let r = 0; r < 8;) { let e = r; while (e + 1 < 8 && g[(e + 1) * 8 + c] === g[r * 8 + c] && g[r * 8 + c] >= 0) e++; if (e - r >= 2) for (let k = r; k <= e; k++) out.add(k * 8 + c); r = e + 1; }
  return out; }
// een wissel die een rij oplevert, of null
function candyHint(g) { for (let i = 0; i < 64; i++) for (const j of [i + 1, i + 8]) { if ((j === i + 1 && i % 8 === 7) || j > 63) continue; [g[i], g[j]] = [g[j], g[i]]; const ok = candyRuns(g).size > 0; [g[i], g[j]] = [g[j], g[i]]; if (ok) return [i, j]; } return null; }
function candyPick(a) { const c = candyCell(); if (c < 0) return; if (a.sel < 0 || a.sel === c) { a.sel = a.sel === c ? -1 : c; return; }
  const s = a.sel, adj = Math.abs(s - c) === 8 || (Math.abs(s - c) === 1 && (s >> 3) === (c >> 3)); if (!adj) { a.sel = c; return; } a.sel = -1;
  const g = a.gr;[g[s], g[c]] = [g[c], g[s]]; let runs = candyRuns(g);
  if (!runs.size) { [g[s], g[c]] = [g[c], g[s]]; a.time -= 1.5; api.toast('Geen rij: dat kost tijd', 1000); return; }
  let chain = 0; while (runs.size) { chain++; for (const i of runs) { g[i] = -1; if (runs.size < 12) { const p = candyPos(i); api.ring(p.x, p.z, '#ffffff', .8, .25); } } a.n += runs.size; a.time += runs.size * .8 + (runs.size >= 4 ? 1 : 0) + (chain > 1 ? 1 : 0);
    for (let c2 = 0; c2 < 8; c2++) { let w = 7; for (let r = 7; r >= 0; r--) { const v = g[r * 8 + c2]; if (v >= 0) { g[w * 8 + c2] = v; w--; } } for (; w >= 0; w--) g[w * 8 + c2] = Math.floor(rand() * 6); }
    runs = candyRuns(g); }
  if (chain > 1) api.toast(`Kettingreactie ×${chain}!`, 1200);
  if (!candyHint(g)) { for (let i = 0; i < 64; i++) { let t; do t = Math.floor(rand() * 6); while (candyLine(g, i, t)); g[i] = t; } api.toast('Geen zetten meer: het veld wordt geschud', 1500); } }

// ---- rad van fortuin ----
// fx past het vak toe en geeft terug wat het waard is in credits (voor de score); s schaalt met het level
const WOF = [
  { lb: '+150', col: '#2f7a3c', fx: (a, s) => wofGold(150 * s) },
  { lb: 'Upgrade', col: '#2f5f9e', fx: () => { const n = api.upgrade(1); api.toast(n ? `Gratis upgrade: ${n}` : 'Gratis upgrade, maar er is niets te upgraden', 2200); return n ? 250 : 0; } },
  { lb: '−200', col: '#8a2a22', fx: (a, s) => wofGold(-200 * s) },
  { lb: '+300', col: '#2f7a3c', fx: (a, s) => wofGold(300 * s) },
  { lb: '+3\nlevens', col: '#9e2f6a', fx: () => { api.lives(3); api.toast('+3 levens', 2000); return 150; } },
  { lb: 'Bankroet', col: '#15171a', fx: () => { const g = api.gold(), l = Math.round(g * .3); api.gold(-l); api.toast(`Bankroet: je bent ${l} credits kwijt`, 2400); return -l; } },
  { lb: '+600', col: '#2f7a3c', fx: (a, s) => wofGold(600 * s) },
  { lb: 'Harnas', col: '#a8842c', fx: (a, s) => { const n = api.armourUp(); if (n) { api.toast(`Een stuk harnas: ${n}`, 2400); return 500; } return wofGold(500 * s); } },
  { lb: 'Upgrade\nkwijt', col: '#5a2a5e', fx: () => { const n = api.upgrade(-1); api.toast(n ? `Upgrade kwijt: ${n}` : 'Upgrade kwijt, maar je had niets om kwijt te raken', 2200); return n ? -250 : 0; } },
  { lb: 'Nog een\nkeer', col: '#2f8a8a', fx: a => { a.spins++; api.toast('Nog een keer draaien!', 2000); return 0; } },
  { lb: '−2\nlevens', col: '#8a2a22', fx: () => { api.lives(-2); api.toast('−2 levens', 2000); return -100; } },
  { lb: 'JACKPOT\n+1500', col: '#c79a2a', fx: (a, s) => wofGold(1500 * s) }];
const wofGold = d => { d = Math.round(d); api.gold(d); api.toast(d >= 0 ? `+${d} credits` : `${d} credits`, 2000); return d; };
function wofSpin(a) { a.ph = 'spin'; a.st = 0; a.on = 0; a.spins--; a.pick = Math.floor(rand() * WOF.length); const st = TAU / WOF.length, tgt = -Math.PI / 2 - a.pick * st;
  a.from = a.ang; a.to = a.ang + TAU * (4 + Math.floor(rand() * 2)) + (((tgt - a.ang) % TAU) + TAU) % TAU + (rand() - .5) * st * .6; }
function wofLand(a) { a.ph = 'show'; a.pt = 2.2; a.val += WOF[a.pick].fx(a, a.s); api.ring(CX, CZ, WOF[a.pick].col, 5, .5); }

const list = [
/* ============ redelijk makkelijk ============ */
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

{ id: 'ice', isle: 'square', n: 'IJsbaan', tier: 2, T: 60, goal: 2,
  d: 'De vloer is spekglad: je held komt traag op gang en glijdt door. Steek over naar het groene vlak zonder in een wak te glijden. Het groene vlak ligt elke keer op een andere plek aan de overkant. Na elke oversteek keert de richting om en komen er wakken bij.', win: 'Doel: 2 keer oversteken in 60 seconden.',
  go: 'IJsbaan: glij naar het groene vlak en blijf uit de wakken',
  // het groene vlak: steeds aan de overkant, maar op een andere hoogte dan de vorige keer. Je start waar het vorige lag.
  goal(a) { let z; do z = CZ + (rand() * 2 - 1) * 6; while (Math.abs(z - a.gz) < 3); a.sz = a.gz; a.gz = z; },
  init(a) { a.ice = 2.2; a.dir = 1; a.n = 0; a.gz = CZ; this.goal(a); a.sz = CZ; holes(a); api.place(CX - 7.2, CZ, 0); },
  upd(a) { const h = H(), gx = CX + a.dir * 7.2, gz = a.gz; floor(a, '#bfe9ff', .16); mark(a, gx, gz, 1.3, '#35ff5a', .5); mark(a, CX - a.dir * 7.2, a.sz, 1.3, '#f6cf4d', .2);
    for (const o of a.holes) { mark(a, o.x, o.z, o.r, '#000308', .94); if (dH(o.x, o.z) < o.r - .15) { api.hurt(12); api.ball(h.x, .4, h.z, '#9fe8ff', .2, 1.2, .4); api.place(CX - a.dir * 7.2, a.sz); api.toast('Je zakt door het ijs', 1500); } }
    if (dH(gx, gz) < 1.3) { a.n++; a.pts = a.n; a.dir = -a.dir; this.goal(a); holes(a); api.ring(gx, gz, '#35ff5a', 1.6, .4); api.toast(`Oversteek ${a.n} gehaald. Nu terug!`, 1500); } },
  // op het ijs stuur je vooruit: mikken op de overkant en om de wakken heen. Wie minder ver vooruitkijkt, glijdt er vaker in
  bot(a, m, ai) { const h = H(), gx = CX + a.dir * 7.2, look = .1 + .45 * ai.skill, px = h.x + (h.vx || 0) * look, pz = h.z + (h.vz || 0) * look; let fx = gx - h.x, fz = (a.gz - h.z) * (Math.abs(gx - h.x) < 3 ? 1.4 : .35); const fl = hyp(fx, fz) || 1; fx /= fl; fz /= fl;
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
  d: 'Twee bazen: de paarse loopt op je af en haalt uit met een klap rondom (stap uit de rode cirkel), de oranje blijft op afstand en legt inslagen onder je voeten. Valt de ene, dan moet de andere binnen 10 seconden volgen, anders staat de eerste weer op met halve levens. Je held valt aan wat het dichtst bij staat.', win: 'Doel: beide bazen vellen binnen 2 minuten.',
  go: 'Tweelingbazen: vel ze vlak na elkaar, anders staat de eerste weer op',
  init(a) { a.pair = [twin(a, 0), twin(a, 1)]; a.down = -1; a.rv = 0; api.place(CX, CZ + 5, -Math.PI / 2); },
  upd(a, dt) { const [p, q] = a.pair, won = () => { a.pts = 100 + Math.ceil(a.t); a.fin = true; };
    if (p.hp <= 0 && q.hp <= 0) return won();
    if (a.down < 0) { const i = p.hp <= 0 ? 0 : q.hp <= 0 ? 1 : -1; if (i >= 0) { a.down = i; a.rv = 10; api.toast('Eén is geveld. Vel de ander binnen 10 seconden!', 3000); } return; }
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

{ id: 'geers', isle: 'round', n: 'De Slapende Geers', tier: 4, T: 100, goal: 3, regen: .02,
  d: 'De Slapende Geers is wakker geschrokken. Hij staat in het midden, vuurt op je en slaat met zijn vuisten op de grond. Wieg hem weer in slaap met de drie schakelaars aan de rand: blijf even op een schakelaar staan om hem aan te zetten. Hij blijft maar kort aan, dus alle drie moeten in één ren branden. Dat moet drie keer, en elke keer wordt hij kwader.', win: 'Doel: 3 keer alle schakelaars tegelijk aan binnen 100 seconden.',
  go: 'De Slapende Geers is wakker: zet alle drie de schakelaars aan om hem in slaap te wiegen',
  init(a) { a.block = (x, z) => hyp(x - CX, z - CZ) < 2.1; a.boss = api.tower('sleeper', CX, CZ, 1.05, 'awake'); a.phs = 0; a.bs = []; a.c1 = 3; a.c2 = 5; a.rot = rand() * TAU; a.im = 0; this.place(a); },
  place(a) { const o = rand() * TAU; a.sw = [0, 1, 2].map(i => ({ ...pol(o + i * TAU / 3, 6.6), t: 0, h: 0 })); },
  upd(a, dt) { const h = H(), lx = h.x - CX, lz = h.z - CZ, win = 22.6 / api.speed() + 3.8; let on = 0; a.im -= dt; a.c1 -= dt; a.c2 -= dt;
    for (const s of a.sw) { const near = dH(s.x, s.z) < 1.3; if (s.t > 0) s.t -= dt; else if (near) { s.h += dt; if (s.h >= 1) { s.t = win; s.h = 0; api.ring(s.x, s.z, '#35ff5a', 1.6, .4); } } else s.h = 0;
      if (s.t > 0) on++; mark(a, s.x, s.z, 1.3, s.t > 0 ? '#35ff5a' : '#f6cf4d', s.t > 0 ? .25 + .55 * s.t / win : .35 + .4 * s.h); orb(a, s.x, s.z, 1.3, .22, s.t > 0 ? '#35ff5a' : '#f6cf4d'); }
    if (on >= 3) { a.phs++; a.pts = a.phs; api.ball(CX, 1.5, CZ, '#ffc83a', .5, 6, .7, .8); api.ring(CX, CZ, '#ffc83a', 8, .6); a.bs.length = 0; a.zones.length = 0;
      if (a.phs >= 3) { a.pts = 3 + Math.ceil(a.t); a.fin = true; return; } this.place(a); a.c1 = 2.5; api.slam(a.boss, 8); api.toast(`Schakeling ${a.phs} van 3 gelukt. De Slapende Geers wordt kwader!`, 2500); }
    if (a.c1 <= 0) { a.c1 = [.46, .36, .28][a.phs]; shoot(a, Math.atan2(lz, lx) + (rand() - .5) * .5, 5.5, 2.1); }
    if (a.age > 3) { a.rot += (.36 + .1 * a.phs) * dt; // een draaiende straal, en vanaf de derde schakeling twee
      for (let k = 0; k < (a.phs > 1 ? 2 : 1); k++) { const c = Math.cos(a.rot + k * Math.PI), s = Math.sin(a.rot + k * Math.PI); glow(a, CX + c * AR / 2, CZ + s * AR / 2, AR, a.rot, '#ffb020', .85, .2);
        if (a.im <= 0 && lx * c + lz * s > .6 && Math.abs(lz * c - lx * s) < .45) { a.im = .8; api.hurt(22); api.ball(h.x, .8, h.z, '#ffb020', .2, 1, .25); } } }
    if (a.phs >= 1 && a.c2 <= 0) { a.c2 = 5.5 - a.phs; api.slam(a.boss, 3); for (let k = 0; k < 3; k++) { const an = rand() * TAU, d = k ? 2.2 : 0; zone(a, h.x + Math.cos(an) * d, h.z + Math.sin(an) * d, 1.7, 1.1, 30); } }
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
  sub: (a, sec) => `${left(sec)} · golf ${Math.min(10, a.lv + 1)} van 10` },

/* ============ het casino ============ */
// Roulette op de levensgrote tafel. Vijf rondes: inzetten door op een vak te gaan staan, dan rolt de bal. Je speelt met je eigen credits.
// Het nummer volgt uit het potje (a.rnd), zodat alle spelers dezelfde bal zien vallen. De score is je winst over de vijf rondes.
{ id: 'roulette', isle: 'casino', n: 'Roulette', tier: 1, T: 130, goal: 1,
  d: 'Een levensgrote roulettetafel. Kies met 1 tot 4 je inzet en ga op een vak staan. Een nummer betaalt 35 keer je inzet, een dozijn 2 keer, en rood, zwart, even, oneven, laag of hoog 1 keer. Sta je bij "Rien ne va plus" op geen enkel vak, dan zet je die ronde niets in. Je speelt met je eigen credits: wat je wint mag je houden, wat je verliest ben je kwijt.', win: 'Doel: na vijf rondes winst hebben.',
  go: 'Roulette: kies je inzet met 1 tot 4 en ga op een vak van de tafel staan',
  init(a) { const R = api.roul; a.block = (x, z) => hyp(x - CX - R.wx, z - CZ - R.wz) < R.wr + .35; a.rd = 0; a.ph = 'gap'; a.pt = 3; a.chip = 100; a.net = 0; a.bet = null; a.num = -1; a.wa = 0; a.at = null;
    for (let i = 0; i < 6; i++) a.rnd(); api.place(CX + 3, CZ + 4.3, -Math.PI / 2); },
  card: a => [25, 100, 250, 500].map((c, i) => ({ ic: 'sell', key: String(i + 1), n: 'Inzet ' + c, cost: c, poor: api.gold() < c, on: a.chip === c, d: `Zet ${c} credits in op het vak waar je staat als de ronde sluit. Heb je minder, dan zet je in wat je hebt.`, act: () => { a.chip = c; } })),
  upd(a, dt) { const R = api.roul, h = H(), on = f => Math.abs(h.x - CX - f.x) <= f.w / 2 && Math.abs(h.z - CZ - f.z) <= f.d / 2, lit = (f, col, op) => rect(a, CX + f.x, CZ + f.z, f.w - .1, f.d - .1, col, op);
    a.at = R.f.find(on) || null; a.pt -= dt; a.wa += dt * (a.ph === 'spin' ? 2.4 : .4); api.wheel(a.wa);
    if (a.ph === 'gap' && a.pt <= 0) { if (a.rd >= 5) { a.pts = Math.max(0, a.net); a.fin = true; return; } a.rd++; a.ph = 'bet'; a.pt = 14; a.bet = null; a.num = -1; api.toast(`Ronde ${a.rd} van 5: plaats je inzet`, 2200); }
    else if (a.ph === 'bet' && a.pt <= 0) { const st = Math.min(a.chip, api.gold());
      if (a.at && st > 0) { a.bet = { f: a.at, st }; api.gold(-st); api.toast(`Rien ne va plus · ${st} credits op ${a.at.lb}`, 2500); } else api.toast('Rien ne va plus · je zet deze ronde niets in', 2500);
      a.num = Math.floor(a.rnd() * 37); a.ph = 'spin'; a.pt = 5; }
    else if (a.ph === 'spin' && a.pt <= 0) { const b = a.bet, nm = `${a.num} ${a.num === 0 ? 'groen' : R.red.has(a.num) ? 'rood' : 'zwart'}`; a.ph = 'show'; a.pt = 3.5;
      if (!b) api.toast(`Het is ${nm}`, 3000);
      else if (b.f.hit(a.num)) { const w = b.st * b.f.pay; api.gold(b.st + w); a.net += w; api.toast(`Het is ${nm}: je wint ${w} credits`, 3200); api.ring(h.x, h.z, '#ffd24a', 2.4, .6); }
      else { a.net -= b.st; api.toast(`Het is ${nm}: je verliest ${b.st} credits`, 3200); }
      a.pts = Math.max(0, a.net); }
    else if (a.ph === 'show' && a.pt <= 0) { a.ph = 'gap'; a.pt = 1; }
    if (a.ph === 'bet' && a.at) lit(a.at, '#35ff5a', .3 + .12 * Math.sin(a.age * 8));
    if (a.bet && a.ph !== 'bet') { lit(a.bet.f, '#ffd24a', .4); orb(a, CX + a.bet.f.x, CZ + a.bet.f.z, 2.4, .2, '#ffd24a'); }
    if (a.ph === 'show') for (const f of R.f) if (f.hit(a.num)) lit(f, '#ffffff', f.pay === 35 ? .55 + .2 * Math.sin(a.age * 12) : .16);
    if (a.num >= 0 && a.ph !== 'bet') { const u = a.ph === 'spin' ? Math.max(0, a.pt / 5) : 0, an = a.wa + R.order.indexOf(a.num) / 37 * TAU - 16 * u * u, rad = R.wr - .55 + .45 * u; // de bal loopt uit en valt in het vak
      orb(a, CX + R.wx + Math.cos(an) * rad, CZ + R.wz + Math.sin(an) * rad, .72, .15, '#ffffff'); } },
  bot(a, m) { if (a.ph !== 'bet') return null; const R = api.roul; // een bot kiest elke ronde een vak: meestal een kleur, een dozijn of even en oneven, soms een los nummer
    if (m.rd !== a.rd || !m.f) { m.rd = a.rd; const pick = rand() < .7 ? R.f.filter(f => f.pay < 35) : R.f.filter(f => f.pay === 35); m.f = pick[Math.floor(rand() * pick.length)]; m.t0 = a.age + 1 + rand() * 6; }
    return a.age < m.t0 ? null : { x: CX + m.f.x, z: CZ + m.f.z }; },
  sub: a => { const s = a.net ? ` · saldo ${a.net > 0 ? '+' : ''}${a.net}` : ''; if (a.ph === 'bet') return `Ronde ${a.rd} van 5 · inzet ${a.chip}` + (a.at ? ` op ${a.at.lb} (betaalt ${a.at.pay}×)` : ' · ga op een vak staan') + ` · nog ${Math.max(0, Math.ceil(a.pt))} s` + s;
    return (a.ph === 'spin' ? `Ronde ${a.rd} van 5 · de bal rolt` : a.ph === 'show' ? `Ronde ${a.rd} van 5 · het is ${a.num}` : a.rd ? `Ronde ${a.rd} van 5 gespeeld` : 'De tafel gaat open') + s; } },
/* ============ racen, vissen, vier op een rij, snoep en het rad ============ */
// Autorace: elke keer een andere baan. Iedereen rijdt in een auto met dezelfde topsnelheid; naast de baan rijd je door het gras en ga je veel langzamer.
{ id: 'race', isle: 'track', n: 'Autorace', tier: 2, T: 45, goal: 36,
  d: 'Op het racecircuit ligt elke keer een andere baan. Je rijdt in een auto: hij trekt traag op en glijdt door in de bochten, en in het gras ga je veel langzamer. Rijd drie rondes langs de gouden poorten.', win: 'Doel: drie rondes binnen 45 seconden. Hoe sneller, hoe hoger je score.',
  go: 'Autorace: drie rondes langs de gouden poorten. Blijf op het asfalt',
  init(a) { a.car = true; a.ice = 3.2; raceTrack(a); a.cp = 0; a.ni = 0; const P = a.trk, q = P[3]; api.place(P[0].x, P[0].z, Math.atan2(q.z - P[0].z, q.x - P[0].x)); },
  upd(a, dt) { const P = a.trk, N = P.length, W = 3.2; let bi = a.ni, bd = 1e9;
    for (let k = -30; k <= 30; k++) { const i = (a.ni + k + N) % N, d = dH(P[i].x, P[i].z); if (d < bd) { bd = d; bi = i; } } a.ni = bi;
    a.slow = (bd < W / 2 ? 8.5 : 3.4) / api.speed();
    for (let i = 0; i < N; i += 2) { const p = P[i], q = P[(i + 2) % N]; rect(a, (p.x + q.x) / 2, (p.z + q.z) / 2, hyp(q.x - p.x, q.z - p.z) + .3, W, '#2a2d31', .96, Math.atan2(q.z - p.z, q.x - p.x)); }
    { const p = P[0], q = P[1]; rect(a, p.x, p.z, .5, W, '#e8e8e8', .95, Math.atan2(q.z - p.z, q.x - p.x)); }
    if (a.cp >= 36) return; const c = P[(a.cp + 1) * RSTEP % N]; mark(a, c.x, c.z, 1.8, '#f6cf4d', .35); orb(a, c.x, c.z, 1.7, .28, '#f6cf4d');
    if (dH(c.x, c.z) >= 2.4) return; a.cp++; a.pts = a.cp; api.ring(c.x, c.z, '#f6cf4d', 1.8, .3);
    if (a.cp >= 36) { a.pts = 36 + Math.ceil(a.t); a.fin = true; } else if (a.cp % 12 === 0) api.toast(`Ronde ${a.cp / 12 + 1} van 3`, 1500); },
  bot(a, m) { const t = a.trk[(a.ni + 7) % a.trk.length]; return { x: t.x, z: t.z, now: true }; },
  sub: (a, sec) => `${left(sec)} · ronde ${Math.min(3, Math.floor(a.cp / 12) + 1)} van 3 · poort ${a.cp % 12 + 1} van 12` },

// Arcade vissen: de dobber drijft steeds een stukje voor je in de vijver, richting het midden. Loop langs de kant en haal op als er een vis onder zit.
{ id: 'fish', isle: 'round', n: 'Arcade vissen', tier: 1, T: 60, goal: 15,
  d: 'Midden op het ronde eiland ligt een vijver vol vissen. Je dobber drijft steeds een stukje voor je in het water. Loop langs de kant tot er een vis onder je dobber zwemt en haal op met F. Een kleine vis is 1 punt, een grote 3 en een gouden 8. Een oude laars kost 3 punten.', win: 'Doel: 15 punten in 60 seconden.',
  go: 'Arcade vissen: loop langs de vijver en haal op met F zodra er een vis onder je dobber zwemt',
  init(a) { a.block = (x, z) => hyp(x - CX, z - CZ) < 5.7; a.fs = []; for (let i = 0; i < 9; i++) newFish(a); a.cd = 0; const an = rand() * TAU, p = pol(an, 6.7); api.place(p.x, p.z, an + Math.PI); },
  card: a => [{ ic: 'up', key: 'F', n: 'Ophalen', d: 'Haal je hengel op. Zwemt er een vis onder je dobber, dan heb je hem.', wait: Math.ceil(a.cd), act: () => fishReel(a) }],
  upd(a, dt) { const b = bobber(); a.cd = Math.max(0, a.cd - dt);
    mark(a, CX, CZ, 5.6, '#123f5c', .9, .05); mark(a, CX, CZ, 5.75, '#8fb6ff', .18, .048);
    for (const f of a.fs) { f.tt -= dt; if (f.tt <= 0) { f.tt = .6 + rand() * 1.6; f.dir += (rand() - .5) * 2.2; }
      const r = hyp(f.x - CX, f.z - CZ); if (r > 5) f.dir = Math.atan2(CZ - f.z, CX - f.x) + (rand() - .5) * .6;
      f.x += Math.cos(f.dir) * f.k.sp * dt; f.z += Math.sin(f.dir) * f.k.sp * dt;
      orb(a, f.x, f.z, .12, f.k.s, f.k.col); orb(a, f.x - Math.cos(f.dir) * f.k.s * 1.2, f.z - Math.sin(f.dir) * f.k.s * 1.2, .12, f.k.s * .55, f.k.col); }
    const h = H(), dx = b.x - h.x, dz = b.z - h.z; glow(a, (h.x + b.x) / 2, (h.z + b.z) / 2, hyp(dx, dz), Math.atan2(dz, dx), '#e8e8e8', .45, .025);
    orb(a, b.x, b.z, .22 + .05 * Math.sin(a.age * 5), .13, a.cd > 0 ? '#ffffff' : '#e8372a'); mark(a, b.x, b.z, .7, '#ffffff', .12); },
  bot(a, m) { const b = bobber(); if (a.cd <= 0 && a.fs.some(f => f.k.v > 0 && hyp(f.x - b.x, f.z - b.z) < .55 + f.k.s)) fishReel(a);
    let best = null, bv = -1e9; for (const f of a.fs) { if (f.k.v <= 0) continue; const an = Math.atan2(f.z - CZ, f.x - CX), p = pol(an, 6.6), v = f.k.v * 2 - dH(p.x, p.z) * .6 - Math.abs(hyp(f.x - CX, f.z - CZ) - 4.3); if (v > bv) { bv = v; best = p; } }
    return best; },
  sub: (a, sec) => `${left(sec)} · ${a.pts} van ${a.K.goal} punten` },

// Vier op een rij: een toernooi met knock-out. Iedereen in de minigame wordt ingedeeld; wie wint gaat door, wie verliest gaat terug naar zijn vesting.
// Elke speler laat via a.lp zijn eigen zetten in de lopende partij zien (mv) en zijn uitslagen tot nu toe (h: W of L per ronde).
// Uit die gegevens rekent iedereen hetzelfde schema, dezelfde borden en dezelfde winnaars uit. Speel je alleen, dan zijn je tegenstanders computers.
{ id: 'connect4', isle: 'square', n: 'Vier op een rij', tier: 2, T: 420, goal: 3,
  d: 'Een toernooi vier op een rij, één tegen één met knock-out: wie wint gaat door naar de volgende ronde. Ga voor je bord in de strook staan, kies een kolom door ervoor te gaan staan en laat met F je steen vallen. Je hebt 12 seconden per zet. Is het bord vol zonder winnaar, dan wint wie als tweede begon. Speel je alleen, dan speel je tegen zeven computers.', win: 'Doel: het toernooi winnen.',
  go: 'Vier op een rij: ga voor je bord staan, kies een kolom en laat met F je steen vallen',
  init(a) { a.ph = 'intro'; a.pt = 3.5; a.h = ''; a.k = 0; a.mv = ''; a.lp = { h: '', k: 0, mv: '' }; a.turnT = 12; a.botT = 0; a.seen = 0; a.wait = 0; a.res = ''; },
  card: a => a.ph === 'play' ? [{ ic: 'up', key: 'F', n: 'Steen laten vallen', d: 'Laat je steen vallen in de kolom waar je voor staat.', act: () => c4Drop(a, c4Col(a)) }] : [],
  upd(a, dt) { a.pt -= dt;
    if (a.ph === 'intro') { if (a.pt <= 0) c4Start(a); return; }
    if (a.ph === 'out') return;
    if (a.ph === 'wait') { const nx = c4Next(a); if (nx === 'champ') { a.pts = a.k; a.fin = true; return; } if (nx) c4Pair(a, nx); }
    if (a.ph !== 'play') return;
    const g = c4Game(a), my = a.p1 ? 1 : 2; c4Draw(a, g);
    if (g.win || g.full) { const won = g.win ? g.win === my : !a.p1; c4Result(a, won); return; }
    const mine = g.turn === my;
    if (mine) { a.turnT -= dt; a.oppT = 20;
      if (api.bot() || a.turnT <= 0) { a.botT -= dt; if (a.botT <= 0 || a.turnT <= 0) c4Drop(a, c4Ai(g, my, api.bot() ? .2 : 1)); } }
    else { a.turnT = 12; a.botT = .8 + rand() * 1.8; if (a.local) { a.aiT -= dt; if (a.aiT <= 0) { a.vp[a.opp].mv += c4Ai(g, 3 - my, .25); a.aiT = .8 + rand() * 1.5; } }
      else { a.oppT -= dt; a.gone = c4Peer(a, a.opp) ? 0 : (a.gone || 0) + dt; if (a.oppT <= 0 || a.gone > 5) c4Result(a, true, true); } } }, // komt de ander niet meer opdagen, dan win je
  bot(a, m) { if (a.ph !== 'play') return null; const b = a.board, g = c4Game(a), c = g.turn === (a.p1 ? 1 : 2) ? c4Ai(g, a.p1 ? 1 : 2, .2) : 3; return { x: b.x + (c - 3) * C4C, z: b.z0 }; },
  sub: a => { if (a.ph === 'intro') return 'Het toernooi wordt ingedeeld'; if (a.ph === 'wait') return `Ronde ${a.k + 1} · wacht op je volgende tegenstander`; if (a.ph !== 'play') return a.res;
    const g = c4Game(a), mine = g.turn === (a.p1 ? 1 : 2); return `Ronde ${a.k + 1} van ${a.rounds} · tegen ${a.oppName} · ` + (mine ? `jij bent aan zet (${Math.max(0, Math.ceil(a.turnT))} s)` : 'je tegenstander is aan zet') + ` · jij speelt ${a.p1 ? 'rood' : 'geel'}`; } },

// Snoep: rijen van drie of meer van dezelfde kleur verdwijnen, en elk snoepje geeft je tijd erbij. De klok loopt steeds sneller leeg; wie het langst doorgaat wint.
{ id: 'candy', isle: 'square', n: 'Snoepjesrijen', tier: 2, T: 600, goal: 90,
  d: 'Een levensgroot speelveld van 8 bij 8 snoepjes. Ga op een snoepje staan en druk F, ga dan op een snoepje ernaast staan en druk weer F om ze te wisselen. Rijen van drie of meer verdwijnen en geven je tijd erbij. Een wissel zonder rij kost tijd. De klok loopt steeds sneller leeg: wie het langst door kan spelen wint.', win: 'Doel: 90 seconden volhouden.',
  go: 'Snoepjesrijen: ga op een snoepje staan en wissel met F. Drie op een rij geeft tijd',
  init(a) { a.gr = []; for (let i = 0; i < 64; i++) a.gr.push(0); for (let i = 0; i < 64; i++) { let t; do t = Math.floor(rand() * 6); while (candyLine(a.gr, i, t)); a.gr[i] = t; } a.time = 20; a.sel = -1; a.n = 0; a.lp = 1; api.place(CX, CZ + 7.6, -Math.PI / 2); },
  card: a => [{ ic: 'turbo', key: 'F', n: a.sel < 0 ? 'Snoepje kiezen' : 'Wisselen', d: 'Kies het snoepje waar je op staat, of wissel het met het snoepje dat je al koos.', act: () => candyPick(a) }],
  upd(a, dt) { a.time -= dt * (1 + a.age / 45); a.pts = Math.min(a.T - 1, Math.floor(a.age)); if (a.time <= 0) { a.time = 0; if (api.peers(a).length) a.fail = true; a.fin = true; return; } // speelt er nog iemand door, dan heb je verloren
    const c = candyCell(); for (let i = 0; i < 64; i++) { const p = candyPos(i), t = a.gr[i]; rect(a, p.x, p.z, CC - .12, CC - .12, i === a.sel ? '#ffffff' : i === c ? '#6c727c' : ((i % 8) + (i >> 3)) % 2 ? '#2a2236' : '#352b44', i === a.sel ? .55 : .9);
      if (t >= 0) orb(a, p.x, p.z, .45, .45, CANDY[t]); }
    const f = Math.min(1, a.time / 30); rect(a, CX - 6.8 + 6.8 * f, CZ - 7.5, 13.6 * f, .45, f > .3 ? '#35cf4a' : '#e8372a', .9); },
  bot(a, m) { if (!m.mv || a.gr[m.mv[0]] < 0) m.mv = candyHint(a.gr); if (!m.mv) return null; const want = a.sel === m.mv[0] ? m.mv[1] : m.mv[0], p = candyPos(want);
    if (candyCell() === want && dH(p.x, p.z) < .5) { candyPick(a); if (a.sel < 0) m.mv = null; } return { x: p.x, z: p.z }; },
  sub: a => `Nog ${a.time.toFixed(1).replace('.', ',')} s op de klok · ${a.n} snoepjes · ${Math.floor(a.age)} s volgehouden` },

// Rad van fortuin: drie keer draaien. Elk vak geeft of kost credits, levens, een stuk harnas of een upgrade van een van je torens.
{ id: 'wheel', isle: 'round', n: 'Rad van fortuin', tier: 1, T: 75, goal: 1,
  d: 'Een groot rad midden op het ronde eiland. Ga op de groene plaat staan om te draaien; dat mag drie keer. Je wint of verliest credits, levens, een upgrade van een van je torens of een stuk harnas. Op Nog een keer krijg je een extra draai, op Bankroet ben je 30% van je credits kwijt. Credits worden hoger naarmate het level hoger is.', win: 'Doel: na drie keer draaien meer gewonnen dan verloren.',
  go: 'Rad van fortuin: ga op de groene plaat staan om aan het rad te draaien',
  init(a) { a.disc = api.disc(WOF.map(w => w.lb), WOF.map(w => w.col), 4.6, CX, CZ - .4); a.block = (x, z) => hyp(x - CX, z - CZ + .4) < 4.8; a.ang = -Math.PI / 2; a.spins = 3; a.ph = 'wait'; a.on = 0; a.val = 0; a.s = 1 + a.r / 30;
    api.place(CX, CZ + 7.4, -Math.PI / 2); },
  upd(a, dt) { const pl = { x: CX, z: CZ + 6.2 }, on = dH(pl.x, pl.z) < 1.2;
    if (a.ph === 'wait') { a.on = on && a.spins > 0 ? a.on + dt : 0; if (a.on >= .8) wofSpin(a); }
    else if (a.ph === 'spin') { a.st += dt; const u = Math.min(1, a.st / 4), e = 1 - Math.pow(1 - u, 3); a.ang = a.from + (a.to - a.from) * e; if (u >= 1) wofLand(a); }
    else if (a.ph === 'show') { a.pt -= dt; if (a.pt <= 0) { if (a.spins > 0) a.ph = 'wait'; else { a.pts = Math.max(0, Math.round(a.val)); a.fin = true; return; } } }
    if (a.disc) a.disc.rotation.y = -a.ang;
    mark(a, pl.x, pl.z, 1.2, a.ph === 'wait' && a.spins > 0 ? '#35ff5a' : '#6c727c', .45 + (a.on > 0 ? .3 : 0)); orb(a, CX, CZ - 5.25, .5, .3, '#e8372a'); glow(a, CX, CZ - 4.9, .9, Math.PI / 2, '#e8372a', .9, .12); },
  bot(a, m) { return a.ph === 'wait' && a.spins > 0 ? { x: CX + .3, z: CZ + 6.2 } : { x: CX + 2.5, z: CZ + 7 }; },
  sub: a => `Nog ${a.spins} ${a.spins === 1 ? 'draai' : 'draaien'} · ${a.val >= 0 ? 'gewonnen' : 'verloren'} voor ${Math.abs(Math.round(a.val))} credits` + (a.ph === 'spin' ? ' · het rad draait' : a.ph === 'wait' && a.spins ? ' · ga op de groene plaat staan' : '') }

];
list.center = (x, z, k) => { CX = x; CZ = z; ISLE = k; };
return list;
};
