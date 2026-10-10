'use strict';
// Eenvoudige teller in het geheugen: hooguit `max` pogingen per `windowMs` per sleutel.
function limiter(max, windowMs) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, Math.min(windowMs, 60000));
  timer.unref();
  return {
    // true als de poging mag; telt hem dan ook mee
    take(key) {
      const now = Date.now();
      let h = hits.get(key);
      if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
      if (h.n >= max) return false;
      h.n++;
      return true;
    },
    retryAfter(key) { const h = hits.get(key); return h ? Math.max(1, Math.ceil((h.reset - Date.now()) / 1000)) : 1; },
    clear(key) { hits.delete(key); },
  };
}
module.exports = { limiter };
