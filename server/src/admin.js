'use strict';
// De beheer-API onder /api/admin: spelersoverzicht en spelinstellingen. Alles zit achter het beheerwachtwoord (ADMIN_PASSWORD).
// Een beheersessie is een willekeurig token dat alleen in het geheugen van de server staat: na een herstart log je opnieuw in.
const crypto = require('node:crypto');
const express = require('express');
const { hashPassword } = require('./auth');
const { limiter } = require('./ratelimit');
const { cleanPassword, cleanSave } = require('./validate');
const { FIELDS } = require('./settings');
const Engine = require('../../client/js/engine.js');

const SESSION_MS = 8 * 3600000;
const MIN_PASSWORD = 10;
const sha = s => crypto.createHash('sha256').update(String(s)).digest();

function createAdmin({ db, cfg, settings, hooks, HttpError }) {
  const password = typeof cfg.adminPassword === 'string' ? cfg.adminPassword : '';
  const enabled = password.length >= MIN_PASSWORD;
  const want = sha(password);
  const tokens = new Map(); // hash van het token -> verloopt op
  const loginLimit = limiter(5, 15 * 60000);

  const q = {
    players: db.prepare(`SELECT u.id, u.name, u.created_at AS createdAt, sv.data AS save, sv.updated_at AS savedAt,
                                sc.score, sc.round, sc.won, (SELECT MAX(last_seen) FROM sessions s WHERE s.user_id = u.id) AS lastSeen
                         FROM users u LEFT JOIN saves sv ON sv.user_id = u.id LEFT JOIN scores sc ON sc.user_id = u.id
                         ORDER BY u.created_at DESC`),
    user: db.prepare('SELECT id, name FROM users WHERE id = ?'),
    setPass: db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?'),
    dropSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    dropScore: db.prepare('DELETE FROM scores WHERE user_id = ?'),
    dropUser: db.prepare('DELETE FROM users WHERE id = ?'),
  };

  function player(r, online) {
    let save = null;
    try { save = r.save ? cleanSave(JSON.parse(r.save)) : null; } catch {}
    const spent = save ? Engine.skillTotal(save.skills) : 0;
    return {
      id: r.id, name: r.name, createdAt: r.createdAt, lastSeen: Math.max(r.lastSeen || 0, r.savedAt || 0) || null, online: online.has(r.id),
      games: save ? save.games : 0, hero: save ? save.hero : null, points: save ? save.pts : 0, spent,
      score: r.score == null ? null : r.score, round: r.round == null ? null : r.round, won: !!r.won,
    };
  }

  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const auth = (req, res, next) => {
    const h = req.headers.authorization || '', t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    const key = t ? sha(t).toString('hex') : '', until = key ? tokens.get(key) : 0;
    if (!until || until < Date.now()) { if (key) tokens.delete(key); return next(new HttpError(401, 'admin', 'Log in als beheerder.')); }
    req.adminKey = key;
    next();
  };
  const target = req => {
    const u = q.user.get(String(req.params.id));
    if (!u) throw new HttpError(404, 'player', 'Die speler bestaat niet (meer).');
    return u;
  };

  const r = express.Router();
  r.use((req, res, next) => (enabled ? next() : next(new HttpError(503, 'admin-off',
    `De webadmin staat uit. Zet op de server de instelling ADMIN_PASSWORD (minstens ${MIN_PASSWORD} tekens) en start de server opnieuw.`))));

  r.post('/login', (req, res, next) => {
    if (!loginLimit.take(req.ip)) {
      res.set('Retry-After', String(loginLimit.retryAfter(req.ip)));
      return next(new HttpError(429, 'rate', 'Te veel pogingen. Probeer het over een kwartier opnieuw.'));
    }
    const given = typeof req.body.password === 'string' ? req.body.password.slice(0, 200) : '';
    if (!crypto.timingSafeEqual(sha(given), want)) return next(new HttpError(401, 'login', 'Dat wachtwoord klopt niet.'));
    loginLimit.clear(req.ip);
    const now = Date.now();
    for (const [k, until] of tokens) if (until < now) tokens.delete(k);
    const token = crypto.randomBytes(32).toString('base64url');
    tokens.set(sha(token).toString('hex'), now + SESSION_MS);
    res.json({ token, expiresAt: now + SESSION_MS });
  });

  r.use(auth);

  r.post('/logout', (req, res) => { tokens.delete(req.adminKey); res.json({ ok: true }); });

  r.get('/overview', (req, res) => {
    const online = hooks.onlineUsers();
    res.json({
      players: q.players.all().map(p => player(p, online)),
      online: hooks.online(),
      settings: settings.get(), defaults: settings.defaults(), fields: FIELDS,
      rounds: Engine.ROUNDS, now: Date.now(),
    });
  });

  r.put('/settings', (req, res) => {
    const bad = settings.update(req.body.settings);
    if (bad) throw new HttpError(400, 'settings', `De waarde van "${bad}" is ongeldig.`);
    hooks.settingsChanged();
    res.json({ settings: settings.get() });
  });

  // Nieuw wachtwoord voor een speler. Hij wordt overal uitgelogd en moet met het nieuwe wachtwoord inloggen.
  r.post('/players/:id/password', wrap(async (req, res) => {
    const u = target(req), pw = cleanPassword(req.body.password);
    if (!pw) throw new HttpError(400, 'password', 'Kies een wachtwoord van minstens 8 tekens.');
    q.setPass.run(await hashPassword(pw), u.id);
    q.dropSessions.run(u.id);
    res.json({ ok: true });
  }));

  r.delete('/players/:id/score', (req, res) => {
    const u = target(req);
    q.dropScore.run(u.id);
    hooks.boardChanged();
    res.json({ ok: true });
  });

  // Account weg, met voortgang, score en sessies (die hangen er in de database aan vast).
  r.delete('/players/:id', (req, res) => {
    const u = target(req);
    q.dropUser.run(u.id);
    hooks.kick(u.id);
    hooks.boardChanged();
    res.json({ ok: true });
  });

  return { router: r, enabled };
}

module.exports = { createAdmin };
