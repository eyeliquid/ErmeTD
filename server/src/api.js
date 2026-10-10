'use strict';
// De HTTP-API: accounts, voortgang en het leaderboard. Alles onder /api, alles JSON.
const express = require('express');
const { hashPassword, verifyPassword, newId } = require('./auth');
const { limiter } = require('./ratelimit');
const { nameKey, cleanName, cleanPassword, cleanSave, cleanScore } = require('./validate');

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function createApi({ db, sess, hooks }) {
  const q = {
    userByKey: db.prepare('SELECT id, name, pass_hash FROM users WHERE name_key = ?'),
    userAdd: db.prepare('INSERT INTO users (id, name, name_key, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)'),
    userRename: db.prepare('UPDATE users SET name = ?, name_key = ? WHERE id = ?'),
    saveGet: db.prepare('SELECT data FROM saves WHERE user_id = ?'),
    savePut: db.prepare(`INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?)
                         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    scoreGet: db.prepare('SELECT score FROM scores WHERE user_id = ?'),
    scorePut: db.prepare(`INSERT INTO scores (user_id, score, round, won, at) VALUES (?, ?, ?, ?, ?)
                          ON CONFLICT(user_id) DO UPDATE SET score = excluded.score, round = excluded.round, won = excluded.won, at = excluded.at`),
    board: db.prepare(`SELECT s.user_id AS id, u.name, s.score, s.round, s.won FROM scores s JOIN users u ON u.id = s.user_id
                       ORDER BY s.score DESC, s.at ASC LIMIT 20`),
  };
  const getBoard = () => q.board.all().map(r => ({ ...r, won: !!r.won }));
  const loadSave = id => { const r = q.saveGet.get(id); try { return r ? cleanSave(JSON.parse(r.data)) : null; } catch { return null; } };

  // Rem op gokken naar wachtwoorden en op het massaal aanmaken van accounts.
  const loginLimit = limiter(10, 10 * 60000), registerLimit = limiter(8, 60 * 60000), writeLimit = limiter(120, 60000);
  // Bestaat een roepnaam niet, dan wordt toch een hash uitgerekend: zo verraadt de reactietijd niet welke namen bestaan.
  const dummy = hashPassword('niet-bestaand-account');

  const tokenOf = req => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7).trim() : null; };
  const auth = (req, res, next) => {
    req.token = tokenOf(req);
    req.user = req.token ? sess.find(req.token) : null;
    if (!req.user) return next(new HttpError(401, 'auth', 'Je bent niet ingelogd.'));
    next();
  };
  const limited = (lim, keyFn) => (req, res, next) => {
    const k = keyFn(req);
    if (lim.take(k)) return next();
    res.set('Retry-After', String(lim.retryAfter(k)));
    next(new HttpError(429, 'rate', 'Te veel pogingen. Probeer het over een paar minuten opnieuw.'));
  };

  const api = express.Router();
  api.use(express.json({ limit: '32kb' }));
  api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  api.get('/health', (req, res) => res.json({ ok: true, online: hooks.online() }));

  api.post('/register', limited(registerLimit, req => req.ip), wrap(async (req, res) => {
    const name = cleanName(req.body.name), password = cleanPassword(req.body.password);
    if (!name) throw new HttpError(400, 'name', 'Gebruik voor je roepnaam 3 tot 16 tekens: letters, cijfers, spaties, - of _.');
    if (!password) throw new HttpError(400, 'password', 'Kies een wachtwoord van minstens 8 tekens.');
    const key = nameKey(name);
    if (q.userByKey.get(key)) throw new HttpError(409, 'taken', 'Die roepnaam is al bezet. Kies een andere.');
    const id = newId(), hash = await hashPassword(password);
    try { q.userAdd.run(id, name, key, hash, Date.now()); }
    catch { throw new HttpError(409, 'taken', 'Die roepnaam is al bezet. Kies een andere.'); }
    res.status(201).json({ token: sess.create(id), user: { id, name }, save: null });
  }));

  api.post('/login', limited(loginLimit, req => req.ip + '|' + nameKey(String(req.body.name || '')).slice(0, 32)), wrap(async (req, res) => {
    const name = cleanName(req.body.name), password = typeof req.body.password === 'string' ? req.body.password.slice(0, 200) : '';
    const u = name ? q.userByKey.get(nameKey(name)) : null;
    const ok = await verifyPassword(password, u ? u.pass_hash : await dummy);
    if (!u || !ok) throw new HttpError(401, 'login', 'Roepnaam of wachtwoord klopt niet.');
    res.json({ token: sess.create(u.id), user: { id: u.id, name: u.name }, save: loadSave(u.id) });
  }));

  api.post('/logout', auth, (req, res) => { sess.drop(req.token); res.json({ ok: true }); });

  api.get('/me', auth, (req, res) => res.json({ user: req.user, save: loadSave(req.user.id) }));

  api.patch('/account', auth, limited(writeLimit, req => req.user.id), (req, res) => {
    const name = cleanName(req.body.name);
    if (!name) throw new HttpError(400, 'name', 'Gebruik voor je roepnaam 3 tot 16 tekens: letters, cijfers, spaties, - of _.');
    const key = nameKey(name), other = q.userByKey.get(key);
    if (other && other.id !== req.user.id) throw new HttpError(409, 'taken', 'Die roepnaam is al bezet. Kies een andere.');
    q.userRename.run(name, key, req.user.id);
    hooks.renamed(req.user.id, name);
    hooks.boardChanged();
    res.json({ user: { id: req.user.id, name } });
  });

  // Voortgang opslaan. Wie op een ander apparaat al verder was, houdt die voortgang: het antwoord is altijd wat nu geldt.
  api.put('/save', auth, limited(writeLimit, req => req.user.id), (req, res) => {
    const next = cleanSave(req.body.save);
    if (!next) throw new HttpError(400, 'save', 'Ongeldige voortgang.');
    const cur = loadSave(req.user.id);
    if (cur && cur.earned > next.earned) return res.json({ save: cur, kept: true });
    q.savePut.run(req.user.id, JSON.stringify(next), Date.now());
    res.json({ save: next });
  });

  api.get('/scores', (req, res) => res.json({ rows: getBoard() }));

  api.post('/scores', auth, limited(writeLimit, req => req.user.id), (req, res) => {
    const s = cleanScore(req.body);
    if (!s) throw new HttpError(400, 'score', 'Ongeldige score.');
    const old = q.scoreGet.get(req.user.id);
    const better = !old || s.score > old.score;
    if (better) { q.scorePut.run(req.user.id, s.score, s.round, s.won, Date.now()); hooks.boardChanged(); }
    res.json({ best: better ? s.score : old.score, improved: better });
  });

  api.use((req, res, next) => next(new HttpError(404, 'notfound', 'Onbekend adres.')));
  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') err = new HttpError(400, 'body', 'Ongeldig verzoek.');
    if (!(err instanceof HttpError)) { console.error(err); err = new HttpError(500, 'server', 'Er ging iets mis op de server.'); }
    res.status(err.status).json({ error: err.code, message: err.message });
  });

  return { router: api, getBoard };
}

module.exports = { createApi };
