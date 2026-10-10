'use strict';
// Controle van alles wat van een speler binnenkomt. De skills komen uit dezelfde spelregels als in de browser.
const Engine = require('../../client/js/engine.js');

const nameKey = n => n.trim().toLowerCase().replace(/\s+/g, ' ');

function cleanName(v) {
  const n = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return /^[\p{L}\p{N}][\p{L}\p{N} _-]{2,15}$/u.test(n) ? n : null;
}

function cleanPassword(v) {
  return typeof v === 'string' && v.length >= 8 && v.length <= 200 ? v : null;
}

const num = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));

// Voortgang: alleen bekende skills, nooit meer rangen dan bestaan, en nooit meer punten dan er in het spel te verdienen zijn.
function cleanSave(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const skills = {};
  let spent = 0;
  if (d.skills && typeof d.skills === 'object' && !Array.isArray(d.skills)) {
    for (const s of Engine.SKILLS) {
      const r = Math.min(s.max, Math.max(0, d.skills[s.id] | 0));
      if (r) { skills[s.id] = r; spent += r; }
    }
  }
  const pts = Math.min(num(d.pts, Engine.SKILL_MAX), Engine.SKILL_MAX - spent);
  return {
    v: 2,
    pts: Math.max(0, pts),
    earned: Math.max(num(d.earned, 1e6), spent + Math.max(0, pts)),
    skills,
    games: num(d.games, 1e7),
    best: num(d.best, 1e12),
    hero: num(d.hero, 5),
    at: num(d.at, Date.now() + 60000),
  };
}

function cleanScore(d) {
  if (!d || typeof d !== 'object') return null;
  const score = Math.floor(+d.score);
  if (!Number.isFinite(score) || score < 0 || score > 1e12) return null;
  return { score, round: num(d.round, Engine.ROUNDS), won: d.won ? 1 : 0 };
}

const cleanMsg = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u2028-\u202e]/g, ' ').trim().slice(0, 160);

module.exports = { nameKey, cleanName, cleanPassword, cleanSave, cleanScore, cleanMsg };
