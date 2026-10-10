'use strict';
// SQLite via de ingebouwde module van Node: geen losse databaseserver nodig, alles staat in één bestand.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = [
  // versie 1
  `CREATE TABLE users (
     id         TEXT PRIMARY KEY,
     name       TEXT NOT NULL,
     name_key   TEXT NOT NULL UNIQUE,
     pass_hash  TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     last_seen  INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE saves (
     user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     data       TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE TABLE scores (
     user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     score   INTEGER NOT NULL,
     round   INTEGER NOT NULL,
     won     INTEGER NOT NULL,
     at      INTEGER NOT NULL
   );
   CREATE INDEX scores_top ON scores(score DESC);
   CREATE TABLE chat (
     id      INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id TEXT,
     name    TEXT NOT NULL,
     text    TEXT NOT NULL,
     at      INTEGER NOT NULL
   );`,
];

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  // Migraties: elke stap in SCHEMA draait precies één keer, bijgehouden in user_version.
  let v = db.prepare('PRAGMA user_version').get().user_version;
  for (; v < SCHEMA.length; v++) {
    db.exec('BEGIN');
    try { db.exec(SCHEMA[v]); db.exec(`PRAGMA user_version = ${v + 1}`); db.exec('COMMIT'); }
    catch (err) { db.exec('ROLLBACK'); throw err; }
  }
  return db;
}

module.exports = { open };
