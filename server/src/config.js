'use strict';
// Alle instellingen komen uit omgevingsvariabelen; zie .env.example.
const path = require('node:path');

const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const root = path.resolve(__dirname, '..', '..');

module.exports = {
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  // Map met de database. Zet dit bij hosting op een schijf die blijft bestaan.
  dataDir: path.resolve(process.env.DATA_DIR || path.join(root, 'server', 'data')),
  clientDir: path.resolve(process.env.CLIENT_DIR || path.join(root, 'client')),
  // Alleen nodig als de frontend op een ander adres staat dan de backend: lijst met toegestane origins, gescheiden door komma's.
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  // Aantal proxy's voor de server (1 bij de meeste hosts). Nodig om het echte IP-adres te zien voor de inlogbeveiliging.
  trustProxy: int(process.env.TRUST_PROXY, 0),
  // Wachtwoord van de webadmin op /admin. Leeg = de webadmin staat uit.
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionDays: int(process.env.SESSION_DAYS, 90),
  // Hoeveel accounts er per uur vanaf één IP-adres gemaakt mogen worden.
  registerPerHour: int(process.env.REGISTER_PER_HOUR, 8),
  maxPeers: int(process.env.MAX_PEERS, 200),
  maxPeersPerIp: int(process.env.MAX_PEERS_PER_IP, 8),
};
