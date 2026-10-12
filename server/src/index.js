'use strict';
// Startpunt van de server: de API onder /api, de realtime lobby op /ws en de frontend als gewone bestanden.
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const config = require('./config');
const { open } = require('./db');
const { sessions } = require('./auth');
const { createApi } = require('./api');
const room = require('./room');
const { createSettings } = require('./settings');

function createServer(overrides = {}) {
  const cfg = { ...config, ...overrides };
  const db = open(cfg.dbFile || path.join(cfg.dataDir, 'ratd.sqlite'));
  const sess = sessions(db, cfg.sessionDays);
  const settings = createSettings(db);
  sess.prune();
  const pruneTimer = setInterval(() => sess.prune(), 6 * 3600000);
  pruneTimer.unref();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', cfg.trustProxy);

  let live = null;
  const hooks = {
    online: () => (live ? live.count() : 0),
    boardChanged: () => live && live.boardChanged(),
    renamed: (id, name) => live && live.renamed(id, name),
    onlineUsers: () => (live ? live.users() : new Set()),
    settingsChanged: () => live && live.settingsChanged(),
    kick: id => live && live.kick(id),
  };
  const { router, getBoard } = createApi({ db, sess, hooks, settings, cfg });

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        + "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'",
    });
    next();
  });

  // Alleen nodig als de frontend ergens anders staat dan deze server.
  if (cfg.corsOrigins.length) {
    app.use('/api', (req, res, next) => {
      const o = req.headers.origin;
      if (o && cfg.corsOrigins.includes(o)) {
        res.set({ 'Access-Control-Allow-Origin': o, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Max-Age': '600' });
      }
      if (req.method === 'OPTIONS') return res.status(204).end();
      next();
    });
  }

  app.use('/api', router);
  app.use(express.static(cfg.clientDir, {
    extensions: ['html'],
    setHeaders(res, file) {
      // three.js verandert nooit; de rest moet na een update meteen vers zijn.
      res.set('Cache-Control', file.includes(`${path.sep}vendor${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));

  const server = http.createServer(app);
  live = room.attach(server, { db, sess, cfg, getBoard, settings });

  return {
    server, db,
    close() {
      clearInterval(pruneTimer);
      live.close();
      return new Promise(resolve => server.close(() => { try { db.close(); } catch {} resolve(); }));
    },
  };
}

if (require.main === module) {
  const s = createServer();
  s.server.listen(config.port, config.host, () => {
    console.log(`ErmeTD draait op http://localhost:${config.port}`);
    console.log(config.adminPassword.length >= 10 ? `Webadmin: http://localhost:${config.port}/admin` : 'Webadmin staat uit: zet ADMIN_PASSWORD (minstens 10 tekens) om hem aan te zetten.');
  });
  const stop = () => { s.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createServer };
