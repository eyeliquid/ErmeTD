// Webadmin: spelersoverzicht en spelinstellingen. Praat met /api/admin; het beheertoken staat alleen in dit tabblad.
(() => {
  'use strict';
  const base = String((window.RATD_CONFIG && window.RATD_CONFIG.api) || '').replace(/\/+$/, '');
  const $ = s => document.querySelector(s);
  const KEY = 'ratd-admin';
  let token = null;
  try { token = sessionStorage.getItem(KEY) || null; } catch {}
  function setToken(t) {
    token = t || null;
    try { if (token) sessionStorage.setItem(KEY, token); else sessionStorage.removeItem(KEY); } catch {}
  }

  async function api(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try { res = await fetch(base + '/api/admin' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { const e = new Error('De server is niet bereikbaar. Controleer je verbinding en probeer het opnieuw.'); e.status = 0; throw e; }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) { const e = new Error((data && data.message) || 'Er ging iets mis op de server.'); e.status = res.status; throw e; }
    return data;
  }

  const fmt = n => Number(n).toLocaleString('nl-NL');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }

  const dateFmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const fullFmt = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
  function ago(ts, now) {
    const s = Math.max(0, (now - ts) / 1000);
    if (s < 90) return 'zojuist';
    if (s < 3600) return Math.round(s / 60) + ' min geleden';
    if (s < 86400) return Math.round(s / 3600) + ' uur geleden';
    if (s < 86400 * 2) return 'gisteren';
    if (s < 86400 * 30) return Math.round(s / 86400) + ' dagen geleden';
    return dateFmt.format(ts);
  }

  /* ---------- inloggen ---------- */
  function showLogin(msg) {
    clearInterval(pollT);
    setToken(null);
    $('#app').hidden = true; $('#login').hidden = false;
    $('#loginErr').textContent = msg || '';
    $('#pw').value = ''; $('#pw').focus();
  }
  $('#loginForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const pw = $('#pw').value, go = $('#loginGo');
    if (!pw) { $('#loginErr').textContent = 'Vul het beheerwachtwoord in.'; return; }
    go.disabled = true; $('#loginErr').textContent = '';
    try {
      const r = await api('POST', '/login', { password: pw });
      setToken(r.token); $('#pw').value = '';
      await start();
    } catch (err) { $('#loginErr').textContent = err.message; $('#pw').select(); }
    go.disabled = false;
  });
  $('#logout').addEventListener('click', () => { api('POST', '/logout').catch(() => {}); showLogin(''); });

  /* ---------- gegevens ---------- */
  let data = null, pollT = 0, sort = { key: 'createdAt', dir: -1 }, saved = null;

  async function load(quiet) {
    try {
      data = await api('GET', '/overview');
    } catch (err) {
      if (err.status === 401) { showLogin('Je sessie is verlopen. Log opnieuw in.'); return false; }
      if (err.status === 503) { showLogin(err.message); return false; }
      if (!quiet) toast(err.message);
      $('#stamp').textContent = 'Verversen mislukt';
      return false;
    }
    renderTiles(); renderPlayers();
    if (!saved || !dirty()) { saved = data.settings; fillSettings(saved); }
    const d = new Date();
    $('#stamp').textContent = 'Bijgewerkt ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return true;
  }

  async function start() {
    saved = null;
    if (!(await load())) return;
    $('#login').hidden = true; $('#app').hidden = false;
    clearInterval(pollT);
    pollT = setInterval(() => { if (!document.hidden && !$('#dlg').open) load(true); }, 30000);
  }
  $('#refresh').addEventListener('click', async () => { if (await load()) toast('Bijgewerkt.'); });

  function renderTiles() {
    const ps = data.players, on = ps.filter(p => p.online).length;
    $('#tAcc').textContent = fmt(ps.length);
    $('#tOn').textContent = fmt(data.online);
    $('#tOnNote').textContent = data.online ? `${fmt(on)} ingelogd, ${fmt(Math.max(0, data.online - on))} gast of extra tabblad` : 'Niemand in de lobby';
    $('#tGames').textContent = fmt(ps.reduce((a, p) => a + p.games, 0));
    const best = ps.filter(p => p.score != null).sort((a, b) => b.score - a.score)[0];
    $('#tBest').textContent = best ? fmt(best.score) : '–';
    $('#tBestBy').textContent = best ? `${best.name} · ronde ${best.round}` : 'Nog geen scores';
  }

  /* ---------- spelers ---------- */
  const sortVal = (p, k) => (k === 'skill' ? p.spent + p.points : k === 'name' ? p.name.toLowerCase() : p[k]);
  const LABELS = ['', 'Aangemaakt', 'Laatst gezien', 'Potjes', 'Beste score', 'Ronde', 'Skillpunten', ''];
  function renderPlayers() {
    const term = $('#search').value.trim().toLowerCase();
    const rows = data.players.filter(p => !term || p.name.toLowerCase().includes(term));
    rows.sort((a, b) => {
      const x = sortVal(a, sort.key), y = sortVal(b, sort.key);
      if (x == null && y == null) return 0;
      if (x == null) return 1;          // zonder waarde altijd onderaan
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    document.querySelectorAll('#ptable th').forEach(th => {
      const b = th.querySelector('button');
      if (b && b.dataset.sort === sort.key) th.setAttribute('aria-sort', sort.dir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort');
    });
    const body = $('#prows');
    body.textContent = '';
    for (const p of rows) {
      const tr = el('tr');
      const name = el('td', 'name');
      const dot = el('i', 'on' + (p.online ? ' live' : '')); dot.title = p.online ? 'Nu online' : 'Offline';
      name.append(dot, document.createTextNode(p.name));
      if (p.online) name.append(el('span', 'sr', ' (online)'));
      name.title = p.name;
      const made = el('td', 'num', dateFmt.format(p.createdAt)); made.title = fullFmt.format(p.createdAt);
      const seen = el('td', p.lastSeen ? '' : 'dim', p.online ? 'nu online' : p.lastSeen ? ago(p.lastSeen, data.now) : 'onbekend');
      if (p.lastSeen) seen.title = fullFmt.format(p.lastSeen);
      const score = el('td', 'r num', p.score == null ? '–' : fmt(p.score));
      const round = el('td', 'r num', p.round == null ? '–' : `${p.round}/${data.rounds}`);
      if (p.won) { const w = el('span', 'won', '★'); w.title = 'Gewonnen'; w.setAttribute('aria-hidden', 'true'); round.append(w, el('span', 'sr', ' gewonnen')); }
      const skill = el('td', 'r num', String(p.spent + p.points));
      if (p.points) skill.append(el('small', '', ` (${p.points} vrij)`));
      const act = el('td', 'act');
      const b1 = el('button', '', 'Wachtwoord'); b1.type = 'button'; b1.addEventListener('click', () => askPassword(p));
      const b2 = el('button', '', 'Wis score'); b2.type = 'button'; b2.disabled = p.score == null; b2.addEventListener('click', () => askScore(p));
      const b3 = el('button', 'btn-danger', 'Verwijder'); b3.type = 'button'; b3.addEventListener('click', () => askDelete(p));
      for (const b of [b1, b2, b3]) b.setAttribute('aria-label', `${b.textContent}: ${p.name}`);
      act.append(b1, b2, b3);
      const cells = [name, made, seen, el('td', 'r num', fmt(p.games)), score, round, skill, act];
      cells.forEach((c, i) => { if (LABELS[i]) c.dataset.label = LABELS[i]; });
      tr.append(...cells);
      body.append(tr);
    }
    const empty = $('#pEmpty');
    empty.hidden = rows.length > 0;
    empty.textContent = data.players.length ? `Geen speler gevonden met "${$('#search').value.trim()}".` : 'Er zijn nog geen accounts. Zodra iemand zich aanmeldt, staat hij hier.';
    $('.tablewrap').hidden = rows.length === 0;
    $('#pCount').textContent = data.players.length ? (term ? `${rows.length} van ${data.players.length} accounts` : `${data.players.length} ${data.players.length === 1 ? 'account' : 'accounts'}`) + ' · gasten zonder account staan hier niet bij' : '';
  }
  $('#search').addEventListener('input', renderPlayers);
  document.querySelectorAll('#ptable th button').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' ? 1 : -1 };
    renderPlayers();
  }));

  /* ---------- dialoog voor acties op een speler ---------- */
  const dlg = $('#dlg');
  let dlgRun = null;
  function ask({ title, text, ok, danger, input, run }) {
    $('#dlgTitle').textContent = title; $('#dlgText').textContent = text; $('#dlgErr').textContent = '';
    const okB = $('#dlgOk'); okB.textContent = ok; okB.className = danger ? 'btn-danger' : 'btn-main'; okB.disabled = false;
    $('#dlgField').hidden = !input; $('#dlgInput').value = '';
    dlgRun = run;
    dlg.showModal();
    (input ? $('#dlgInput') : $('#dlgCancel')).focus();
  }
  $('#dlgCancel').addEventListener('click', () => dlg.close());
  $('#dlgForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const okB = $('#dlgOk');
    okB.disabled = true; $('#dlgErr').textContent = '';
    try { const msg = await dlgRun($('#dlgInput').value); dlg.close(); await load(true); toast(msg); }
    catch (err) {
      if (err.status === 401) { dlg.close(); showLogin('Je sessie is verlopen. Log opnieuw in.'); }
      else $('#dlgErr').textContent = err.message;
    }
    okB.disabled = false;
  });
  const pid = p => '/players/' + encodeURIComponent(p.id);
  function askPassword(p) {
    ask({ title: 'Nieuw wachtwoord', text: `Kies een nieuw wachtwoord voor ${p.name} en geef het zelf aan de speler door. Hij wordt op al zijn apparaten uitgelogd.`, ok: 'Stel in', input: true,
      run: async pw => {
        if (pw.length < 8) { const e = new Error('Kies een wachtwoord van minstens 8 tekens.'); throw e; }
        await api('POST', pid(p) + '/password', { password: pw });
        return `Nieuw wachtwoord ingesteld voor ${p.name}.`;
      } });
  }
  function askScore(p) {
    ask({ title: 'Score wissen', text: `De score van ${p.name} (${fmt(p.score)}) verdwijnt van het leaderboard. Skillpunten en voortgang blijven staan. Dit kun je niet terugdraaien.`, ok: 'Wis score', danger: true,
      run: async () => { await api('DELETE', pid(p) + '/score'); return `Score van ${p.name} gewist.`; } });
  }
  function askDelete(p) {
    ask({ title: 'Account verwijderen', text: `Het account van ${p.name} verdwijnt, met alle voortgang, skillpunten en de score. Dit kun je niet terugdraaien.`, ok: 'Verwijder account', danger: true,
      run: async () => { await api('DELETE', pid(p)); return `Account van ${p.name} verwijderd.`; } });
  }

  /* ---------- instellingen ---------- */
  const BALANCE = [
    ['startGold', 'Startcredits', 'Credits waarmee elke speler een potje begint. 10.000 is de testwaarde; 260 is bedoeld voor de definitieve versie.', '', 10],
    ['lives', 'Levens', 'Zoveel vijanden mogen erdoor voordat het hoofdkwartier valt.', '', 1],
    ['prepSeconds', 'Bouwtijd vooraf', 'Tijd om je weg te leggen voordat de eerste golf komt.', 'sec', 10],
    ['enemyHp', 'Vijandsterkte', 'Vermenigvuldigt de levenspunten van alle vijanden. 1 is normaal, 2 is twee keer zo taai.', '×', 0.05],
    ['goldMul', 'Credits per kill', 'Vermenigvuldigt wat een gedode vijand oplevert. 1 is normaal.', '×', 0.05],
  ];
  const show = v => String(v).replace('.', ',');
  function buildBalance() {
    const box = $('#balance');
    for (const [k, title, help, unit, step] of BALANCE) {
      const f = data.fields[k], row = el('div', 'setrow'), txt = el('label'), ctl = el('div', 'ctl'), inp = el('div', 'inp'), i = el('input');
      row.id = 'row_' + k; txt.htmlFor = 's_' + k;
      txt.append(el('b', '', title), el('small', '', `${help} Van ${show(f.min)} tot ${fmt(f.max)}.`));
      i.type = 'number'; i.id = 's_' + k; i.min = f.min; i.max = f.max; i.step = step; i.required = true; i.inputMode = f.type === 'int' ? 'numeric' : 'decimal';
      inp.append(i, el('span', 'unit', unit));
      ctl.append(inp, el('small', 'def num', `standaard ${fmt(f.def)}${unit === '×' ? '×' : unit ? ' ' + unit : ''}`));
      row.append(txt, ctl);
      box.append(row);
    }
  }
  const boolKeys = ['registrationOpen', 'chatEnabled'];
  function fillSettings(s) {
    if (!$('#balance').children.length) buildBalance();
    for (const [k] of BALANCE) $('#s_' + k).value = s[k];
    for (const k of boolKeys) $('#s_' + k).checked = !!s[k];
    $('#s_motd').value = s.motd || '';
    syncForm();
  }
  // Leest het formulier. Ongeldige getallen komen terug als NaN.
  function readSettings() {
    const out = {};
    for (const [k] of BALANCE) { const i = $('#s_' + k); out[k] = i.value.trim() === '' ? NaN : i.valueAsNumber; }
    for (const k of boolKeys) out[k] = $('#s_' + k).checked;
    out.motd = $('#s_motd').value.replace(/\s+/g, ' ').trim();
    return out;
  }
  const same = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
  function dirty() { if (!saved) return false; const c = readSettings(); return Object.keys(c).some(k => !same(c[k], saved[k])); }
  function invalid() {
    const c = readSettings();
    for (const [k, title] of BALANCE) {
      const f = data.fields[k], v = c[k];
      if (!Number.isFinite(v) || v < f.min || v > f.max || (f.type === 'int' && !Number.isInteger(v))) return { k, title, f };
    }
    return null;
  }
  function syncForm() {
    const c = readSettings(), d = dirty(), bad = invalid();
    for (const [k] of BALANCE) {
      $('#row_' + k).classList.toggle('changed', !same(c[k], saved[k]));
      $('#s_' + k).classList.toggle('bad', !!bad && bad.k === k);
    }
    $('#motdCount').textContent = `${$('#s_motd').value.length}/200`;
    $('#setSave').disabled = !d || !!bad; $('#setUndo').disabled = !d; $('#dirtyDot').hidden = !d;
    const msg = $('#setMsg');
    msg.className = bad ? 'bad' : d ? 'warn' : '';
    msg.textContent = bad ? `${bad.title}: vul een ${bad.f.type === 'int' ? 'heel getal' : 'getal'} in van ${show(bad.f.min)} tot ${fmt(bad.f.max)}.` : d ? 'Je hebt wijzigingen die nog niet zijn opgeslagen.' : 'Alles is opgeslagen.';
  }
  $('#setForm').addEventListener('input', syncForm);
  $('#setUndo').addEventListener('click', () => fillSettings(saved));
  $('#setDefaults').addEventListener('click', () => { fillSettings({ ...data.defaults, motd: $('#s_motd').value }); toast('Standaardwaarden ingevuld. Sla op om ze te laten gelden.'); });
  $('#setForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (invalid() || !dirty()) return;
    const btn = $('#setSave');
    btn.disabled = true;
    try {
      const r = await api('PUT', '/settings', { settings: readSettings() });
      saved = data.settings = r.settings; fillSettings(saved);
      toast('Instellingen opgeslagen. Ze gelden vanaf het volgende potje.');
    } catch (err) {
      if (err.status === 401) return showLogin('Je sessie is verlopen. Log opnieuw in.');
      const msg = $('#setMsg'); msg.className = 'bad'; msg.textContent = err.message; btn.disabled = false;
    }
  });
  addEventListener('beforeunload', ev => { if (!$('#app').hidden && dirty()) { ev.preventDefault(); ev.returnValue = ''; } });

  /* ---------- tabbladen ---------- */
  const tabs = [['tabPlayers', 'players'], ['tabSettings', 'settings']];
  function showTab(id) { for (const [t, p] of tabs) { $('#' + t).setAttribute('aria-selected', String(t === id)); $('#' + p).hidden = t !== id; } }
  for (const [t] of tabs) $('#' + t).addEventListener('click', () => showTab(t));

  if (token) start(); else showLogin('');
})();
