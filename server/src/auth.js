'use strict';
// Wachtwoorden worden met scrypt gehasht. Een sessie is een willekeurig token; in de database staat alleen de hash ervan.
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const N = 16384, R = 8, P = 1, KEYLEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const p = String(stored).split('$');
  if (p.length !== 6 || p[0] !== 'scrypt') return false;
  const salt = Buffer.from(p[4], 'base64'), want = Buffer.from(p[5], 'base64');
  const key = await scrypt(String(password).normalize('NFKC'), salt, want.length, { N: +p[1], r: +p[2], p: +p[3] });
  return key.length === want.length && crypto.timingSafeEqual(key, want);
}

const tokenHash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');
const newId = () => crypto.randomBytes(9).toString('base64url');

function sessions(db, sessionDays) {
  const ttl = sessionDays * 86400000;
  const q = {
    add: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)'),
    get: db.prepare('SELECT s.token_hash, s.last_seen, u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'),
    touch: db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?'),
    del: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    prune: db.prepare('DELETE FROM sessions WHERE last_seen < ?'),
  };
  return {
    create(userId) { const t = newToken(), now = Date.now(); q.add.run(tokenHash(t), userId, now, now); return t; },
    // Geeft {id, name} bij een geldig token, anders null.
    find(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
      const h = tokenHash(token), s = q.get.get(h), now = Date.now();
      if (!s) return null;
      if (now - s.last_seen > ttl) { q.del.run(h); return null; }
      if (now - s.last_seen > 3600000) q.touch.run(now, h);
      return { id: s.id, name: s.name };
    },
    drop(token) { q.del.run(tokenHash(token)); },
    prune() { q.prune.run(Date.now() - ttl); },
  };
}

module.exports = { hashPassword, verifyPassword, sessions, newId };
