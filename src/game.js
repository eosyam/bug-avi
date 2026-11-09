'use strict';
/* =====================================================================
   BUG HUNT / BUG AVI — casual arena FPS with progression, leaderboard and live PvP
   ===================================================================== */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = n => Math.round(n * 100) / 100;
const V3 = THREE.Vector3;
const track = (name, params) => { try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) { } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------ SETTINGS + LANGUAGE ------------------------------ */
const LS_KEY = 'bugavi.profile.v1', LS_SET = 'bugavi.settings.v1';
let settings = { sens: 1, fov: 80, vol: 0.6, lang: 'en' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(LS_SET) || '{}')); } catch (e) { }
if (settings.lang !== 'tr' && settings.lang !== 'en') settings.lang = 'en';
let LANG = settings.lang;
const tx = (en, tr) => LANG === 'tr' ? tr : en;
const loc = v => Array.isArray(v) ? tx(v[0], v[1]) : v;
const fmt = n => Math.floor(n).toLocaleString(LANG === 'tr' ? 'tr-TR' : 'en-US');
const saveSettings = () => { try { localStorage.setItem(LS_SET, JSON.stringify(settings)); } catch (e) { } };
const STATIC = {
  title: ['BUG HUNT', 'BUG AVI'], tagline: ['Squash bugs while the AI writes your code.', 'AI kodu yazarken sen bugları vur.'],
  tabPlay: ['PLAY', 'OYNA'], tabArsenal: ['ARSENAL', 'CEPHANELİK'], tabShop: ['UPGRADES', 'GELİŞTİRMELER'], tabLb: ['LEADERBOARD', 'LİDERLİK'], tabSettings: ['SETTINGS', 'AYARLAR'],
  paused: ['PAUSED', 'DURAKLATILDI'], resume: ['Resume', 'Devam et'], endRun: ['End run', 'Turu bitir'],
};
function applyLang() {
  document.documentElement.lang = LANG;
  document.title = tx('Bug Hunt', 'Bug Avı');
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = STATIC[el.dataset.i18n]; if (v) el.textContent = loc(v); });
  document.querySelectorAll('.langsw button').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
}
function setLang(l) {
  if (l !== 'en' && l !== 'tr') return;
  LANG = l; settings.lang = l; saveSettings(); applyLang(); renderMenu(); track('language_change', { language: l });
}

/* ---------------------------- GAME DATA ---------------------------- */
const WEAPONS = [
  { id: 'pistol', name: 'console.log()', lvl: 1, dmg: 26, rate: 3.4, mag: 12, reload: 0.95, spread: 0.006, pellets: 1, icon: '🔫', desc: ['Reliable and accurate. Always by your side.', 'Güvenilir, isabetli. Her zaman yanında.'] },
  { id: 'smg', name: 'Hotfix-9', lvl: 3, dmg: 11, rate: 12, mag: 36, reload: 1.5, spread: 0.03, pellets: 1, icon: '⚡', desc: ['Fast and messy, like a Friday-night hotfix.', 'Hızlı ve dağınık, tıpkı cuma akşamı hotfix gibi.'] },
  { id: 'shotgun', name: 'Refactor', lvl: 5, dmg: 13, rate: 1.3, mag: 6, reload: 1.7, spread: 0.075, pellets: 9, icon: '💥', desc: ['Rewrites everything up close.', 'Yakın mesafede her şeyi baştan yazar.'] },
  { id: 'laser', name: 'Ricochet', lvl: 7, dmg: 34, rate: 2.2, mag: 10, reload: 1.4, spread: 0, pellets: 1, bounces: 3, icon: '🔆', desc: ['A laser that bounces off walls up to 3 times and pierces bugs.', 'Duvarlardan 3 kez seken, bugları delip geçen lazer.'] },
  { id: 'rail', name: 'Root Cause', lvl: 8, dmg: 160, rate: 0.85, mag: 4, reload: 2.0, spread: 0, pellets: 1, pierce: true, icon: '🎯', desc: ['Pierces every bug in a line.', 'Sıradaki tüm bugları delip geçer.'] },
  { id: 'launcher', name: 'rm -rf', lvl: 11, dmg: 120, rate: 1.0, mag: 3, reload: 2.2, spread: 0, pellets: 1, projectile: true, splash: 4.8, icon: '🚀', desc: ['Splash damage. No undo.', 'Alan hasarı. Geri dönüşü yok.'] },
];
const ABILITIES = [
  { id: 'dash', name: 'Dash', key: 'Shift', lvl: 2, cd: 2.5, icon: '💨', desc: ['Burst forward in the direction you move.', 'Hareket ettiğin yöne hızla atıl.'] },
  { id: 'djump', name: ['Double Jump', 'Çift Zıplama'], key: 'Space ×2', lvl: 4, icon: '⏫', desc: ['Jump again mid-air to reach the server racks.', 'Havada bir kez daha zıpla; kabinlerin üstüne çık.'] },
  { id: 'grapple', name: ['Grapple', 'Kanca'], key: 'E', lvl: 5, cd: 3.5, icon: '🪝', desc: ['Fire a hook and zip to any wall or rooftop.', 'Kancayı fırlat, duvara ya da çatıya çekil.'] },
  { id: 'grenade', name: 'git reset --hard', key: 'G', lvl: 6, cd: 7, icon: '💣', desc: ['A bouncing grenade.', 'Sekip patlayan el bombası.'] },
  { id: 'shield', name: ['Shield', 'Kalkan'], key: 'F', lvl: 8, cd: 14, dur: 2.5, icon: '🔰', desc: ['Block all damage for 2.5 s.', '2,5 sn boyunca tüm hasarı engelle.'] },
  { id: 'breakpoint', name: 'Breakpoint', key: 'Q', lvl: 9, cd: 18, dur: 4, icon: '⏸', desc: ['Slow time: bugs move at 25% speed for 4 s.', 'Zamanı yavaşlat: 4 sn boyunca buglar %25 hızda.'] },
  { id: 'blink', name: ['Blink', 'Işınlanma'], key: 'V', lvl: 12, cd: 7, icon: '✨', desc: ['Teleport up to 12 m in the direction you look.', 'Baktığın yöne 12 m ışınlan.'] },
  { id: 'drone', name: 'Pair Programming', key: ['Passive', 'Pasif'], lvl: 14, icon: '🛸', desc: ['A drone on your shoulder shoots the nearest bug.', 'Omzunda uçan drone en yakın buga ateş eder.'] },
];
const UPGRADES = [
  { id: 'dmg', name: ['Damage', 'Hasar'], icon: '🗡', max: 10, base: 40, desc: l => tx(`+${l * 8}% weapon damage`, `+${l * 8}% silah hasarı`) },
  { id: 'hp', name: ['Toughness', 'Dayanıklılık'], icon: '❤️', max: 10, base: 40, desc: l => tx(`+${l * 15} max uptime`, `+${l * 15} maksimum uptime`) },
  { id: 'spd', name: ['Agility', 'Çeviklik'], icon: '👟', max: 8, base: 50, desc: l => tx(`+${l * 4}% move speed`, `+${l * 4}% hareket hızı`) },
  { id: 'rel', name: ['Magazine', 'Şarjör'], icon: '🔋', max: 8, base: 50, desc: l => tx(`-${l * 7}% reload time, +${l * 10}% capacity`, `-${l * 7}% şarjör süresi, +${l * 10}% kapasite`) },
  { id: 'xpb', name: ['Fast Learner', 'Öğrenme Hızı'], icon: '📚', max: 10, base: 60, desc: l => `+${l * 6}% XP` },
  { id: 'cd', name: 'CI Pipeline', icon: '⚙', max: 6, base: 70, desc: l => tx(`-${l * 8}% ability cooldowns`, `-${l * 8}% yetenek bekleme süresi`) },
];
const upCost = (u, l) => Math.round(u.base * Math.pow(1.45, l));
const TINTS = [
  { name: ['Cyan', 'Camgöbeği'], c: 0x36e2ff, lvl: 1 }, { name: ['Alarm', 'Alarm'], c: 0xff8c42, lvl: 3 }, { name: ['Toxic', 'Toksik'], c: 0x7cff4f, lvl: 5 },
  { name: 'Magenta', c: 0xff3d81, lvl: 7 }, { name: ['Purple Haze', 'Mor Duman'], c: 0xa66bff, lvl: 10 }, { name: ['Gold', 'Altın'], c: 0xffd23f, lvl: 15 },
  { name: ['White Light', 'Beyaz Işık'], c: 0xffffff, lvl: 20 }, { name: 'RGB', c: -1, lvl: 25 },
];
const TITLES = [[1, ['Intern', 'Stajyer']], [3, 'Junior Dev'], [6, 'Mid-Level Dev'], [10, 'Senior Dev'], [14, 'Staff Engineer'], [18, 'Principal Engineer'], [22, 'Distinguished Eng.'], [26, '10x Engineer'], [30, 'CTO']];
const titleFor = L => { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (L >= l) t = n; return loc(t); };
const ETYPES = {
  nullptr: { name: 'NullPointer', hp: 34, speed: 3.6, dmg: 10, r: 0.55, pts: 100, color: 0xff4d6d },
  race: { name: 'RaceCondition', hp: 16, speed: 7.0, dmg: 6, r: 0.4, pts: 120, color: 0xffd23f },
  merge: { name: 'MergeConflict', hp: 60, speed: 3.0, dmg: 12, r: 0.66, pts: 150, color: 0xc77dff },
  mini: { name: 'Conflict', hp: 22, speed: 4.6, dmg: 6, r: 0.38, pts: 50, color: 0xe0aaff },
  flaky: { name: 'FlakyTest', hp: 44, speed: 3.2, dmg: 9, r: 0.5, pts: 200, color: 0x3ddc97 },
  leak: { name: 'MemoryLeak', hp: 150, speed: 1.9, dmg: 22, r: 0.8, pts: 260, color: 0x4cc9f0 },
  glitch: { name: 'Glitch', hp: 55, speed: 3.3, dmg: 11, r: 0.5, pts: 170, color: 0x7cff4f, hint: ['walks through walls', 'duvarlardan geçer'] },
  ghost: { name: 'Heisenbug', hp: 50, speed: 3.5, dmg: 12, r: 0.55, pts: 220, color: 0xc8d2ff, hint: ['vanishes when you look at it', 'baktığında görünmez olur'] },
  twin: { name: 'Deadlock', hp: 70, speed: 3.0, dmg: 10, r: 0.55, pts: 180, color: 0xff8c42, hint: ['twins: kill both within 3 s or they revive', 'ikizler: 3 sn içinde ikisini de öldür, yoksa dirilir'] },
  boss: { name: 'PROD INCIDENT', hp: 1400, speed: 2.2, dmg: 30, r: 1.7, pts: 2500, color: 0xff2a2a },
};
const ACH = [
  { id: 'first', name: 'Hello World', desc: ['Squash your first bug', 'İlk bugını öldür'] },
  { id: 'combo', name: ['Green Pipeline', 'Pipeline Yeşil'], desc: ['Reach a x3.0 combo', 'x3.0 combo yap'] },
  { id: 'boss', name: 'Incident Commander', desc: ['Take down a Prod Incident', 'Bir Prod Incident\'ı indir'] },
  { id: 'sprint10', name: 'Velocity', desc: ['10,000 points in Sprint', 'Sprint\'te 10.000 puan'] },
  { id: 'sprint25', name: ['Story Point Monster', 'Story Point Canavarı'], desc: ['25,000 points in Sprint', 'Sprint\'te 25.000 puan'] },
  { id: 'wave10', name: 'Uptime 99.9', desc: ['Reach wave 10 in Survival', 'Hayatta Kal\'da 10. dalga'] },
  { id: 'k100', name: 'Bug Bounty', desc: ['100 bugs in total', 'Toplam 100 bug'] },
  { id: 'k1000', name: 'Zero Defect', desc: ['1,000 bugs in total', 'Toplam 1.000 bug'] },
  { id: 'frag', name: 'Code Review', desc: ['Frag a friend in the Arena', 'Arena\'da bir arkadaşını vur'] },
  { id: 'streak5', name: ['Unstoppable', 'Durdurulamaz'], desc: ['5-kill streak in the Arena', 'Arena\'da 5\'li seri yap'] },
  { id: 'mvp', name: 'MVP', desc: ['Finish an Arena round on top', 'Bir arena maçını birinci bitir'] },
  { id: 'lvl10', name: ['Promoted', 'Terfi'], desc: ['Reach level 10', 'Level 10\'a ulaş'] },
];
const needFor = L => Math.round(150 + 90 * (L - 1) + 8 * (L - 1) * (L - 1));
function levelInfo(total) {
  let L = 1, rem = Math.max(0, total || 0);
  while (rem >= needFor(L) && L < 99) { rem -= needFor(L); L++; }
  return { L, cur: rem, need: needFor(L) };
}

/* ---------------------------- PROFILE ---------------------------- */
const defaultProfile = () => ({ v: 1, xpTotal: 0, coffee: 0, up: {}, best: { sprint: 0, wave: 0 }, totalKills: 0, runs: 0, pvpKills: 0, ach: [], tint: 0, nick: '' });
function sanitizeProfile(d) {
  const p = defaultProfile();
  if (!d || typeof d !== 'object') return p;
  const num = (v, max = 1e12) => (typeof v === 'number' && isFinite(v)) ? clamp(v, 0, max) : 0;
  p.xpTotal = num(d.xpTotal); p.coffee = num(d.coffee); p.totalKills = num(d.totalKills); p.runs = num(d.runs); p.pvpKills = num(d.pvpKills);
  p.best.sprint = num(d.best && d.best.sprint); p.best.wave = num(d.best && d.best.wave, 999);
  for (const u of UPGRADES) p.up[u.id] = Math.floor(num(d.up && d.up[u.id], u.max));
  p.ach = Array.isArray(d.ach) ? d.ach.filter(a => ACH.some(x => x.id === a)) : [];
  p.tint = Math.floor(num(d.tint, TINTS.length - 1));
  p.nick = typeof d.nick === 'string' ? d.nick.slice(0, 16) : '';
  return p;
}
let profile = defaultProfile();
try { profile = sanitizeProfile(JSON.parse(localStorage.getItem(LS_KEY) || 'null')); } catch (e) { }
const saveLocal = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(profile)); } catch (e) { } };
const lvlNow = () => levelInfo(profile.xpTotal).L;
const upLv = id => profile.up[id] || 0;
const cleanNick = v => String(v || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16);

/* ------------------------ CAPABILITIES (Claude or own server) ------------------------ */
const CAP = { db: null, user: null, room: null, uid: null, myName: '' };
let lbState = 'none', lbWriteOff = false, scoresList = [];
const names = {};
function useCap(n) {
  try { if (window.claude && typeof window.claude.use === 'function') return Promise.resolve(window.claude.use(n)).catch(() => null); } catch (e) { }
  return Promise.resolve(null);
}
/* --------- standalone multiplayer: own server (Cloudflare Worker) --------- */
const NET = { server: null, key: null, err: false, clockOffset: 0 };
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
function netIdentity() {
  let pid = null, key = null;
  try { pid = localStorage.getItem('bugavi.pid'); key = localStorage.getItem('bugavi.key'); } catch (e) { }
  if (!/^[a-f0-9]{20}$/.test(pid || '') || !/^[a-f0-9]{32}$/.test(key || '')) {
    pid = hex(10); key = hex(16);
    try { localStorage.setItem('bugavi.pid', pid); localStorage.setItem('bugavi.key', key); } catch (e) { }
  }
  return { pid, key };
}
function wsRoom(name) {
  const st = { ws: null, me: null, peers: new Map(), peerCbs: new Set(), topicCbs: new Map(), connCbs: new Set(), pres: {}, closed: false, retry: 0, timer: null, presTimer: null, presT: 0, connected: false };
  const url = NET.server.replace(/^http/, 'ws') + '/ws/' + name;
  let snap = Object.freeze([]);
  const mk = (peer, p) => Object.freeze({ peer, by: null, isMe: peer === st.me, sameTab: peer === st.me, kind: 'viewer', guest: false, presence: Object.freeze(p || {}), updatedAt: Date.now() });
  const notify = (joined = [], left = [], updated = []) => {
    snap = Object.freeze([...st.peers.values()]);
    const ch = { peers: snap, joined, left, updated };
    st.peerCbs.forEach(f => { try { f(ch); } catch (e) { console.error(e); } });
  };
  const setConn = v => { if (st.connected === v) return; st.connected = v; st.connCbs.forEach(f => { try { f(v); } catch (e) { } }); };
  function sendPres(force) {
    if (!st.ws || st.ws.readyState !== 1) return;
    const now = performance.now();
    if (!force && now - st.presT < 45) { if (!st.presTimer) st.presTimer = setTimeout(() => { st.presTimer = null; sendPres(true); }, 50); return; }
    st.presT = now; st.ws.send(JSON.stringify({ t: 'pres', p: st.pres }));
  }
  function schedule() { if (st.closed) return; clearTimeout(st.timer); st.timer = setTimeout(connect, Math.min(15000, 1000 * Math.pow(2, st.retry++))); }
  function connect() {
    if (st.closed) return;
    let ws; try { ws = new WebSocket(url); } catch (e) { return schedule(); }
    st.ws = ws;
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hello') {
        if (Number.isFinite(m.time)) NET.clockOffset = m.time - Date.now();
        st.me = m.peer; st.retry = 0; st.peers.clear();
        st.peers.set(st.me, mk(st.me, { ...st.pres }));
        for (const x of m.peers || []) if (x && x.peer) st.peers.set(x.peer, mk(x.peer, x.p));
        setConn(true); notify([...st.peers.values()]);
        if (Object.keys(st.pres).length) sendPres(true);
      } else if (m.t === 'join' || m.t === 'pres') {
        const p = mk(m.peer, m.p); const isNew = !st.peers.has(m.peer); st.peers.set(m.peer, p);
        isNew ? notify([p]) : notify([], [], [p]);
      } else if (m.t === 'leave') {
        const p = st.peers.get(m.peer); if (p) { st.peers.delete(m.peer); notify([], [p]); }
      } else if (m.t === 'msg') {
        const cbs = st.topicCbs.get(m.topic); if (!cbs) return;
        const msg = { topic: m.topic, data: m.data, peer: m.peer, by: null, isMe: m.peer === st.me, sameTab: m.peer === st.me, kind: 'viewer', guest: false };
        cbs.forEach(f => { try { f(msg); } catch (e) { console.error(e); } });
      }
    };
    ws.onclose = () => {
      if (st.ws !== ws) return; setConn(false);
      const left = [...st.peers.values()].filter(p => p.peer !== st.me);
      left.forEach(p => st.peers.delete(p.peer)); if (left.length) notify([], left);
      schedule();
    };
    ws.onerror = () => { };
  }
  connect();
  const ka = setInterval(() => { if (st.ws && st.ws.readyState === 1) st.ws.send('{"t":"ping"}'); }, 30000);
  return {
    name,
    presence(patch) {
      for (const k in patch) { if (patch[k] === null) delete st.pres[k]; else st.pres[k] = patch[k]; }
      if (st.me) { const p = mk(st.me, { ...st.pres }); st.peers.set(st.me, p); notify([], [], [p]); }
      sendPres(false); return Promise.resolve();
    },
    onPeers(fn) { st.peerCbs.add(fn); if (snap.length) setTimeout(() => fn({ peers: snap, joined: snap, left: [], updated: [] }), 0); return () => st.peerCbs.delete(fn); },
    on(topic, fn) { if (!st.topicCbs.has(topic)) st.topicCbs.set(topic, new Set()); st.topicCbs.get(topic).add(fn); return () => st.topicCbs.get(topic).delete(fn); },
    emit(topic, data) { if (st.ws && st.ws.readyState === 1) st.ws.send(JSON.stringify({ t: 'emit', topic, data })); return Promise.resolve(); },
    peers: () => snap,
    connected: () => st.connected,
    onConnection(fn) { st.connCbs.add(fn); setTimeout(() => fn(st.connected), 0); return () => st.connCbs.delete(fn); },
    join: n => Promise.resolve(wsRoom(n)),
    leave() { st.closed = true; clearInterval(ka); clearTimeout(st.timer); clearTimeout(st.presTimer); try { st.ws && st.ws.close(); } catch (e) { } return Promise.resolve(); },
  };
}
function fetchScores() {
  if (!NET.server) return;
  fetch(NET.server + '/scores', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { scoresList = Array.isArray(d.scores) ? d.scores.filter(s => s && typeof s === 'object') : []; lbState = 'ok'; renderLBIfOpen(); })
    .catch(() => { if (lbState !== 'ok') lbState = 'error'; renderLBIfOpen(); });
}
const NICK_POOL = ['Segfault', 'Hotfix', 'Kernel', 'Lambda', 'Daemon', 'Cache', 'Mutex', 'Pixel', 'Commit', 'Sudo', 'Regex', 'Ping'];
async function bootStandalone() {
  let cfg = null;
  try { const r = await fetch('config.json', { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch (e) { }
  const server = cfg && typeof cfg.server === 'string' && /^https?:\/\/[^\s/]+$/.test(cfg.server.replace(/\/+$/, '')) ? cfg.server.replace(/\/+$/, '') : null;
  if (!server) return;
  NET.server = server;
  const id = netIdentity(); CAP.uid = id.pid; NET.key = id.key;
  if (!profile.nick) { profile.nick = NICK_POOL[Math.floor(Math.random() * NICK_POOL.length)] + Math.floor(10 + Math.random() * 90); saveLocal(); }
  CAP.room = wsRoom('lobby');
  lbState = 'loading'; fetchScores();
  setInterval(() => { if (game.state === 'menu' && !document.hidden) fetchScores(); }, 30000);
  if (profile.xpTotal > 0) pushScore();
  setupLobby();
}
async function bootCaps() {
  for (let i = 0; i < 20 && !(window.claude && window.claude.use); i++) await sleep(100);
  const [db, user, room] = await Promise.all([useCap('db'), useCap('user'), useCap('room')]);
  CAP.db = db; CAP.user = user; CAP.room = room;
  if (!db && !user && !room) { await bootStandalone(); renderMenu(); return; }
  if (user) {
    try { CAP.uid = await user.id(); } catch (e) { }
    try { const me = await user.me(); CAP.myName = (me && me.name) || ''; } catch (e) { }
  }
  if (db && CAP.uid) { lbState = 'loading'; await syncProfile(); subscribeScores(); if (profile.xpTotal > 0) pushScore(); }
  if (room) setupLobby();
  renderMenu();
}
async function syncProfile() {
  try {
    const snap = await CAP.db.doc(`data/users/${CAP.uid}/profile`).get();
    if (snap.exists) {
      const r = sanitizeProfile(snap.data());
      if (r.xpTotal >= profile.xpTotal) { profile = r; saveLocal(); } else await remoteSave();
    } else if (profile.xpTotal > 0) await remoteSave();
  } catch (e) { console.warn('profile sync', e); }
}
let saveChain = Promise.resolve();
function remoteSave() {
  if (!CAP.db || !CAP.uid) return Promise.resolve();
  const body = JSON.parse(JSON.stringify(profile));
  saveChain = saveChain.then(() => CAP.db.doc(`data/users/${CAP.uid}/profile`).set(body)).catch(e => console.warn('save', e));
  return saveChain;
}
function saveAll() { saveLocal(); remoteSave(); pushScore(); }
function subscribeScores() {
  const t = setTimeout(() => { if (lbState === 'loading') { lbState = 'slow'; renderLBIfOpen(); } }, 10000);
  CAP.db.collection('scores').onSnapshot(snap => {
    if (!snap.metadata.fromCache) clearTimeout(t);
    lbState = 'ok';
    scoresList = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    resolveNames(scoresList.map(s => s.id));
    renderLBIfOpen();
  }, () => { clearTimeout(t); lbState = 'error'; renderLBIfOpen(); });
}
let scoreChain = Promise.resolve(), lastScoreBody = '';
function pushScore() {
  if (!CAP.uid || lbWriteOff || (!CAP.db && !NET.server)) return;
  const body = { nick: profile.nick, sprint: Math.floor(profile.best.sprint), wave: profile.best.wave, level: lvlNow(), xp: Math.floor(profile.xpTotal), pvp: profile.pvpKills, kills: profile.totalKills, tint: profile.tint };
  const key = JSON.stringify(body); if (key === lastScoreBody) return; lastScoreBody = key;
  body.t = Date.now();
  if (NET.server) {
    scoreChain = scoreChain.then(() => fetch(NET.server + '/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, pid: CAP.uid, key: NET.key }) }))
      .then(r => { if (!r.ok) throw new Error(r.status); NET.err = false; fetchScores(); })
      .catch(e => { console.warn('score', e); NET.err = true; lastScoreBody = ''; renderLBIfOpen(); });
    return;
  }
  scoreChain = scoreChain.then(() => CAP.db.doc('scores/' + CAP.uid).set(body)).catch(e => { console.warn('score', e); lbWriteOff = true; renderLBIfOpen(); });
}
function resolveNames(ids) {
  if (!CAP.user || !CAP.user.profiles) return;
  const need = [...new Set(ids.filter(id => id && !(id in names)))];
  if (!need.length) return;
  need.forEach(id => names[id] = '');
  Promise.resolve(CAP.user.profiles(need)).then(ps => {
    for (const id of need) names[id] = (ps && ps[id] && ps[id].name) || '';
    renderOnline(); renderLBIfOpen();
    for (const r of ARENA.remotes.values()) refreshRemoteName(r);
  }).catch(() => { });
}
const dispName = (id, nick) => (typeof nick === 'string' && nick.trim()) ? nick.trim().slice(0, 16) : (id && names[id]) || tx('Player', 'Oyuncu');
const myName = () => profile.nick || CAP.myName || tx('You', 'Sen');

/* --- lobby presence: who's online --- */
let lobbyPeers = [];
function setupLobby() {
  try {
    CAP.room.onPeers(ch => { lobbyPeers = ch.peers; resolveNames(ch.peers.map(p => p.by || (p.presence && p.presence.u)).filter(Boolean)); renderOnline(); }, () => { });
  } catch (e) { }
  setLobbyPresence();
}
let lastLobbyKey = '';
function setLobbyPresence() {
  if (!CAP.room) return;
  const st = game.state === 'menu' || game.state === 'results' ? 'menu' : game.mode;
  const pr = { u: CAP.uid || null, n: profile.nick || '', lv: lvlNow(), st, sc: Math.floor(game.score || 0), wv: game.wave || 0, tn: profile.tint };
  const key = JSON.stringify(pr); if (key === lastLobbyKey) return; lastLobbyKey = key;
  CAP.room.presence(pr).catch(() => { });
}

/* ----------------------------- AUDIO ----------------------------- */
let actx = null, master = null, noiseBuf = null;
function ensureAudio() {
  try {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = settings.vol; master.connect(actx.destination);
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } else if (actx.state === 'suspended') actx.resume();
  } catch (e) { actx = null; }
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!actx) return; const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, ftype, freq, q = 1, delay = 0, f1) {
  if (!actx) return; const t = actx.currentTime + delay;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const SFX = {
  pistol: () => { noise(0.09, 0.5, 'bandpass', 1900, 0.8); tone('sine', 160, 60, 0.1, 0.5); },
  smg: () => { noise(0.05, 0.35, 'bandpass', 2600, 0.9); tone('square', 220, 90, 0.04, 0.12); },
  shotgun: () => { noise(0.28, 0.7, 'lowpass', 1400, 0.7, 0, 300); tone('sine', 110, 40, 0.2, 0.6); },
  laser: () => { tone('square', 1400, 600, 0.12, 0.12); tone('sine', 2200, 900, 0.18, 0.12); },
  rail: () => { tone('sawtooth', 1800, 140, 0.4, 0.22); noise(0.25, 0.3, 'highpass', 3000, 0.5); tone('sine', 80, 40, 0.3, 0.5); },
  launcher: () => { noise(0.3, 0.4, 'lowpass', 900, 1, 0, 200); tone('sine', 300, 80, 0.3, 0.3); },
  boom: () => { noise(0.7, 0.9, 'lowpass', 900, 0.6, 0, 80); tone('sine', 90, 30, 0.6, 0.8); },
  hit: () => tone('triangle', 1500, 1100, 0.04, 0.18),
  kill: () => { tone('square', 520, 110, 0.13, 0.14); noise(0.1, 0.2, 'bandpass', 700, 2); },
  hurt: () => { tone('sawtooth', 200, 80, 0.18, 0.3); noise(0.12, 0.25, 'lowpass', 600); },
  block: () => { tone('triangle', 1800, 2400, 0.06, 0.15); },
  reload: () => { noise(0.04, 0.3, 'highpass', 2500, 1); noise(0.05, 0.3, 'highpass', 1800, 1, 0.18); },
  empty: () => tone('square', 900, 850, 0.03, 0.08),
  dash: () => noise(0.25, 0.35, 'bandpass', 600, 0.7, 0, 3000),
  grapple: () => { noise(0.15, 0.3, 'highpass', 2000, 1, 0, 600); tone('sine', 400, 1200, 0.15, 0.12); },
  blink: () => { tone('sine', 1600, 200, 0.25, 0.25); noise(0.2, 0.2, 'bandpass', 3000, 2, 0, 400); },
  shield: () => { tone('sine', 300, 900, 0.3, 0.2); tone('triangle', 600, 1200, 0.3, 0.1, 0.05); },
  jump: () => tone('sine', 300, 500, 0.08, 0.08),
  pickup: () => { tone('sine', 660, 660, 0.08, 0.2); tone('sine', 990, 990, 0.12, 0.2, 0.07); },
  orb: () => tone('sine', 700, 300, 0.15, 0.06),
  spawn: () => tone('sine', 120, 420, 0.25, 0.05),
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.25, i * 0.09)),
  streak: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.12, 0.12, i * 0.06)),
  wave: () => { tone('sawtooth', 220, 220, 0.25, 0.12); tone('sawtooth', 330, 330, 0.3, 0.12, 0.2); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone('square', 880, 440, 0.25, 0.12, i * 0.3); } },
  bp: () => tone('sine', 900, 120, 0.6, 0.3),
  buy: () => { tone('triangle', 784, 784, 0.08, 0.2); tone('triangle', 1175, 1175, 0.14, 0.2, 0.08); },
};
const sfx = n => { try { SFX[n] && SFX[n](); } catch (e) { } };

/* ----------------------------- RENDERER ----------------------------- */
const A = 30; // arena half size
const container = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#fff">${tx('WebGL could not start in this browser. Turn on hardware acceleration and try again.', 'Bu tarayıcıda WebGL açılamadı. Donanım hızlandırmayı açıp tekrar dene.')}</div>`;
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
container.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b14);
scene.fog = new THREE.Fog(0x070b14, 28, 80);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202030, 1.0));
const vmDir = new THREE.DirectionalLight(0xffffff, 0.8); vmDir.position.set(1, 2, 1); vmScene.add(vmDir);

scene.add(new THREE.HemisphereLight(0x8fb3ff, 0x1a1028, 0.6));
const sun = new THREE.DirectionalLight(0xdfe8ff, 0.75);
sun.position.set(18, 34, 12); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 90 });
scene.add(sun);
[[-A + 2, -A + 2, 0x36e2ff], [A - 2, A - 2, 0xff3d81], [A - 2, -A + 2, 0xa66bff], [-A + 2, A - 2, 0x3ddc97]].forEach(([x, z, c]) => {
  const l = new THREE.PointLight(c, 1.1, 34, 2); l.position.set(x, 5, z); scene.add(l);
});
const flash = new THREE.PointLight(0xffcc66, 0, 9, 2); scene.add(flash);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
const gridTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#0c1222'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0f172b'; g.fillRect(4, 4, w / 2 - 8, h / 2 - 8); g.fillRect(w / 2 + 4, h / 2 + 4, w / 2 - 8, h / 2 - 8);
  g.strokeStyle = 'rgba(54,226,255,.55)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  g.strokeStyle = 'rgba(54,226,255,.15)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
}, 15);
const glowTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#36e2ff'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
}, 15);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(A * 2, A * 2),
  new THREE.MeshStandardMaterial({ map: gridTex, emissive: 0x36e2ff, emissiveMap: glowTex, emissiveIntensity: 0.35, roughness: 0.85, metalness: 0.1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const wallMat = new THREE.MeshStandardMaterial({ color: 0x121a30, roughness: 0.8 });
const neonMat = new THREE.MeshBasicMaterial({ color: 0x36e2ff });
for (const [x, z, sx, sz] of [[0, -A - 0.5, A * 2 + 2, 1], [0, A + 0.5, A * 2 + 2, 1], [-A - 0.5, 0, 1, A * 2 + 2], [A + 0.5, 0, 1, A * 2 + 2]]) {
  const w = new THREE.Mesh(new THREE.BoxGeometry(sx, 5, sz), wallMat); w.position.set(x, 2.5, z); w.receiveShadow = true; scene.add(w);
  const n = new THREE.Mesh(new THREE.BoxGeometry(sx === 1 ? 0.2 : sx, 0.12, sz === 1 ? 0.2 : sz), neonMat);
  n.position.set(x - Math.sign(x) * 0.5, 4.2, z - Math.sign(z) * 0.5); scene.add(n);
  const n2 = n.clone(); n2.position.y = 0.15; scene.add(n2);
}
const rackTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#141b2e'; g.fillRect(0, 0, w, h);
  for (let y = 8; y < h - 8; y += 18) {
    g.fillStyle = '#0b1020'; g.fillRect(8, y, w - 16, 14);
    for (let i = 0; i < 5; i++) { g.fillStyle = Math.random() < 0.7 ? '#3ddc97' : (Math.random() < 0.5 ? '#36e2ff' : '#ff3d81'); g.fillRect(14 + i * 9, y + 5, 4, 4); }
    g.fillStyle = '#26314f'; g.fillRect(64, y + 4, 52, 6);
  }
});
const rackGlow = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let y = 8; y < h - 8; y += 18) for (let i = 0; i < 5; i++) { g.fillStyle = ['#3ddc97', '#36e2ff', '#ff3d81'][(i + y) % 3]; g.fillRect(14 + i * 9, y + 5, 4, 4); }
});
const rackMat = new THREE.MeshStandardMaterial({ map: rackTex, emissive: 0xffffff, emissiveMap: rackGlow, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.4 });
const crateMat = new THREE.MeshStandardMaterial({ color: 0x2a3556, roughness: 0.7, metalness: 0.3 });
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a2340, roughness: 0.5, metalness: 0.5 });
const platMat = new THREE.MeshStandardMaterial({ color: 0x1b2442, roughness: 0.6, metalness: 0.4, emissive: 0xff3d81, emissiveIntensity: 0.05 });
const OBS = [];
function addObs(x, z, sx, sz, h, mat, trim) {
  const o = { x, z, sx, sz, h, minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2 };
  OBS.push(o);
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  if (trim) { const t = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.04, 0.06, sz + 0.04), new THREE.MeshBasicMaterial({ color: trim })); t.position.set(x, h + 0.01, z); scene.add(t); }
}
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  addObs(sx * 14, sz * 9, 1.4, 7, 2.4, rackMat, 0x36e2ff);
  addObs(sx * 7, sz * 18, 7, 1.4, 2.4, rackMat, 0x36e2ff);
  addObs(sx * 7, sz * 7, 1.4, 1.4, 1.1, crateMat, 0xffd23f);
  addObs(sx * 21, sz * 21, 1.8, 1.8, 4.5, pillarMat, 0xff3d81);
}
addObs(-22, 0, 2, 2, 1.1, crateMat, 0xffd23f); addObs(22, 0, 2, 2, 1.1, crateMat, 0xffd23f);
addObs(0, -22, 2, 2, 1.1, crateMat, 0xffd23f); addObs(0, 22, 2, 2, 1.1, crateMat, 0xffd23f);
addObs(0, 0, 5, 5, 1.2, platMat, 0xff3d81);
const PORTALS = [];
for (const s of [-1, 1]) for (const k of [-14, 0, 14]) { PORTALS.push(new V3(s * 27.5, 0, k)); PORTALS.push(new V3(k, 0, s * 27.5)); }
const portalMeshes = PORTALS.map(p => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff3d81, transparent: true, opacity: 0.45 }));
  m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); scene.add(m); m.userData.pulse = 0; return m;
});

/* --------------------------- COLLISION / RAYS --------------------------- */
function pushOut(p, r, o) {
  const cx = clamp(p.x, o.minX, o.maxX), cz = clamp(p.z, o.minZ, o.maxZ);
  let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) { const d = Math.sqrt(d2); dx /= d; dz /= d; p.x = cx + dx * r; p.z = cz + dz * r; return [dx, dz]; }
  const l = p.x - o.minX, rr = o.maxX - p.x, t = p.z - o.minZ, b = o.maxZ - p.z, m = Math.min(l, rr, t, b);
  if (m === l) { p.x = o.minX - r; return [-1, 0]; } if (m === rr) { p.x = o.maxX + r; return [1, 0]; }
  if (m === t) { p.z = o.minZ - r; return [0, -1]; } p.z = o.maxZ + r; return [0, 1];
}
// slab test; returns entry distance and the face normal it entered through (null if the origin is inside)
function rayAABBN(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1e9, axis = -1, sign = 0;
  const ax = [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]];
  for (let i = 0; i < 3; i++) {
    const [oo, dd, mn, mx] = ax[i];
    if (Math.abs(dd) < 1e-9) { if (oo < mn || oo > mx) return null; continue; }
    let t1 = (mn - oo) / dd, t2 = (mx - oo) / dd, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
    tmax = Math.min(tmax, t2); if (tmin > tmax) return null;
  }
  if (axis < 0) return { t: 0, n: null };
  const n = new V3(); n.setComponent(axis, sign); return { t: tmin, n };
}
function rayWorldN(o, d, maxD = 150) {
  let best = maxD, n = null;
  for (const ob of OBS) { const r = rayAABBN(o, d, ob.minX, 0, ob.minZ, ob.maxX, ob.h, ob.maxZ); if (r && r.t < best) { best = r.t; n = r.n; } }
  if (d.x > 1e-9) { const t = (A - o.x) / d.x; if (t < best) { best = t; n = new V3(-1, 0, 0); } } else if (d.x < -1e-9) { const t = (-A - o.x) / d.x; if (t < best) { best = t; n = new V3(1, 0, 0); } }
  if (d.z > 1e-9) { const t = (A - o.z) / d.z; if (t < best) { best = t; n = new V3(0, 0, -1); } } else if (d.z < -1e-9) { const t = (-A - o.z) / d.z; if (t < best) { best = t; n = new V3(0, 0, 1); } }
  if (d.y < -1e-9) { const t = -o.y / d.y; if (t < best) { best = t; n = new V3(0, 1, 0); } }
  return { t: Math.max(0, best), n };
}
const rayWorld = (o, d, maxD = 150) => rayWorldN(o, d, maxD).t;
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
  if (disc < 0) return -1; const s = Math.sqrt(disc); let t = -b - s; if (t < 0) t = -b + s; return t > 0 ? t : -1;
}
function insideObs(p, pad = 0) { for (const o of OBS) if (p.x > o.minX - pad && p.x < o.maxX + pad && p.z > o.minZ - pad && p.z < o.maxZ + pad && p.y < o.h) return o; return null; }
const losClear = (a, b) => { const d = new V3().subVectors(b, a); const L = d.length(); d.divideScalar(L); return rayWorld(a, d, L + 1) >= L - 0.2; };

/* ------------------------------- FX ------------------------------- */
const PN = 800;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const parts = []; for (let i = 0; i < PN; i++) { parts.push({ life: 0, v: new V3(), c: new THREE.Color() }); pPos[i * 3 + 1] = -999; }
const pMesh = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
pMesh.frustumCulled = false; scene.add(pMesh);
let pIdx = 0;
function burst(pos, color, n = 12, spd = 6, life = 0.5) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const p = parts[pIdx], k = pIdx * 3; pIdx = (pIdx + 1) % PN;
    p.life = life * rand(0.5, 1); p.max = p.life; p.v.set(rand(-1, 1), rand(-0.2, 1.2), rand(-1, 1)).normalize().multiplyScalar(spd * rand(0.3, 1));
    p.c.copy(c); pPos[k] = pos.x; pPos[k + 1] = pos.y; pPos[k + 2] = pos.z;
  }
}
function updateParts(dt) {
  for (let i = 0; i < PN; i++) {
    const p = parts[i]; if (p.life <= 0) continue; const k = i * 3;
    p.life -= dt; if (p.life <= 0) { pPos[k + 1] = -999; continue; }
    p.v.y -= 12 * dt; pPos[k] += p.v.x * dt; pPos[k + 1] += p.v.y * dt; pPos[k + 2] += p.v.z * dt;
    if (pPos[k + 1] < 0.02) { pPos[k + 1] = 0.02; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
    const f = p.life / p.max; pCol[k] = p.c.r * f; pCol[k + 1] = p.c.g * f; pCol[k + 2] = p.c.b * f;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
const beams = [];
function beam(from, to, color, width = 0.02, life = 0.07) {
  let b = beams.find(x => x.life <= 0);
  if (!b) { b = { mesh: new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), life: 0 }; scene.add(b.mesh); beams.push(b); }
  const L = from.distanceTo(to); if (L < 0.01) return;
  b.mesh.position.copy(from); b.mesh.lookAt(to); b.mesh.scale.set(width, width, L);
  b.mesh.material.color.set(color); b.mesh.material.opacity = 1; b.mesh.visible = true; b.life = life; b.max = life;
}
const booms = [];
const boomGeo = new THREE.SphereGeometry(1, 16, 12);
function explosionFx(pos, radius, color = 0xff8c42) {
  const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos); scene.add(m); booms.push({ m, t: 0, r: radius });
  burst(pos, color, 50, 12, 0.8); burst(pos, 0xffffff, 16, 8, 0.4);
  flash.position.copy(pos).y += 1; flash.color.set(color); flash.intensity = 6; flash.distance = radius * 4;
  const d = pos.distanceTo(P.pos); shake = Math.max(shake, clamp(1 - d / 25, 0, 1) * 0.5); sfx('boom');
}
function updateFx(dt) {
  for (const b of beams) if (b.life > 0) { b.life -= dt; b.mesh.material.opacity = Math.max(0, b.life / b.max); if (b.life <= 0) b.mesh.visible = false; }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.t += dt; const k = b.t / 0.35;
    b.m.scale.setScalar(b.r * (0.3 + k * 0.9)); b.m.material.opacity = Math.max(0, 0.8 * (1 - k));
    if (k >= 1) { scene.remove(b.m); b.m.material.dispose(); booms.splice(i, 1); }
  }
  flash.intensity = Math.max(0, flash.intensity - dt * 40);
  portalMeshes.forEach(m => { m.userData.pulse = Math.max(0, m.userData.pulse - dt); const s = 1 + m.userData.pulse * 0.8; m.scale.set(s, s, s); m.material.opacity = 0.35 + m.userData.pulse * 0.6; });
}

/* ------------------------------ PLAYER ------------------------------ */
const P = { pos: new V3(0, 0, 8), vel: new V3(), dashV: new V3(), yaw: 0, pitch: 0, onGround: true, jumps: 0, hp: 100, maxHp: 100, r: 0.4, eye: 1.6, bob: 0 };
const keys = {};
let firing = false, shake = 0;
const cds = { dash: 0, grenade: 0, breakpoint: 0, grapple: 0, shield: 0, blink: 0 };
let breakT = 0, overT = 0, hurtFlash = 0, shieldT = 0;
const GR = { active: false, point: new V3(), t: 0 };
const has = id => { const a = ABILITIES.find(x => x.id === id) || WEAPONS.find(x => x.id === id); return a && lvlNow() >= a.lvl; };
const pvp = () => game.mode === 'arena';
const dmgMult = () => pvp() ? 1 : 1 + 0.08 * upLv('dmg');
const cdMult = () => pvp() ? 1 : 1 - 0.08 * upLv('cd');
const tintColor = () => { const t = TINTS[profile.tint] || TINTS[0]; return t.c < 0 ? new THREE.Color().setHSL((performance.now() / 3000) % 1, 1, 0.6).getHex() : t.c; };
const canAct = () => game.state === 'playing' && !(pvp() && (ARENA.dead || ARENA.inter));

function groundAt(x, z, fromY) {
  let g = 0;
  for (const o of OBS) if (x > o.minX - P.r * 0.6 && x < o.maxX + P.r * 0.6 && z > o.minZ - P.r * 0.6 && z < o.maxZ + P.r * 0.6 && o.h <= fromY + 0.06) g = Math.max(g, o.h);
  return g;
}
function updatePlayer(dt) {
  const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const wish = new V3();
  if (keys.KeyW) wish.add(fwd); if (keys.KeyS) wish.sub(fwd); if (keys.KeyD) wish.add(right); if (keys.KeyA) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize();
  if (keys.ArrowLeft) P.yaw += 2.4 * dt; if (keys.ArrowRight) P.yaw -= 2.4 * dt;
  if (keys.ArrowUp) P.pitch = clamp(P.pitch + 1.6 * dt, -1.5, 1.5); if (keys.ArrowDown) P.pitch = clamp(P.pitch - 1.6 * dt, -1.5, 1.5);
  const prevY = P.pos.y;
  if (GR.active) {
    GR.t += dt;
    const to = new V3(GR.point.x - P.pos.x, GR.point.y - (P.pos.y + 1.0), GR.point.z - P.pos.z); const dist = to.length();
    if (dist < 1.3 || GR.t > 1.1) {
      GR.active = false; P.vel.multiplyScalar(0.45);
      if (GR.point.y > P.pos.y + 0.6) P.vel.y = Math.max(P.vel.y, 7.5); // mantle onto ledges
    } else {
      P.vel.copy(to.multiplyScalar(26 / dist));
      beam(muzzleWorld(), GR.point, 0xe8f6ff, 0.012, 0.03);
    }
  } else {
    const spd = 7.2 * (pvp() ? 1 : 1 + 0.04 * upLv('spd'));
    const acc = P.onGround ? 14 : 4, k = Math.min(1, acc * dt);
    P.vel.x += (wish.x * spd - P.vel.x) * k; P.vel.z += (wish.z * spd - P.vel.z) * k;
    P.vel.y -= 24 * dt;
  }
  P.dashV.multiplyScalar(Math.exp(-7 * dt));
  P.pos.x += (P.vel.x + P.dashV.x) * dt; P.pos.z += (P.vel.z + P.dashV.z) * dt;
  for (const o of OBS) if (P.pos.y < o.h - 0.06) pushOut(P.pos, P.r, o);
  P.pos.x = clamp(P.pos.x, -A + P.r, A - P.r); P.pos.z = clamp(P.pos.z, -A + P.r, A - P.r);
  P.pos.y = Math.min(P.pos.y + P.vel.y * dt, 9);
  const g = groundAt(P.pos.x, P.pos.z, prevY);
  if (P.pos.y <= g) { if (!P.onGround && P.vel.y < -9) shake = Math.max(shake, 0.08); P.pos.y = g; P.vel.y = Math.max(0, P.vel.y); if (!GR.active) P.vel.y = 0; P.onGround = true; P.jumps = 0; }
  else P.onGround = false;
  const moving = P.onGround && wish.lengthSq() > 0;
  P.bob += dt * (moving ? 11 : 0);
}
function jump() {
  if (GR.active) { GR.active = false; P.vel.y = Math.max(P.vel.y, 6); return; }
  if (P.onGround) { P.vel.y = 8.4; P.onGround = false; P.jumps = 1; sfx('jump'); }
  else if (has('djump') && P.jumps < 2) { P.vel.y = 8.0; P.jumps = 2; burst(P.pos.clone().setY(P.pos.y + 0.1), 0x36e2ff, 10, 3, 0.4); sfx('jump'); }
}
function dash() {
  if (!has('dash') || cds.dash > 0 || !canAct()) return;
  const d = new V3(); const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  if (keys.KeyW) d.add(fwd); if (keys.KeyS) d.sub(fwd); if (keys.KeyD) d.add(right); if (keys.KeyA) d.sub(right);
  if (d.lengthSq() === 0) d.copy(fwd); d.normalize();
  P.dashV.copy(d.multiplyScalar(26)); cds.dash = 2.5 * cdMult(); sfx('dash');
  burst(P.pos.clone().setY(P.pos.y + 0.8), 0x36e2ff, 14, 4, 0.35);
}
function useGrapple() {
  if (!has('grapple') || cds.grapple > 0 || !canAct()) return;
  const o = camera.getWorldPosition(new V3()), d = camDir();
  const hit = rayWorldN(o, d, 34);
  if (hit.t >= 33.9 || hit.t < 1.6 || (hit.n && hit.n.y > 0.5 && o.y + d.y * hit.t < 0.1)) { sfx('empty'); return; }
  GR.active = true; GR.t = 0; GR.point.copy(o).addScaledVector(d, hit.t - 0.25);
  if (hit.n) GR.point.addScaledVector(hit.n, 0.3);
  cds.grapple = 3.5 * cdMult(); P.dashV.set(0, 0, 0); sfx('grapple');
  burst(GR.point, 0xe8f6ff, 10, 3, 0.3);
}
function useBlink() {
  if (!has('blink') || cds.blink > 0 || !canAct()) return;
  const d = camDir(); d.y = 0; if (d.lengthSq() < 1e-4) return; d.normalize();
  const o = new V3(P.pos.x, P.pos.y + 0.9, P.pos.z);
  const dist = Math.min(12, rayWorld(o, d, 12.6) - 0.7);
  if (dist < 1) { sfx('empty'); return; }
  burst(o, tintColor(), 26, 5, 0.5);
  P.pos.addScaledVector(d, dist);
  for (const ob of OBS) if (P.pos.y < ob.h - 0.06) pushOut(P.pos, P.r, ob);
  GR.active = false; cds.blink = 7 * cdMult(); sfx('blink'); shake = Math.max(shake, 0.06);
  burst(new V3(P.pos.x, P.pos.y + 0.9, P.pos.z), tintColor(), 26, 5, 0.5);
}
function useShield() {
  if (!has('shield') || cds.shield > 0 || !canAct()) return;
  shieldT = 2.5; cds.shield = 14 * cdMult(); sfx('shield');
}

/* ------------------------------ WEAPONS ------------------------------ */
const ws = {}; let curW = 'pistol', nextFire = 0;
const W = id => WEAPONS.find(w => w.id === id);
const magOf = w => pvp() ? w.mag : Math.round(w.mag * (1 + 0.1 * upLv('rel')));
function resetWeapons() { for (const w of WEAPONS) ws[w.id] = { mag: magOf(w), rel: 0 }; if (!has(curW)) curW = 'pistol'; buildViewmodel(); }
function switchW(id) { if (!W(id) || !has(id) || id === curW) return; ws[curW].rel = 0; curW = id; nextFire = Math.max(nextFire, game.t + 0.25); buildViewmodel(); vm.swap = 1; updateHUDWeapons(); }
function cycleW(dir) { const av = WEAPONS.filter(w => has(w.id)); let i = av.findIndex(w => w.id === curW); i = (i + dir + av.length) % av.length; switchW(av[i].id); }
function reload() { const w = W(curW), s = ws[curW]; if (s.rel > 0 || s.mag >= magOf(w)) return; s.rel = w.reload * (pvp() ? 1 : 1 - 0.07 * upLv('rel')); sfx('reload'); }
const tmpV = new V3();
function muzzleWorld() { return camera.localToWorld(tmpV.set(0.26, -0.2, -0.9).clone()); }
function camDir() { return new V3(0, 0, -1).applyQuaternion(camera.quaternion).normalize(); }
function remoteHitT(r, o, d) {
  const p = r.mesh.position; let best = -1, head = false;
  const th = raySphere(o, d, tmpV.set(p.x, p.y + 1.62, p.z), 0.3); if (th > 0) { best = th; head = true; }
  for (const [hy, rr] of [[1.05, 0.5], [0.45, 0.4]]) { const t = raySphere(o, d, tmpV.set(p.x, p.y + hy, p.z), rr); if (t > 0 && (best < 0 || t < best)) { best = t; head = false; } }
  return { t: best, head };
}
const targetable = r => r.alive && !r.prot;

function fire() {
  const w = W(curW), s = ws[curW];
  if (game.t < nextFire || s.rel > 0 || !canAct()) return;
  if (s.mag <= 0) { sfx('empty'); reload(); nextFire = game.t + 0.25; return; }
  s.mag--; nextFire = game.t + 1 / (w.rate * (overT > 0 ? 1.6 : 1));
  if (pvp()) ARENA.protT = 0; // shooting ends spawn protection
  vm.kick = Math.min(1, vm.kick + (w.id === 'rail' || w.id === 'shotgun' || w.id === 'launcher' ? 1 : 0.45));
  P.pitch = clamp(P.pitch + (w.id === 'shotgun' ? 0.03 : w.id === 'rail' ? 0.035 : 0.008), -1.5, 1.5);
  sfx(w.id); vm.flashT = 0.05;
  const o = camera.getWorldPosition(new V3()), dir = camDir(), mz = muzzleWorld();
  flash.position.copy(mz); flash.color.set(w.id === 'laser' ? tintColor() : 0xffcc66); flash.intensity = 3; flash.distance = 8;
  if (w.projectile) { spawnRocket(mz, dir); if (s.mag === 0) setTimeout(reload, 200); return; }
  const agg = new Map(), aggP = new Map();
  let lastEnd = null;
  if (w.bounces) {
    // ricochet laser: reflects off walls, pierces bugs, each target hit at most once per shot
    let ro = o.clone(), rd = dir.clone(), from = mz.clone();
    const hitSet = new Set();
    for (let b = 0; b <= w.bounces; b++) {
      const { t: wallT, n } = rayWorldN(ro, rd, 80);
      for (const e of enemies) { if (e.dead || e.downed || hitSet.has(e)) continue; const t = raySphere(ro, rd, e.center, e.hitR); if (t > 0 && t < wallT) { hitSet.add(e); agg.set(e, (agg.get(e) || 0) + w.dmg * dmgMult()); } }
      if (pvp()) for (const r of ARENA.remotes.values()) { if (!targetable(r) || hitSet.has(r)) continue; const h = remoteHitT(r, ro, rd); if (h.t > 0 && h.t < wallT) { hitSet.add(r); aggP.set(r, (aggP.get(r) || 0) + w.dmg * (h.head ? 1.6 : 1)); } }
      const end = ro.clone().addScaledVector(rd, wallT);
      if (!lastEnd) lastEnd = end.clone();
      beam(from, end, tintColor(), 0.04, 0.3); beam(from, end, 0xffffff, 0.014, 0.2);
      burst(end, tintColor(), 6, 3, 0.25);
      if (!n) break;
      rd.reflect(n).normalize(); ro = end.addScaledVector(n, 0.03); from = ro.clone();
    }
  } else {
    const right = new V3(1, 0, 0).applyQuaternion(camera.quaternion), up = new V3(0, 1, 0).applyQuaternion(camera.quaternion);
    for (let i = 0; i < w.pellets; i++) {
      const d = dir.clone();
      if (w.spread) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * w.spread * (P.onGround ? 1 : 1.6); d.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize(); }
      const wallT = rayWorld(o, d);
      const hits = [];
      for (const e of enemies) { if (e.dead || e.downed) continue; const t = raySphere(o, d, e.center, e.hitR); if (t > 0 && t < wallT) hits.push({ e, t }); }
      if (pvp()) for (const r of ARENA.remotes.values()) { if (!targetable(r)) continue; const h = remoteHitT(r, o, d); if (h.t > 0 && h.t < wallT) hits.push({ r, t: h.t, head: h.head }); }
      hits.sort((a, b) => a.t - b.t);
      let endT = wallT;
      const list = w.pierce ? hits : hits.slice(0, 1);
      for (const h of list) {
        const dm = w.dmg * dmgMult();
        if (h.e) agg.set(h.e, (agg.get(h.e) || 0) + dm);
        else aggP.set(h.r, (aggP.get(h.r) || 0) + w.dmg * (h.head ? 1.6 : 1));
        if (!w.pierce) endT = h.t;
      }
      const end = o.clone().addScaledVector(d, endT); lastEnd = end;
      if (w.id === 'rail') { beam(mz, end, tintColor(), 0.06, 0.35); beam(mz, end, 0xffffff, 0.02, 0.25); }
      else beam(mz, end, w.id === 'shotgun' ? 0xffd27a : 0xfff2b0, 0.012, 0.06);
      if (!list.length || w.pierce) burst(end, 0x9fdcff, 5, 4, 0.25);
    }
  }
  let hitAny = false, killAny = false;
  for (const [e, dm] of agg) { hitAny = true; if (damageEnemy(e, dm, dir)) killAny = true; }
  for (const [r, dm] of aggP) { hitAny = true; hitRemote(r, dm); }
  if (hitAny) hitMarker(killAny);
  if (pvp() && lastEnd) { ARENA.shotN++; ARENA.shot = [ARENA.shotN, r2(lastEnd.x), r2(lastEnd.y), r2(lastEnd.z)]; }
  if (s.mag === 0) setTimeout(() => { if (ws[curW] === s) reload(); }, 180);
}
let hitTO = 0;
function hitMarker(kill) {
  const h = $('#hitmark'); h.classList.add('on'); h.classList.toggle('kill', !!kill);
  clearTimeout(hitTO); hitTO = setTimeout(() => h.classList.remove('on'), kill ? 180 : 90); sfx(kill ? 'kill' : 'hit');
}

/* projectiles: rockets, grenades, enemy orbs */
const projs = [];
const rocketGeo = new THREE.SphereGeometry(0.14, 10, 8), orbGeo = new THREE.SphereGeometry(0.22, 10, 8), nadeGeo = new THREE.IcosahedronGeometry(0.16, 0);
function spawnRocket(pos, dir) {
  const m = new THREE.Mesh(rocketGeo, new THREE.MeshBasicMaterial({ color: tintColor() })); m.position.copy(pos); scene.add(m);
  projs.push({ kind: 'rocket', m, vel: dir.clone().multiplyScalar(34), life: 3 });
}
function throwGrenade() {
  if (!has('grenade') || cds.grenade > 0 || !canAct()) return;
  cds.grenade = 7 * cdMult(); if (pvp()) ARENA.protT = 0;
  const d = camDir(); const m = new THREE.Mesh(nadeGeo, new THREE.MeshStandardMaterial({ color: 0x3ddc97, emissive: 0x3ddc97, emissiveIntensity: 0.6 }));
  m.position.copy(camera.getWorldPosition(new V3())).addScaledVector(d, 0.6); scene.add(m);
  projs.push({ kind: 'nade', m, vel: d.multiplyScalar(17).add(new V3(0, 4.5, 0)).add(P.vel.clone().multiplyScalar(0.5)), life: 1.4 });
  sfx('dash');
}
function enemyOrb(from, to, speed = 13, dmg = 9, color = 0x3ddc97) {
  const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color })); m.position.copy(from); scene.add(m);
  const d = new V3().subVectors(to, from).normalize();
  projs.push({ kind: 'orb', m, vel: d.multiplyScalar(speed), life: 5, dmg }); sfx('orb');
}
function explode(pos, dmg, radius, fromPlayer) {
  explosionFx(pos, radius);
  let killAny = false, hitAny = false;
  for (const e of enemies.slice()) {
    if (e.dead || e.downed) continue; const d = e.center.distanceTo(pos) - e.r;
    if (d < radius) { hitAny = true; if (damageEnemy(e, dmg * dmgMult() * (1 - 0.6 * clamp(d / radius, 0, 1)), null)) killAny = true; }
  }
  if (fromPlayer && pvp()) for (const r of ARENA.remotes.values()) {
    if (!targetable(r)) continue; const d = r.mesh.position.clone().setY(r.mesh.position.y + 1).distanceTo(pos);
    if (d < radius) { hitAny = true; hitRemote(r, dmg * 0.8 * (1 - 0.6 * d / radius)); }
  }
  if (hitAny) hitMarker(killAny);
}
function updateProjs(dt) {
  const ts = breakT > 0 ? 0.25 : 1;
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; let dead = false;
    const step = (p.kind === 'orb' ? dt * ts : dt);
    p.life -= step;
    if (p.kind === 'nade') { p.vel.y -= 20 * step; p.m.rotation.x += step * 10; }
    const prev = p.m.position.clone();
    p.m.position.addScaledVector(p.vel, step);
    const pos = p.m.position;
    if (p.kind === 'nade') {
      if (pos.y < 0.16) { pos.y = 0.16; p.vel.y *= -0.45; p.vel.x *= 0.7; p.vel.z *= 0.7; }
      const ob = insideObs(pos, 0.1);
      if (ob) { pos.copy(prev); if (prev.y >= ob.h - 0.1) { p.vel.y = Math.abs(p.vel.y) * 0.4; } else { p.vel.x *= -0.5; p.vel.z *= -0.5; } }
      if (Math.abs(pos.x) > A - 0.2) { p.vel.x *= -0.5; pos.x = clamp(pos.x, -A + 0.2, A - 0.2); }
      if (Math.abs(pos.z) > A - 0.2) { p.vel.z *= -0.5; pos.z = clamp(pos.z, -A + 0.2, A - 0.2); }
      if (p.life <= 0) { explode(pos.clone(), 150, 5.2, true); dead = true; }
      else if (Math.random() < 0.5) burst(pos, 0x3ddc97, 1, 0.5, 0.3);
    } else {
      const hitWall = pos.y < 0.05 || Math.abs(pos.x) > A || Math.abs(pos.z) > A || insideObs(pos);
      if (p.kind === 'rocket') {
        burst(pos, 0xffa040, 2, 1.5, 0.3);
        let hit = hitWall;
        if (!hit) for (const e of enemies) if (!e.dead && !e.downed && e.center.distanceTo(pos) < e.hitR + 0.15) { hit = true; break; }
        if (!hit && pvp()) for (const r of ARENA.remotes.values()) if (targetable(r) && r.mesh.position.clone().setY(r.mesh.position.y + 1).distanceTo(pos) < 0.7) { hit = true; break; }
        if (hit || p.life <= 0) { explode(prev, W('launcher').dmg, W('launcher').splash, true); dead = true; }
      } else if (p.kind === 'orb') {
        if (!pvp() && pos.distanceTo(tmpV.set(P.pos.x, P.pos.y + 1.0, P.pos.z)) < 0.75) { damagePlayer(p.dmg, prev); dead = true; burst(pos, 0x3ddc97, 10, 4, 0.4); }
        else if (hitWall || p.life <= 0) { dead = true; burst(pos, 0x3ddc97, 6, 3, 0.3); }
      }
    }
    if (dead) { scene.remove(p.m); p.m.material.dispose(); projs.splice(i, 1); }
  }
}

/* ------------------------------ VIEWMODEL ------------------------------ */
const vm = { group: new THREE.Group(), kick: 0, swap: 0, flashT: 0, accent: null, flash: null };
vm.group.scale.setScalar(0.62); vmScene.add(vm.group);
const vmDark = new THREE.MeshStandardMaterial({ color: 0x252c3d, roughness: 0.45, metalness: 0.7 });
const vmMid = new THREE.MeshStandardMaterial({ color: 0x3a4460, roughness: 0.5, metalness: 0.5 });
function buildViewmodel() {
  while (vm.group.children.length) vm.group.remove(vm.group.children[0]);
  const acc = new THREE.MeshBasicMaterial({ color: tintColor() }); vm.accent = acc;
  const g = vm.group, box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const cyl = (r, l, m, x, y, z, seg = 10) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); return c; };
  let tip = -0.4;
  switch (curW) {
    case 'pistol': box(0.07, 0.1, 0.3, vmDark, 0, 0, -0.1); box(0.06, 0.15, 0.07, vmMid, 0, -0.11, 0.0).rotation.x = 0.25; box(0.072, 0.015, 0.25, acc, 0, 0.05, -0.1); tip = -0.27; break;
    case 'smg': box(0.08, 0.11, 0.46, vmDark, 0, 0, -0.15); box(0.05, 0.18, 0.07, vmMid, 0, -0.14, -0.2); box(0.06, 0.14, 0.07, vmMid, 0, -0.1, 0.03).rotation.x = 0.3; cyl(0.022, 0.16, vmMid, 0, 0.015, -0.44); box(0.082, 0.015, 0.38, acc, 0, 0.06, -0.15); tip = -0.53; break;
    case 'shotgun': box(0.1, 0.12, 0.42, vmDark, 0, -0.01, -0.05); cyl(0.03, 0.6, vmMid, -0.022, 0.03, -0.42); cyl(0.03, 0.6, vmMid, 0.022, 0.03, -0.42); box(0.11, 0.06, 0.22, acc, 0, -0.06, -0.3); tip = -0.73; break;
    case 'laser': box(0.09, 0.1, 0.38, vmDark, 0, 0, -0.08); box(0.06, 0.14, 0.07, vmMid, 0, -0.1, 0.04).rotation.x = 0.3;
      for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 - i * 0.006, 0), acc); p.position.set(0, 0.02, -0.32 - i * 0.07); g.add(p); }
      box(0.092, 0.012, 0.3, acc, 0, 0.055, -0.08); tip = -0.5; break;
    case 'rail': box(0.09, 0.12, 0.55, vmDark, 0, 0, -0.2); cyl(0.03, 0.5, vmMid, 0, 0.02, -0.55);
      for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16), acc); t.position.set(0, 0.02, -0.38 - i * 0.1); g.add(t); }
      tip = -0.8; break;
    case 'launcher': cyl(0.075, 0.7, vmDark, 0, 0.03, -0.32, 14); cyl(0.085, 0.08, acc, 0, 0.03, -0.64, 14); box(0.06, 0.14, 0.07, vmMid, 0, -0.1, -0.05); box(0.04, 0.06, 0.1, acc, 0, 0.14, -0.2); tip = -0.69; break;
  }
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.9 }));
  f.position.set(0, 0.02, tip); f.visible = false; g.add(f); vm.flash = f;
}
function updateViewmodel(dt) {
  vm.kick = Math.max(0, vm.kick - dt * 6); vm.swap = Math.max(0, vm.swap - dt * 4);
  const s = ws[curW], rel = s && s.rel > 0 ? 1 : 0;
  const speed = Math.hypot(P.vel.x, P.vel.z) / 7;
  const bx = Math.sin(P.bob) * 0.012 * speed, by = Math.abs(Math.cos(P.bob)) * 0.012 * speed;
  vm.group.position.set(0.25 + bx, -0.24 + by - vm.swap * 0.3 - rel * 0.06, -0.5 + vm.kick * 0.06);
  vm.group.rotation.set(vm.kick * 0.18 + rel * -0.5, 0, rel * 0.3);
  vm.flashT -= dt; if (vm.flash) { vm.flash.visible = vm.flashT > 0; vm.flash.scale.setScalar(rand(0.8, 1.5)); }
  if (vm.accent && profile.tint === 7) vm.accent.color.set(tintColor());
}

/* ------------------------------ ENEMIES ------------------------------ */
const enemies = [];
const sphGeo = new THREE.SphereGeometry(1, 14, 10), legGeo = new THREE.BoxGeometry(0.07, 0.07, 1), eyeGeo = new THREE.SphereGeometry(1, 8, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff }), pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const legMat = new THREE.MeshStandardMaterial({ color: 0x151a28, roughness: 0.6 });
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
const barGeo = new THREE.PlaneGeometry(1, 0.09); const barFgGeo = new THREE.PlaneGeometry(1, 0.09); barFgGeo.translate(0.5, 0, 0);
function makeBug(type) {
  const T = ETYPES[type], r = T.r, g = new THREE.Group();
  const fadeable = type === 'ghost' || type === 'glitch';
  const mat = new THREE.MeshStandardMaterial({ color: T.color, roughness: 0.35, metalness: 0.25, emissive: T.color, emissiveIntensity: 0.22, transparent: fadeable });
  const em = fadeable ? Object.assign(eyeMat.clone(), { transparent: true }) : eyeMat;
  const pm = fadeable ? Object.assign(pupilMat.clone(), { transparent: true }) : pupilMat;
  const lm = fadeable ? Object.assign(legMat.clone(), { transparent: true }) : legMat;
  const body = new THREE.Mesh(sphGeo, mat); body.scale.set(r, r * 0.7, r * 1.3); body.position.y = r * 0.8; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(sphGeo, mat); head.scale.setScalar(r * 0.55); head.position.set(0, r * 0.95, -r * 1.25); g.add(head);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(eyeGeo, em); e.scale.setScalar(r * 0.17); e.position.set(s * r * 0.22, r * 1.12, -r * 1.68); g.add(e);
    const pp = new THREE.Mesh(eyeGeo, pm); pp.scale.setScalar(r * 0.08); pp.position.set(s * r * 0.22, r * 1.13, -r * 1.83); g.add(pp);
    const ant = new THREE.Mesh(legGeo, lm); ant.scale.set(0.6, 0.6, r * 0.8); ant.position.set(s * r * 0.2, r * 1.4, -r * 1.5); ant.rotation.set(0.9, s * 0.4, 0); g.add(ant);
  }
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, k = i % 3;
    const pivot = new THREE.Group(); pivot.position.set(s * r * 0.6, r * 0.6, (k - 1) * r * 0.7);
    const leg = new THREE.Mesh(legGeo, lm); leg.scale.set(r * 1.2, r * 1.2, r * 1.1); leg.rotation.y = Math.PI / 2; leg.position.x = s * r * 0.5; leg.rotation.z = s * -0.6; leg.position.y = -r * 0.25;
    pivot.add(leg); g.add(pivot); legs.push(pivot);
  }
  if (type === 'boss') {
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 6), mat); const a = i / 8 * Math.PI * 2; sp.position.set(Math.cos(a) * r * 0.85, r * 1.2, Math.sin(a) * r * 0.9); sp.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(sp); }
  }
  if (type === 'flaky') { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: 0x3ddc97 })); ring.rotation.x = Math.PI / 2; ring.position.y = r * 1.9; g.add(ring); g.userData.ring = ring; }
  if (type === 'twin') { const lock = new THREE.Mesh(new THREE.TorusGeometry(r * 0.35, 0.05, 6, 16), new THREE.MeshBasicMaterial({ color: 0xffd23f })); lock.position.y = r * 1.75; g.add(lock); g.userData.lock = lock; }
  const bar = new THREE.Group(); const bg = new THREE.Mesh(barGeo, barBgMat); const fg = new THREE.Mesh(barFgGeo, new THREE.MeshBasicMaterial({ color: 0x3ddc97, depthTest: false }));
  fg.position.x = -0.5; fg.position.z = 0.001; bar.add(bg); bar.add(fg); bg.renderOrder = fg.renderOrder = 10; bar.position.y = r * 2.1 + 0.2; bar.visible = false; g.add(bar);
  return { g, mat, legs, bar, fg, body, fade: fadeable ? [mat, em, pm, lm] : null };
}
function introEnemy(type) {
  const T = ETYPES[type]; if (!T.hint || game.seen.has(type)) return;
  game.seen.add(type); toast(`<b>${esc(T.name)}</b> · ${esc(loc(T.hint))}`);
}
function spawnEnemy(type, at, hpScale = 1, opts = {}) {
  const T = ETYPES[type];
  let pos = at;
  if (!pos) {
    const cands = PORTALS.filter(p => p.distanceTo(P.pos) > 14);
    const p = (cands.length ? cands : PORTALS)[Math.floor(Math.random() * (cands.length || PORTALS.length))];
    pos = p.clone().add(new V3(rand(-0.8, 0.8), 0, rand(-0.8, 0.8)));
    const pm = portalMeshes[PORTALS.indexOf(p)]; if (pm) pm.userData.pulse = 1;
    if (pos.distanceTo(P.pos) < 25) sfx('spawn');
  }
  if (type === 'twin' && !opts.child) {
    const side = new V3(-pos.z, 0, pos.x).normalize().multiplyScalar(1.3);
    const a = spawnEnemy('twin', pos.clone().add(side), hpScale, { child: true });
    const b = spawnEnemy('twin', pos.clone().sub(side), hpScale, { child: true });
    a.partner = b; b.partner = a;
    a.tether = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(a.tether);
    introEnemy('twin');
    return a;
  }
  const b = makeBug(type); b.g.position.copy(pos); b.g.position.y = 0; scene.add(b.g);
  const e = {
    type, T, ...b, pos: b.g.position, vel: new V3(), hp: T.hp * hpScale, maxHp: T.hp * hpScale, r: T.r, baseR: T.r, dead: false,
    center: new V3(), hitR: T.r * 1.15, atk: 0, shoot: rand(1.5, 3), blink: rand(4, 7), summon: 6, burst: 3, age: 0, seed: Math.random() * 100,
    strafe: Math.random() < 0.5 ? -1 : 1, avoid: new V3(), avoidT: 0, flashT: 0, scale: 1, alpha: 1, downed: false, downT: 0, partner: null, tether: null,
  };
  e.center.set(pos.x, e.r * 0.8, pos.z);
  burst(pos.clone().setY(0.5), T.color, 14, 4, 0.5);
  enemies.push(e);
  if (type === 'ghost' || type === 'glitch') introEnemy(type);
  if (type === 'boss') { $('#bossbar').classList.remove('hidden'); game.boss = e; sfx('alarm'); banner('PROD INCIDENT!', tx('All hands on deck', 'Herkes war room\'a')); }
  return e;
}
function damageEnemy(e, dmg, dir) {
  if (e.dead || e.downed) return false;
  e.hp -= dmg; e.flashT = 0.08; e.bar.visible = e.type !== 'boss' && e.alpha > 0.5;
  if (dir) { e.pos.addScaledVector(new V3(dir.x, 0, dir.z), e.type === 'boss' ? 0.02 : 0.12); }
  burst(e.center, e.T.color, 4, 3, 0.3);
  if (e.hp > 0) return false;
  if (e.type === 'twin' && e.partner && !e.partner.dead && !e.partner.downed) {
    e.hp = 0; e.downed = true; e.downT = 3; e.bar.visible = false;
    popup(tx('Now the other twin!', 'Şimdi diğer ikiz!'));
    return true;
  }
  const partner = e.type === 'twin' && e.partner && e.partner.downed && !e.partner.dead ? e.partner : null;
  killEnemy(e);
  if (partner) killEnemy(partner);
  return true;
}
function removeTether(e) { if (e && e.tether) { scene.remove(e.tether); e.tether.material.dispose(); e.tether = null; } }
function killEnemy(e) {
  e.dead = true; e.downed = false; scene.remove(e.g); e.mat.dispose();
  if (e.fade) e.fade.slice(1).forEach(m => m.dispose());
  removeTether(e); removeTether(e.partner);
  burst(e.center, e.T.color, e.type === 'boss' ? 120 : 26, e.type === 'boss' ? 14 : 7, 0.9);
  burst(e.center, 0xffffff, 8, 5, 0.4);
  if (e.type === 'merge') { for (const s of [-1, 1]) spawnEnemy('mini', e.pos.clone().add(new V3(s * 0.6, 0, s * 0.3)), game.hpScale); }
  if (e.type === 'boss') { game.boss = null; $('#bossbar').classList.add('hidden'); unlockAch('boss'); explosionFx(e.center.clone(), 6, 0xff2a2a); banner(tx('INCIDENT RESOLVED', 'INCIDENT KAPANDI'), tx('Don\'t forget the postmortem', 'Postmortem yazmayı unutma')); }
  game.combo++; game.comboT = 3;
  const mult = 1 + Math.min(game.combo, 20) * 0.1;
  const pts = Math.round(e.T.pts * mult * (game.mode === 'survival' ? 1 + (game.wave - 1) * 0.05 : 1));
  game.score += pts; game.kills++;
  popup(`+${pts}${mult > 1.05 ? ' ×' + mult.toFixed(1) : ''}`);
  if (game.kills === 1) unlockAch('first');
  if (mult >= 3) unlockAch('combo');
  const dropR = Math.random();
  if (e.type === 'boss') { spawnPickup('hp', e.pos.clone().add(new V3(1, 0, 0))); spawnPickup('hp', e.pos.clone().add(new V3(-1, 0, 0))); spawnPickup('over', e.pos.clone()); }
  else if (dropR < 0.07) spawnPickup('hp', e.pos.clone()); else if (dropR < 0.095) spawnPickup('over', e.pos.clone());
}
function setAlpha(e, a) {
  e.alpha = a; if (!e.fade) return;
  for (const m of e.fade) m.opacity = a;
  e.body.castShadow = a > 0.5;
}
function updateEnemies(dt) {
  const ts = breakT > 0 ? 0.25 : 1, edt = dt * ts;
  const pc = new V3(P.pos.x, P.pos.y + 1.0, P.pos.z);
  const cpos = camera.position.clone(), cdir = camDir();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]; if (e.dead) { enemies.splice(i, 1); continue; }
    e.age += edt;
    // Deadlock twins: tether + downed state
    if (e.tether && e.partner) {
      const L = e.center.distanceTo(e.partner.center);
      e.tether.position.copy(e.center); e.tether.lookAt(e.partner.center);
      const any = e.downed || e.partner.downed;
      e.tether.scale.set(any ? 0.08 : 0.04, any ? 0.08 : 0.04, Math.max(0.01, L));
      e.tether.material.color.set(any ? 0xff2a2a : 0xff8c42); e.tether.material.opacity = 0.45 + Math.sin(e.age * 8) * 0.25;
    }
    if (e.downed) {
      e.downT -= edt;
      e.mat.emissiveIntensity = 0.05 + (Math.sin(e.age * 18) > 0 ? 0.6 : 0);
      e.g.rotation.z = lerp(e.g.rotation.z, 1.2, Math.min(1, dt * 8));
      if (e.downT <= 0) {
        e.downed = false; e.hp = e.maxHp * 0.6; e.g.rotation.z = 0;
        burst(e.center, 0xff8c42, 24, 5, 0.5); popup(tx('Deadlock revived!', 'Deadlock dirildi!'));
      }
      continue;
    }
    if (e.g.userData.lock) e.g.userData.lock.rotation.y += dt * 3;
    if (e.type === 'leak') { e.scale = Math.min(2.1, 1 + e.age * 0.035); e.r = e.baseR * e.scale; e.g.scale.setScalar(e.scale); e.hitR = e.r * 1.15; }
    const to = new V3(P.pos.x - e.pos.x, 0, P.pos.z - e.pos.z); const dist = to.length(); to.divideScalar(dist || 1);
    const perp = new V3(-to.z, 0, to.x);
    const des = new V3();
    switch (e.type) {
      case 'race': des.copy(to).addScaledVector(perp, Math.sin(e.age * 5 + e.seed) * 0.9); break;
      case 'flaky': if (dist < 9) des.copy(to).negate(); else if (dist > 17) des.copy(to); else des.copy(perp).multiplyScalar(e.strafe); if (Math.random() < 0.004) e.strafe *= -1; break;
      case 'boss': des.copy(to).addScaledVector(perp, Math.sin(e.age * 0.7) * 0.6); break;
      case 'ghost': des.copy(to).addScaledVector(perp, Math.sin(e.age * 1.3 + e.seed) * 0.5); break;
      default: des.copy(to);
    }
    if (e.avoidT > 0) { e.avoidT -= edt; des.addScaledVector(e.avoid, 1.6); }
    for (const o of enemies) {
      if (o === e || o.dead) continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d2 = dx * dx + dz * dz, m = e.r + o.r + 0.2;
      if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2); des.x += dx / d * (m - d) * 2.2; des.z += dz / d * (m - d) * 2.2; }
    }
    if (des.lengthSq() > 1) des.normalize();
    const spd = e.T.speed * (game.spdScale || 1) * (e.type === 'leak' ? 1 / Math.sqrt(e.scale) : 1);
    const stopping = e.type !== 'flaky' && dist < e.r + P.r + 0.2;
    e.vel.lerp(des.multiplyScalar(stopping ? 0 : spd), Math.min(1, 6 * edt));
    e.pos.addScaledVector(e.vel, edt);
    if (e.type !== 'glitch') for (const o of OBS) {
      const n = pushOut(e.pos, e.r, o);
      if (n && e.avoidT <= 0) { e.avoid.set(-n[1], 0, n[0]); if (e.avoid.dot(to) < 0) e.avoid.negate(); e.avoidT = 0.6; }
    }
    e.pos.x = clamp(e.pos.x, -A + e.r, A - e.r); e.pos.z = clamp(e.pos.z, -A + e.r, A - e.r);
    const sp = Math.hypot(e.vel.x, e.vel.z);
    if (sp > 0.2) e.g.rotation.y = Math.atan2(-e.vel.x, -e.vel.z); else e.g.rotation.y = Math.atan2(-to.x, -to.z);
    e.legs.forEach((l, k) => l.rotation.x = Math.sin(e.age * (6 + sp * 3) + k * 1.7) * 0.45);
    const hover = e.type === 'ghost' ? 0.35 + Math.sin(e.age * 2.2) * 0.15 : 0;
    e.pos.y = hover;
    e.center.set(e.pos.x, e.r * 0.8 + hover, e.pos.z);
    // Heisenbug: invisible while observed. Glitch: translucent and flickering inside walls.
    if (e.type === 'ghost') {
      const v = new V3().subVectors(e.center, cpos); const L = v.length(); v.divideScalar(L || 1);
      const looked = v.dot(cdir) > Math.cos(0.33) && losClear(cpos, e.center);
      setAlpha(e, lerp(e.alpha, looked ? 0.04 : 0.9, Math.min(1, dt * 10)));
    } else if (e.type === 'glitch') {
      const inWall = !!insideObs(new V3(e.pos.x, 0.5, e.pos.z), e.r * 0.3);
      setAlpha(e, inWall ? (Math.random() < 0.3 ? 0.15 : 0.45) : (Math.random() < 0.04 ? 0.5 : 1));
    }
    e.flashT -= dt; e.mat.emissiveIntensity = e.flashT > 0 ? 1.6 : (e.type === 'boss' ? 0.3 + Math.sin(e.age * 6) * 0.2 : 0.22);
    if (e.bar.visible) {
      if (e.alpha < 0.5) e.bar.visible = false;
      else { e.fg.scale.x = Math.max(0.001, e.hp / e.maxHp); e.bar.quaternion.copy(camera.quaternion); e.bar.quaternion.premultiply(e.g.quaternion.clone().invert()); }
    }
    if (e.g.userData.ring) { e.g.userData.ring.rotation.z += dt * 3; e.g.userData.ring.visible = Math.random() > 0.08; }
    // attacks
    e.atk -= edt;
    if (e.type !== 'flaky' && dist < e.r + P.r + 0.45 && P.pos.y < 2.4 + e.r && e.atk <= 0) {
      e.atk = 0.9; damagePlayer(e.T.dmg * (e.type === 'leak' ? e.scale : 1) * (game.dmgScale || 1), e.center);
    }
    if (e.type === 'flaky') {
      e.shoot -= edt; e.blink -= edt;
      if (e.shoot <= 0 && dist < 30) { e.shoot = rand(1.8, 2.6); const from = e.center.clone().add(new V3(0, 0.4, 0)); if (losClear(from, pc)) enemyOrb(from, pc, 13, e.T.dmg * (game.dmgScale || 1)); }
      if (e.blink <= 0) {
        e.blink = rand(5, 8); burst(e.center, 0x3ddc97, 18, 5, 0.4);
        for (let tries = 0; tries < 8; tries++) {
          const a = Math.random() * Math.PI * 2, d = rand(11, 16); const np = new V3(P.pos.x + Math.cos(a) * d, 0, P.pos.z + Math.sin(a) * d);
          if (Math.abs(np.x) < A - 1 && Math.abs(np.z) < A - 1 && !insideObs(np.clone().setY(0.1), e.r)) { e.pos.copy(np); break; }
        }
        burst(e.pos.clone().setY(0.5), 0x3ddc97, 18, 5, 0.4);
      }
    }
    if (e.type === 'boss') {
      e.burst -= edt; e.summon -= edt;
      if (e.burst <= 0) {
        e.burst = 3.2; const from = e.center.clone().add(new V3(0, 0.6, 0));
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + e.age; enemyOrb(from, from.clone().add(new V3(Math.cos(a), -0.02, Math.sin(a))), 10, 12, 0xff4040); }
        for (const s of [-0.12, 0, 0.12]) { const t = pc.clone().add(new V3(perp.x * s * 10, 0, perp.z * s * 10)); enemyOrb(from, t, 15, 12, 0xff8c42); }
      }
      if (e.summon <= 0) { e.summon = 9; for (let k = 0; k < 3; k++) spawnEnemy('nullptr', e.pos.clone().add(new V3(rand(-3, 3), 0, rand(-3, 3))), game.hpScale); }
      $('#bossfill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
    }
  }
}
function clearEnemies() {
  for (const e of enemies) { scene.remove(e.g); e.mat.dispose(); removeTether(e); } enemies.length = 0;
  for (const p of projs) { scene.remove(p.m); p.m.material.dispose(); } projs.length = 0;
  for (const p of pickups) scene.remove(p.m); pickups.length = 0;
  game.boss = null; $('#bossbar').classList.add('hidden'); drone.visible = false;
}

/* ------------------------------ PICKUPS ------------------------------ */
const pickups = [];
const puGeo = new THREE.OctahedronGeometry(0.32, 0);
function spawnPickup(kind, pos) {
  const c = kind === 'hp' ? 0x3ddc97 : 0xffd23f;
  const m = new THREE.Mesh(puGeo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 }));
  m.position.copy(pos).setY(0.8); scene.add(m); pickups.push({ kind, m, life: 16 });
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.life -= dt; p.m.rotation.y += dt * 2.5; p.m.position.y = 0.8 + Math.sin(game.t * 3 + i) * 0.15;
    p.m.visible = p.life > 3 || Math.sin(p.life * 20) > 0;
    const d = Math.hypot(p.m.position.x - P.pos.x, p.m.position.z - P.pos.z);
    if (d < 1.4 && Math.abs(P.pos.y + 0.8 - p.m.position.y) < 2) {
      if (p.kind === 'hp') { P.hp = Math.min(P.maxHp, P.hp + 25); toast('<b>Hotfix</b> · +25 uptime'); }
      else { overT = 8; toast(`<b>Overclock</b> · ${tx('+60% fire rate for 8 s', '8 sn ateş hızı +60%')}`); }
      sfx('pickup'); burst(p.m.position, p.kind === 'hp' ? 0x3ddc97 : 0xffd23f, 16, 4, 0.5);
      scene.remove(p.m); pickups.splice(i, 1); continue;
    }
    if (p.life <= 0) { scene.remove(p.m); pickups.splice(i, 1); }
  }
}

/* ------------------------------ DRONE ------------------------------ */
const drone = new THREE.Group();
{
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xdde6ff, metalness: 0.6, roughness: 0.3 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 20), new THREE.MeshBasicMaterial({ color: 0x36e2ff }));
  ring.rotation.x = Math.PI / 2; const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x36e2ff })); eye.position.z = -0.13;
  drone.add(b, ring, eye); drone.visible = false; scene.add(drone);
}
let droneCD = 0;
function updateDrone(dt) {
  const on = has('drone') && !pvp() && game.state === 'playing';
  drone.visible = on; if (!on) return;
  const tgt = new V3(P.pos.x + Math.cos(P.yaw) * 0.9 + Math.sin(P.yaw) * 1.1, P.pos.y + 2.5 + Math.sin(game.t * 2) * 0.12, P.pos.z - Math.sin(P.yaw) * 0.9 + Math.cos(P.yaw) * 1.1);
  drone.position.lerp(tgt, Math.min(1, dt * 6));
  droneCD -= dt; if (droneCD > 0) return;
  let best = null, bd = 22;
  for (const e of enemies) { if (e.dead || e.downed || e.alpha < 0.3) continue; const d = e.center.distanceTo(drone.position); if (d < bd && losClear(drone.position, e.center)) { bd = d; best = e; } }
  if (best) { droneCD = 0.5; drone.lookAt(best.center); beam(drone.position.clone(), best.center.clone(), 0x36e2ff, 0.02, 0.08); damageEnemy(best, 9 * dmgMult(), null); }
  else droneCD = 0.2;
}

/* ------------------------------ GAME STATE ------------------------------ */
const game = { state: 'menu', mode: null, t: 0, score: 0, kills: 0, combo: 0, comboT: 0, wave: 0, timeLeft: 0, boss: null, hpScale: 1, spdScale: 1, dmgScale: 1, spawnT: 0, toSpawn: [], breakT: 0, paused: false, seen: new Set() };
const SPRINT_LEN = 180;
let pointerLocked = false, lockFallback = false;
const modeName = m => ({ sprint: 'Sprint', survival: tx('Survival', 'Hayatta Kal'), arena: tx('Live Arena', 'Canlı Arena') }[m] || m);

function startRun(mode) {
  ensureAudio();
  clearEnemies();
  Object.assign(game, { state: 'playing', mode, t: 0, score: 0, kills: 0, combo: 0, comboT: 0, wave: 0, timeLeft: SPRINT_LEN, hpScale: 1, spdScale: 1, dmgScale: 1, spawnT: 1.2, toSpawn: [], breakT: 0, paused: false, bossDone: false, seen: new Set() });
  P.maxHp = pvp() ? 100 : 100 + 15 * upLv('hp'); P.hp = P.maxHp;
  P.vel.set(0, 0, 0); P.dashV.set(0, 0, 0); P.pitch = 0;
  if (mode === 'arena') { const s = arenaSpawn(); P.pos.copy(s); P.yaw = Math.atan2(s.x, s.z); }
  else { P.pos.set(0, 0, 8); P.yaw = 0; }
  for (const k in cds) cds[k] = 0;
  breakT = 0; overT = 0; shieldT = 0; GR.active = false;
  resetWeapons();
  $('#menu').classList.add('hidden'); $('#results').classList.add('hidden'); $('#pause').classList.add('hidden'); $('#mvp').classList.add('hidden');
  $('#hud').classList.remove('hidden'); document.body.classList.add('playing');
  $('#lblA').textContent = mode === 'survival' ? tx('WAVE', 'DALGA') : tx('TIME', 'SÜRE');
  $('#lblB').textContent = mode === 'arena' ? 'FRAG' : tx('SCORE', 'PUAN');
  $('#lblC').textContent = mode === 'arena' ? tx('DEATHS', 'ÖLÜM') : 'COMBO';
  buildAbilityHUD(); updateHUDWeapons();
  if (mode === 'survival') nextWave();
  if (mode === 'sprint') banner(tx('SPRINT STARTED', 'SPRINT BAŞLADI'), tx('3 minutes · more bugs, more points', '3 dakika · ne kadar bug, o kadar puan'));
  if (mode === 'arena') joinArena();
  track('run_start', { mode, level: lvlNow(), language: LANG });
  setLobbyPresence();
}
function nextWave() {
  game.wave++; const n = game.wave;
  game.hpScale = 1 + (n - 1) * 0.09; game.spdScale = Math.min(1.3, 1 + (n - 1) * 0.015); game.dmgScale = 1 + (n - 1) * 0.04;
  const list = [];
  if (n % 5 === 0) { list.push('boss'); for (let i = 0; i < 3 + n; i++) list.push(pickType(n)); }
  else for (let i = 0; i < 5 + n * 3; i++) list.push(pickType(n));
  game.toSpawn = list; game.spawnT = 1.5;
  banner(tx(`WAVE ${n}`, `DALGA ${n}`), n % 5 === 0 ? tx('Prod is on fire…', 'Prod alarm veriyor…') : tx(`${list.length} bugs incoming`, `${list.length} bug yolda`)); sfx('wave');
  if (n >= 10) unlockAch('wave10');
  setLobbyPresence();
}
function weighted(w) { let s = w.reduce((a, b) => a + b[1], 0) * Math.random(); for (const [k, v] of w) { s -= v; if (s <= 0) return k; } return w[0][0]; }
function pickType(n) {
  const w = [['nullptr', 5]]; if (n >= 2) w.push(['race', 3]); if (n >= 3) w.push(['merge', 2]); if (n >= 4) w.push(['flaky', 2], ['glitch', 1.6]);
  if (n >= 5) w.push(['ghost', 1.6]); if (n >= 6) w.push(['leak', 1.3]); if (n >= 7) w.push(['twin', 1.2]);
  return weighted(w);
}
function sprintType(t) {
  const w = [['nullptr', 5]]; if (t > 15) w.push(['race', 3]); if (t > 35) w.push(['merge', 2]); if (t > 45) w.push(['glitch', 1.6]); if (t > 55) w.push(['flaky', 2]);
  if (t > 70) w.push(['ghost', 1.6]); if (t > 80) w.push(['leak', 1.3]); if (t > 95) w.push(['twin', 1.2]);
  return weighted(w);
}
const alive = () => enemies.filter(e => !e.dead).length;
function updateDirector(dt) {
  if (game.mode === 'sprint') {
    game.timeLeft -= dt; const el = SPRINT_LEN - game.timeLeft, k = el / SPRINT_LEN;
    game.hpScale = 1 + k * 0.9; game.spdScale = 1 + k * 0.2; game.dmgScale = 1 + k * 0.5;
    game.spawnT -= dt;
    if (game.spawnT <= 0 && alive() < 10 + k * 16) { game.spawnT = lerp(1.25, 0.32, k); spawnEnemy(sprintType(el), null, game.hpScale); }
    if (!game.bossDone && el > 105) { game.bossDone = true; spawnEnemy('boss', null, 0.75 * game.hpScale); }
    if (game.timeLeft <= 0) { game.timeLeft = 0; endRun('time'); }
  } else if (game.mode === 'survival') {
    if (game.breakT > 0) { game.breakT -= dt; if (game.breakT <= 0) nextWave(); return; }
    game.spawnT -= dt;
    const cap = Math.min(30, 10 + game.wave * 1.5);
    if (game.toSpawn.length && game.spawnT <= 0 && alive() < cap) { game.spawnT = Math.max(0.25, 0.75 - game.wave * 0.03); const t = game.toSpawn.shift(); spawnEnemy(t, null, t === 'boss' ? 1 + (game.wave / 5 - 1) * 0.6 : game.hpScale); }
    if (!game.toSpawn.length && alive() === 0) {
      const bonus = game.wave * 150; game.score += bonus; P.hp = Math.min(P.maxHp, P.hp + 15 + game.wave);
      banner(tx(`WAVE ${game.wave} CLEARED`, `DALGA ${game.wave} TEMİZ`), tx(`+${fmt(bonus)} bonus · uptime restored`, `+${fmt(bonus)} bonus · uptime yenilendi`)); game.breakT = 4;
    }
  }
}
function damagePlayer(dmg, from, attackerPeer) {
  if (game.state !== 'playing') return;
  if (pvp() && (ARENA.dead || ARENA.inter || ARENA.protT > 0)) return;
  if (shieldT > 0) { sfx('block'); burst(new V3(P.pos.x, P.pos.y + 1.1, P.pos.z), 0x36e2ff, 6, 3, 0.25); return; }
  P.hp -= dmg; hurtFlash = 1; sfx('hurt'); shake = Math.max(shake, 0.12);
  if (from) {
    const ang = Math.atan2(from.x - P.pos.x, from.z - P.pos.z);
    const rel = ang - Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw));
    const el = document.createElement('div'); el.className = 'dmgarc'; el.style.transform = `rotate(${-rel}rad)`;
    $('#dmgdir').appendChild(el); setTimeout(() => el.remove(), 950);
  }
  if (attackerPeer) ARENA.lastAttacker = attackerPeer;
  if (P.hp <= 0) { P.hp = 0; if (pvp()) arenaDie(); else endRun('dead'); }
}
function useBreakpoint() {
  if (!has('breakpoint') || cds.breakpoint > 0 || pvp() || !canAct()) return;
  cds.breakpoint = 18 * cdMult(); breakT = 4; sfx('bp'); banner('⏸ BREAKPOINT', tx('Time slowed down', 'Zaman yavaşladı'));
}

/* ------------------------------ RESULTS ------------------------------ */
function endRun(reason) {
  if (game.state !== 'playing') return;
  const mode = game.mode;
  game.state = 'results';
  if (mode === 'arena') leaveArena();
  firing = false; GR.active = false; document.body.classList.remove('playing');
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
  $('#hud').classList.add('hidden'); $('#pause').classList.add('hidden'); $('#scoreboard').classList.add('hidden');
  const before = levelInfo(profile.xpTotal);
  let xp, coffee, recLine = '';
  const xpMul = 1 + 0.06 * upLv('xpb');
  if (mode === 'arena') { xp = ARENA.totK * 60 + ARENA.mvps * 150 + Math.min(10, Math.floor(game.t / 30)) * 15; coffee = ARENA.totK * 6 + ARENA.mvps * 25 + Math.floor(game.t / 60) * 3; }
  else { xp = Math.floor(game.score / 10) + (mode === 'survival' ? (game.wave - 1) * 40 : 0); coffee = Math.floor(game.score / 180) + (mode === 'survival' ? game.wave * 3 : 0); }
  xp = Math.round(xp * xpMul);
  profile.xpTotal += xp; profile.coffee += coffee; profile.totalKills += game.kills; profile.runs++;
  if (mode === 'sprint' && game.score > profile.best.sprint) { profile.best.sprint = Math.floor(game.score); if (game.score > 0) recLine = tx('NEW SPRINT RECORD!', 'YENİ SPRINT REKORU!'); }
  if (mode === 'survival' && game.wave > profile.best.wave) { profile.best.wave = game.wave; recLine = tx('NEW WAVE RECORD!', 'YENİ DALGA REKORU!'); }
  if (mode === 'arena') { profile.pvpKills += ARENA.totK; if (ARENA.mvps) recLine = tx(`MVP × ${ARENA.mvps}`, `MVP × ${ARENA.mvps}`); }
  if (mode === 'sprint' && game.score >= 10000) unlockAch('sprint10');
  if (mode === 'sprint' && game.score >= 25000) unlockAch('sprint25');
  if (profile.totalKills >= 100) unlockAch('k100');
  if (profile.totalKills >= 1000) unlockAch('k1000');
  const after = levelInfo(profile.xpTotal);
  track('run_end', { mode, reason, score: Math.floor(game.score), kills: game.kills, wave: game.wave, xp_gained: xp, coffee_gained: coffee, level: after.L, duration_sec: Math.round(game.t), language: LANG });
  if (after.L > before.L) track('level_up', { level: after.L, title: titleFor(after.L) });
  if (after.L >= 10) unlockAch('lvl10');
  saveAll();
  const unlocks = [];
  for (let L = before.L + 1; L <= after.L; L++) {
    WEAPONS.filter(w => w.lvl === L).forEach(w => unlocks.push(`<b>${tx('New weapon', 'Yeni silah')}:</b> ${w.icon} ${esc(w.name)} <span class="note">— ${tx('key', 'tuş')} ${WEAPONS.indexOf(w) + 1}</span>`));
    ABILITIES.filter(a => a.lvl === L).forEach(a => unlocks.push(`<b>${tx('New ability', 'Yeni yetenek')}:</b> ${a.icon} ${esc(loc(a.name))} <span class="note">— ${esc(loc(a.key))}</span>`));
    TINTS.filter(t => t.lvl === L && L > 1).forEach(t => unlocks.push(`<b>${tx('New color', 'Yeni renk')}:</b> ${esc(loc(t.name))}`));
    TITLES.filter(t => t[0] === L).forEach(t => unlocks.push(`<b>${tx('New title', 'Yeni unvan')}:</b> ${esc(loc(t[1]))}`));
  }
  const head = {
    time: tx('SPRINT OVER', 'SPRINT BİTTİ'), dead: mode === 'sprint' ? tx('PROD IS DOWN', 'PROD ÇÖKTÜ') : tx('SYSTEM CRASHED', 'SİSTEM ÇÖKTÜ'),
    quit: tx('RUN OVER', 'TUR BİTTİ'), arena: tx('YOU LEFT THE ARENA', 'ARENADAN ÇIKTIN'),
  }[reason] || tx('RUN OVER', 'TUR BİTTİ');
  const sub = { sprint: tx('Sprint · 3 min', 'Sprint · 3 dk'), survival: tx(`Survival · reached wave ${game.wave}`, `Hayatta Kal · ${game.wave}. dalgaya ulaştın`), arena: modeName('arena') }[mode];
  const stats = mode === 'arena'
    ? [[ARENA.totK, 'FRAG'], [ARENA.totD, tx('DEATHS', 'ÖLÜM')], [`+${fmt(xp)}`, 'XP']]
    : [[fmt(game.score), tx('SCORE', 'PUAN')], [game.kills, 'BUG'], [`+${fmt(xp)}`, 'XP']];
  $('#resBox').innerHTML = `
    <h2>${head}</h2><div class="sub">${sub}</div>
    ${recLine ? `<div class="newrec">★ ${recLine} ★</div>` : ''}
    <div class="rgrid">${stats.map(s => `<div class="rg"><div class="v">${s[0]}</div><div class="l">${s[1]}</div></div>`).join('')}</div>
    <div class="coffee">+${fmt(coffee)} ☕</div>
    ${after.L > before.L ? `<div class="lvup">LEVEL UP! ${before.L} → ${after.L}</div>` : ''}
    <div style="text-align:left;margin-top:10px"><div class="lbl">Level ${after.L} · ${esc(titleFor(after.L))}</div><div class="xpbar"><i id="resXp"></i></div><div class="pc-sub">${fmt(after.cur)} / ${fmt(after.need)} XP</div></div>
    ${unlocks.length ? `<div class="unl">${unlocks.map(u => `<div>${u}</div>`).join('')}</div>` : ''}
    <div class="row"><button class="btn big" id="btnAgain">${tx('Play again', 'Tekrar oyna')}</button><button class="btn big ghost" id="btnMenu">${tx('Menu', 'Menü')}</button></div>
    <p class="note" style="margin-top:12px">${tx('Spend your ☕ coffee in the Upgrades tab.', '☕ kahvelerini Geliştirmeler sekmesinde harcayabilirsin.')}</p>`;
  $('#results').classList.remove('hidden');
  requestAnimationFrame(() => { const b = $('#resXp'); if (b) b.style.width = (after.cur / after.need * 100) + '%'; });
  if (after.L > before.L) setTimeout(() => sfx('level'), 300);
  $('#btnAgain').onclick = () => { if (mode === 'arena' && !CAP.room) return showMenu(); requestLock(); startRun(mode); };
  $('#btnMenu').onclick = showMenu;
  clearEnemies();
  setLobbyPresence();
}
function unlockAch(id) {
  if (profile.ach.includes(id)) return;
  const a = ACH.find(x => x.id === id); if (!a) return;
  profile.ach.push(id); profile.coffee += 75; saveLocal(); track('achievement_unlock', { achievement_id: id });
  toast(`🏆 ${tx('Badge', 'Rozet')}: <b>${esc(loc(a.name))}</b> · +75 ☕`);
}
function showMenu() {
  game.state = 'menu'; game.mode = null;
  $('#results').classList.add('hidden'); $('#pause').classList.add('hidden'); $('#hud').classList.add('hidden');
  document.body.classList.remove('playing');
  $('#menu').classList.remove('hidden'); renderMenu(); setLobbyPresence();
}

/* ------------------------------ ARENA (PvP) ------------------------------ */
const ROUND_MS = 300000, PLAY_S = 290; // 5-minute rounds aligned to the clock: 290 s of play + 10 s MVP screen
const STREAKS = [[3, ['KILLING SPREE!', '3\'LÜ SERİ!']], [5, ['UNSTOPPABLE!', 'DURDURULAMAZ!']], [7, ['LEGENDARY!', 'EFSANE!']], [10, ['GODLIKE!', 'TANRISAL!']]];
const streakName = n => { let s = null; for (const [k, v] of STREAKS) if (n >= k) s = loc(v); return s; };
const ARENA = { room: null, myPeer: null, remotes: new Map(), unsubs: [], kills: 0, deaths: 0, totK: 0, totD: 0, mvps: 0, streak: 0, dead: false, respawnT: 0, protT: 0, inter: false, round: -1, shotN: 0, shot: null, lastAttacker: null, lastWeapon: 0, presT: 0, lastPres: '', joining: false };
const ARENA_SPAWNS = [[25, 6], [-25, 6], [25, -6], [-25, -6], [6, 25], [-6, 25], [6, -25], [-6, -25]];
const arenaNow = () => Date.now() + (NET.clockOffset || 0);
function arenaClock() { const now = arenaNow(); return { round: Math.floor(now / ROUND_MS), sec: (now % ROUND_MS) / 1000 }; }
function arenaSpawn() {
  let best = null, bd = -1;
  for (const [x, z] of ARENA_SPAWNS) {
    let md = 99; for (const r of ARENA.remotes.values()) if (r.alive) md = Math.min(md, Math.hypot(r.mesh.position.x - x, r.mesh.position.z - z));
    const sc = md + Math.random() * 6; if (sc > bd) { bd = sc; best = new V3(x, 0, z); }
  }
  return best;
}
async function joinArena() {
  const c = arenaClock();
  Object.assign(ARENA, { kills: 0, deaths: 0, totK: 0, totD: 0, mvps: 0, streak: 0, dead: false, respawnT: 0, protT: 2, inter: false, round: c.round, shot: null, lastAttacker: null, lastPres: '', joining: true });
  const note = $('#netnote'); note.textContent = tx('Connecting to the arena…', 'Arenaya bağlanılıyor…'); note.classList.remove('hidden');
  try { ARENA.room = await CAP.room.join('arena'); }
  catch (e) { ARENA.joining = false; note.textContent = tx('Could not connect to the arena. Try again in a bit.', 'Arenaya bağlanılamadı. Biraz sonra tekrar dene.'); return; }
  ARENA.joining = false;
  if (game.mode !== 'arena' || game.state !== 'playing') { try { ARENA.room.leave(); } catch (e) { } ARENA.room = null; return; }
  const R = ARENA.room;
  ARENA.unsubs.push(R.onPeers(ch => {
    for (const p of ch.peers) { if (p.isMe && p.sameTab) { ARENA.myPeer = p.peer; continue; } if (p.kind !== 'viewer') continue; upsertRemote(p); }
    for (const p of ch.left) removeRemote(p.peer);
    const others = ARENA.remotes.size;
    note.textContent = others ? '' : tx('You\'re alone in the arena for now. Share the link; friends show up here the moment they join.', 'Arenada şimdilik yalnızsın. Linki paylaş; arkadaşların girdikleri an burada belirir.');
    note.classList.toggle('hidden', !!others);
  }, () => { note.textContent = tx('Arena connection lost.', 'Arena bağlantısı koptu.'); note.classList.remove('hidden'); }));
  ARENA.unsubs.push(R.on('hit', m => {
    const d = m.data || {}; if (!ARENA.myPeer || d.to !== ARENA.myPeer || m.sameTab || ARENA.dead || game.state !== 'playing') return;
    const dmg = clamp(Number(d.dmg) || 0, 0, 200); const r = ARENA.remotes.get(m.peer);
    ARENA.lastWeapon = Number(d.w) || 0;
    damagePlayer(dmg, r ? r.mesh.position : null, m.peer);
  }));
  ARENA.unsubs.push(R.on('kill', m => {
    const d = m.data || {}; if (d.victim !== m.peer) return;
    const killer = d.killer, wName = (WEAPONS[Number(d.w)] || WEAPONS[0]).name, vs = Math.max(0, Math.floor(Number(d.vs) || 0));
    addFeed(peerName(killer), peerName(m.peer), wName);
    if (vs >= 3 && killer) addFeedMsg(tx(`${peerName(killer)} ended ${peerName(m.peer)}'s ${vs}-kill streak`, `${peerName(killer)}, ${peerName(m.peer)} adlı oyuncunun ${vs}'li serisini bitirdi`));
    if (killer && killer === ARENA.myPeer && !m.sameTab) {
      ARENA.kills++; ARENA.totK++; ARENA.streak++; game.kills++; game.score += 100 + (vs >= 3 ? 50 : 0);
      hitMarker(true); popup(vs >= 3 ? '+1 FRAG · SHUTDOWN' : '+1 FRAG'); unlockAch('frag'); sfx('level');
      const sn = STREAKS.find(([k]) => k === ARENA.streak);
      if (sn) { banner(loc(sn[1]), tx(`${ARENA.streak} kills without dying`, `Ölmeden ${ARENA.streak} frag`)); sfx('streak'); }
      if (ARENA.streak >= 5) unlockAch('streak5');
    }
  }));
  sendArenaPresence(true);
}
function leaveArena() {
  for (const u of ARENA.unsubs) { try { u(); } catch (e) { } } ARENA.unsubs = [];
  for (const r of ARENA.remotes.values()) scene.remove(r.mesh); ARENA.remotes.clear();
  if (ARENA.room) { try { ARENA.room.leave(); } catch (e) { } } ARENA.room = null; ARENA.myPeer = null;
  $('#respawn').classList.add('hidden'); $('#netnote').classList.add('hidden'); $('#mvp').classList.add('hidden');
}
function peerName(peer) {
  if (!peer) return tx('Someone', 'Biri'); if (peer === ARENA.myPeer) return myName();
  const r = ARENA.remotes.get(peer); return r ? r.name : tx('Someone', 'Biri');
}
const bubbleGeo = new THREE.SphereGeometry(1, 18, 12);
function makeAvatar(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.5, metalness: 0.4 });
  const acc = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 1.0, 12), mat); body.position.y = 0.95; body.castShadow = true; g.add(body);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.1, 12), acc); belt.position.y = 0.6; g.add(belt);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.5, 10), mat); legs.position.y = 0.25; g.add(legs);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat); head.position.y = 1.62; head.castShadow = true; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.12), acc); visor.position.set(0, 1.65, -0.22); g.add(visor);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), acc); gun.position.set(0.32, 1.15, -0.35); g.add(gun);
  const bubble = new THREE.Mesh(bubbleGeo, new THREE.MeshBasicMaterial({ color: 0x36e2ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  bubble.scale.set(0.8, 1.1, 0.8); bubble.position.y = 1.0; bubble.visible = false; g.add(bubble);
  g.userData.acc = acc; g.userData.bubble = bubble;
  return g;
}
function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = '600 30px "Chakra Petch", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(7,11,20,.7)'; const w = Math.min(250, x.measureText(text).width + 24); x.fillRect(128 - w / 2, 10, w, 44);
  x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); s.position.y = 2.25; s.renderOrder = 20; return s;
}
function tintOf(i) { const t = TINTS[clamp(Math.floor(Number(i) || 0), 0, TINTS.length - 1)]; return t.c < 0 ? 0xff3d81 : t.c; }
function refreshRemoteName(r) {
  const nm = dispName(r.by, r.nick);
  if (nm === r.name && r.label) return; r.name = nm;
  if (r.label) { r.mesh.remove(r.label); r.label.material.map.dispose(); r.label.material.dispose(); }
  r.label = labelSprite(nm, tintOf(r.c)); r.mesh.add(r.label);
}
function upsertRemote(p) {
  const pr = p.presence || {};
  let r = ARENA.remotes.get(p.peer);
  if (!r) {
    r = { peer: p.peer, by: p.by || (typeof pr.u === 'string' ? pr.u : null), mesh: null, target: new V3(), yaw: 0, alive: false, prot: false, sh: false, k: 0, d: 0, ks: 0, hp: 100, c: pr.c, nick: '', name: '', lastShot: null, seen: false };
    r.mesh = makeAvatar(tintOf(pr.c)); r.mesh.visible = false; scene.add(r.mesh);
    ARENA.remotes.set(p.peer, r); if (r.by) resolveNames([r.by]);
  }
  r.nick = typeof pr.n === 'string' ? pr.n.slice(0, 16) : '';
  if (pr.c !== r.c) { r.c = pr.c; r.mesh.userData.acc.color.set(tintOf(pr.c)); r.mesh.userData.acc.emissive.set(tintOf(pr.c)); r.label && (r.name = null); }
  refreshRemoteName(r);
  if (Array.isArray(pr.p) && pr.p.length === 3 && pr.p.every(Number.isFinite)) {
    r.target.set(clamp(pr.p[0], -A, A), clamp(pr.p[1], 0, 10), clamp(pr.p[2], -A, A));
    if (!r.seen) { r.mesh.position.copy(r.target); r.seen = true; }
  }
  if (Array.isArray(pr.r) && Number.isFinite(pr.r[0])) r.yaw = pr.r[0];
  r.k = Math.max(0, Math.floor(Number(pr.k) || 0)); r.d = Math.max(0, Math.floor(Number(pr.d) || 0)); r.hp = clamp(Number(pr.h) || 0, 0, 999);
  const ks = Math.max(0, Math.floor(Number(pr.ks) || 0));
  if (ks > r.ks) { const sn = STREAKS.find(([k]) => k === ks); if (sn && r.seen) addFeedMsg(`${r.name} — ${loc(sn[1])}`); }
  r.ks = ks;
  r.alive = r.seen && !pr.x && r.hp > 0;
  r.prot = !!pr.pr; r.sh = !!pr.sh;
  r.mesh.visible = r.alive;
  const bub = r.mesh.userData.bubble; bub.visible = r.alive && (r.prot || r.sh); bub.material.color.set(r.sh ? 0x36e2ff : 0xffffff);
  if (Array.isArray(pr.s) && pr.s.length === 4 && pr.s.every(Number.isFinite)) {
    if (r.lastShot !== null && pr.s[0] !== r.lastShot && r.alive) {
      const from = r.mesh.position.clone().add(new V3(0, 1.2, 0)); const to = new V3(pr.s[1], pr.s[2], pr.s[3]);
      beam(from, to, tintOf(r.c), 0.02, 0.08);
      const dd = from.distanceTo(P.pos); if (dd < 30 && actx) noise(0.06, 0.25 * (1 - dd / 30), 'bandpass', 1500, 0.8);
    }
    r.lastShot = pr.s[0];
  }
}
function removeRemote(peer) { const r = ARENA.remotes.get(peer); if (!r) return; scene.remove(r.mesh); ARENA.remotes.delete(peer); }
function hitRemote(r, dmg) {
  if (!ARENA.room || !targetable(r)) return;
  ARENA.room.emit('hit', { to: r.peer, dmg: Math.round(dmg), w: WEAPONS.findIndex(w => w.id === curW) }).catch(() => { });
  burst(r.mesh.position.clone().setY(r.mesh.position.y + 1.1), r.sh ? 0x36e2ff : tintOf(r.c), 6, 3, 0.3);
}
function arenaDie() {
  const vs = ARENA.streak;
  ARENA.dead = true; ARENA.deaths++; ARENA.totD++; ARENA.streak = 0; ARENA.respawnT = 3; GR.active = false;
  burst(P.pos.clone().setY(P.pos.y + 1), tintColor(), 40, 7, 0.8);
  const killer = ARENA.lastAttacker;
  if (ARENA.room && ARENA.myPeer) ARENA.room.emit('kill', { killer: killer || null, victim: ARENA.myPeer, w: ARENA.lastWeapon || 0, vs }).catch(() => { });
  $('#respawnS').textContent = tx(`${peerName(killer)} got you · respawning…`, `${peerName(killer)} seni vurdu · yeniden doğuyorsun…`);
  $('#respawn').classList.remove('hidden'); sendArenaPresence(true);
}
function arenaRespawn() {
  ARENA.dead = false; P.hp = P.maxHp; P.pos.copy(arenaSpawn()); P.vel.set(0, 0, 0); P.dashV.set(0, 0, 0); P.yaw = Math.atan2(P.pos.x, P.pos.z);
  ARENA.lastAttacker = null; ARENA.protT = 2; shieldT = 0; GR.active = false;
  $('#respawn').classList.add('hidden'); resetWeapons(); sendArenaPresence(true);
}
function arenaStandings() {
  const rows = [{ name: myName(), k: ARENA.kills, d: ARENA.deaths, me: true }, ...[...ARENA.remotes.values()].filter(r => r.seen).map(r => ({ name: r.name, k: r.k, d: r.d }))];
  return rows.sort((a, b) => b.k - a.k || a.d - b.d);
}
function showMvp() {
  const rows = arenaStandings(), top = rows[0];
  const hasWinner = top && top.k > 0;
  if (hasWinner && top.me && (rows.length < 2 || rows[1].k < top.k || rows[1].d > top.d)) {
    ARENA.mvps++; unlockAch('mvp'); sfx('level'); track('arena_mvp', { kills: top.k });
  }
  $('#mvp').innerHTML = `<div class="crown">👑</div><div class="lbl">${tx('ROUND OVER · MVP', 'MAÇ BİTTİ · MVP')}</div>
    <div class="who">${hasWinner ? esc(top.name) : '—'}</div>
    <table>${rows.slice(0, 5).map((r, i) => `<tr style="${r.me ? 'color:var(--cyan)' : ''}"><td>${i + 1}. ${esc(r.name)}</td><td class="n">${r.k} / ${r.d}</td></tr>`).join('')}</table>
    <div class="next" id="mvpNext"></div>`;
  $('#mvp').classList.remove('hidden');
}
function updateArena(dt) {
  const c = arenaClock();
  if (c.round !== ARENA.round) {
    // new round: reset per-round stats and respawn everyone at their own clock edge
    ARENA.round = c.round; ARENA.inter = false; ARENA.kills = 0; ARENA.deaths = 0; ARENA.streak = 0;
    $('#mvp').classList.add('hidden'); arenaRespawn();
    banner(tx('NEW ROUND', 'YENİ MAÇ'), tx('5 minutes · most frags wins MVP', '5 dakika · en çok frag yapan MVP'));
  } else if (!ARENA.inter && c.sec >= PLAY_S) {
    ARENA.inter = true; firing = false; GR.active = false; showMvp();
  }
  if (ARENA.inter) { const el = $('#mvpNext'); if (el) el.textContent = tx(`Next round in ${Math.ceil(300 - c.sec)} s`, `Yeni maç ${Math.ceil(300 - c.sec)} sn sonra`); }
  ARENA.protT = Math.max(0, ARENA.protT - dt);
  if (ARENA.dead && !ARENA.inter) {
    ARENA.respawnT -= dt; $('#respawnS').textContent = tx(`${peerName(ARENA.lastAttacker)} got you · ${Math.ceil(ARENA.respawnT)} s`, `${peerName(ARENA.lastAttacker)} seni vurdu · ${Math.ceil(ARENA.respawnT)} sn`);
    if (ARENA.respawnT <= 0) arenaRespawn();
  }
  for (const r of ARENA.remotes.values()) {
    if (!r.seen) continue;
    r.mesh.position.lerp(r.target, Math.min(1, dt * 14));
    let dy = r.yaw - r.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.mesh.rotation.y += dy * Math.min(1, dt * 14);
  }
  ARENA.presT -= dt; if (ARENA.presT <= 0) { ARENA.presT = 1 / 12; sendArenaPresence(false); }
}
function sendArenaPresence(force) {
  if (!ARENA.room) return;
  const pr = {
    u: CAP.uid || null, n: profile.nick || '', c: profile.tint, p: [r2(P.pos.x), r2(P.pos.y), r2(P.pos.z)], r: [Math.round(P.yaw * 1000) / 1000, Math.round(P.pitch * 1000) / 1000],
    h: Math.ceil(P.hp), w: WEAPONS.findIndex(w => w.id === curW), k: ARENA.kills, d: ARENA.deaths, ks: ARENA.streak, x: ARENA.dead ? 1 : 0,
    pr: ARENA.protT > 0 || ARENA.inter ? 1 : 0, sh: shieldT > 0 ? 1 : 0, s: ARENA.shot,
  };
  const key = JSON.stringify(pr); if (!force && key === ARENA.lastPres) return; ARENA.lastPres = key;
  ARENA.room.presence(pr).catch(() => { });
}
function renderScoreboard() {
  const rows = arenaStandings(), c = arenaClock();
  $('#scoreboard').innerHTML = `<div class="lbl" style="margin-bottom:8px">${modeName('arena')} · ${tx(`${rows.length} players`, `${rows.length} oyuncu`)} · ${fmtClock(Math.max(0, PLAY_S - c.sec))}</div><table><tr><th>${tx('PLAYER', 'OYUNCU')}</th><th>FRAG</th><th>${tx('DEATHS', 'ÖLÜM')}</th></tr>${rows.map(r => `<tr style="${r.me ? 'color:var(--cyan)' : ''}"><td>${esc(r.name)}${r.me ? ` (${tx('you', 'sen')})` : ''}</td><td class="n">${r.k}</td><td class="n">${r.d}</td></tr>`).join('')}</table>`;
}

/* ------------------------------ HUD ------------------------------ */
const fmtClock = s => { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function banner(t, s) {
  $('#bannerT').textContent = t; $('#bannerS').textContent = s || '';
  const b = $('#banner'); b.classList.add('on'); clearTimeout(banner.to); banner.to = setTimeout(() => b.classList.remove('on'), 2200);
}
function popup(txt) {
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = txt; el.style.left = (24 + rand(-6, 10)) + 'px';
  const box = $('#popups'); if (box.children.length > 6) box.firstChild.remove(); box.appendChild(el); setTimeout(() => el.remove(), 820);
}
function toast(html) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3300);
}
function pushFeed(el) { const f = $('#feed'); f.appendChild(el); if (f.children.length > 6) f.firstChild.remove(); setTimeout(() => el.remove(), 5000); }
function addFeed(a, b, w) {
  const el = document.createElement('div'); el.className = 'fe';
  el.innerHTML = `<b></b> <span style="color:var(--muted)">[${esc(w)}]</span> <em></em>`;
  el.querySelector('b').textContent = a; el.querySelector('em').textContent = b; pushFeed(el);
}
function addFeedMsg(text) { const el = document.createElement('div'); el.className = 'fe sys'; el.textContent = text; pushFeed(el); }
function buildAbilityHUD() {
  const list = ABILITIES.filter(a => a.cd && has(a.id) && !(pvp() && a.id === 'breakpoint'));
  $('#abil').innerHTML = list.map(a => `<div class="ab" data-id="${a.id}">${a.icon}<div class="cd"></div><div class="k">${a.key === 'Shift' ? '⇧' : esc(loc(a.key))}</div></div>`).join('');
}
function updateHUDWeapons() {
  $('#wslots').innerHTML = WEAPONS.map((w, i) => `<div class="ws ${w.id === curW ? 'on' : ''} ${has(w.id) ? '' : 'lock'}">${i + 1}</div>`).join('');
  $('#wname').textContent = W(curW).name;
}
let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; document.getElementById(id).textContent = v; } }
function updateHUD() {
  setText('hpnum', Math.ceil(P.hp));
  $('#hpfill').style.width = (P.hp / P.maxHp * 100) + '%';
  $('#lowhp').style.opacity = P.hp / P.maxHp < 0.3 ? 1 : 0;
  $('#shieldfx').style.opacity = shieldT > 0 ? 1 : 0;
  $('#protfx').style.opacity = pvp() && ARENA.protT > 0 && !ARENA.dead ? 1 : 0;
  const s = ws[curW], w = W(curW);
  const ammo = s.rel > 0 ? 'R…' : String(s.mag);
  if (hudCache.ammo !== ammo + magOf(w)) { hudCache.ammo = ammo + magOf(w); $('#ammo').innerHTML = `${ammo}<small> / ${magOf(w)}</small>`; }
  if (game.mode === 'arena') {
    const c = arenaClock();
    setText('statA', ARENA.inter ? 'MVP' : fmtClock(Math.max(0, PLAY_S - c.sec)));
    setText('statScore', String(ARENA.kills)); setText('combo', String(ARENA.deaths));
  } else {
    setText('statScore', fmt(game.score));
    if (game.mode === 'sprint') setText('statA', fmtClock(game.timeLeft)); else setText('statA', String(game.wave));
    setText('combo', game.combo > 0 ? 'x' + (1 + Math.min(game.combo, 20) * 0.1).toFixed(1) : 'x1.0');
  }
  document.querySelectorAll('#abil .ab').forEach(el => {
    const id = el.dataset.id, a = ABILITIES.find(x => x.id === id), cdv = cds[id] || 0, max = a.cd * cdMult();
    el.querySelector('.cd').style.setProperty('--p', (cdv > 0 ? cdv / max * 100 : 0) + '%'); el.classList.toggle('ready', cdv <= 0);
  });
  hurtFlash = Math.max(0, hurtFlash - 0.05);
  $('#vignette').style.boxShadow = `inset 0 0 160px 40px rgba(255,30,60,${(hurtFlash * 0.55).toFixed(2)})`;
  document.documentElement.style.setProperty('--xh', overT > 0 ? '#ffd23f' : breakT > 0 ? '#36e2ff' : '#fff');
}

/* ------------------------------ INPUT ------------------------------ */
function requestLock() {
  if (lockFallback) return;
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => setFallback());
  } catch (e) { setFallback(); }
}
function setFallback() {
  if (lockFallback) return; lockFallback = true;
  toast(tx('Mouse lock is blocked in this view. Open the game in its own tab for full control; for now move the mouse or use <b>← →</b> to turn.', 'Fare kilidi bu görünümde engellendi. Oyunu kendi sekmesinde açarsan tam kontrol gelir; şimdilik fareyi hareket ettirerek ya da <b>← →</b> ile dönebilirsin.'));
}
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && game.state === 'playing' && !lockFallback) pauseGame();
});
document.addEventListener('pointerlockerror', setFallback);
function pauseGame() {
  if (game.state !== 'playing') return;
  firing = false;
  if (game.mode !== 'arena') game.paused = true;
  $('#pauseSub').textContent = game.mode === 'arena' ? tx('The arena keeps going. Careful, you can still be shot.', 'Arena devam ediyor. Dikkat, hâlâ vurulabilirsin.') : tx('You hit a breakpoint.', 'Breakpoint\'e takıldın.');
  $('#pauseNote').textContent = tx('Tip: Esc releases the mouse. Click to continue.', 'İpucu: Esc fareyi bırakır. Devam etmek için tıkla.');
  $('#pause').classList.remove('hidden');
}
function resumeGame() { $('#pause').classList.add('hidden'); game.paused = false; requestLock(); }
$('#btnResume').onclick = resumeGame;
$('#btnQuit').onclick = () => { $('#pause').classList.add('hidden'); endRun(game.mode === 'arena' ? 'arena' : 'quit'); };
canvas.addEventListener('mousedown', e => {
  if (game.state !== 'playing') return;
  if (!pointerLocked && !lockFallback) { requestLock(); return; }
  if (e.button === 0) { firing = true; fire(); }
  if (e.button === 2) throwGrenade();
});
window.addEventListener('mouseup', e => { if (e.button === 0) firing = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => {
  if (game.state !== 'playing' || game.paused) return;
  if (!pointerLocked && !lockFallback) return;
  const s = 0.0022 * settings.sens;
  P.yaw -= (e.movementX || 0) * s; P.pitch = clamp(P.pitch - (e.movementY || 0) * s, -1.5, 1.5);
});
window.addEventListener('wheel', e => { if (game.state === 'playing' && !game.paused) cycleW(e.deltaY > 0 ? 1 : -1); }, { passive: true });
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT')) return;
  keys[e.code] = true;
  if (game.state !== 'playing') return;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (game.paused) return;
  switch (e.code) {
    case 'Space': if (!e.repeat) jump(); break;
    case 'ShiftLeft': case 'ShiftRight': dash(); break;
    case 'KeyR': reload(); break;
    case 'KeyG': throwGrenade(); break;
    case 'KeyQ': useBreakpoint(); break;
    case 'KeyE': if (!e.repeat) useGrapple(); break;
    case 'KeyF': useShield(); break;
    case 'KeyV': useBlink(); break;
    case 'KeyP': if (lockFallback) pauseGame(); else document.exitPointerLock(); break;
    case 'Tab': if (pvp()) { renderScoreboard(); $('#scoreboard').classList.remove('hidden'); } break;
    default: { const m = e.code.match(/^Digit([1-9])$/); if (m && WEAPONS[+m[1] - 1]) switchW(WEAPONS[+m[1] - 1].id); }
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') $('#scoreboard').classList.add('hidden'); });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing' && game.mode !== 'arena') pauseGame(); });
window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = vmCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
});

/* ------------------------------ MENU ------------------------------ */
let curTab = 'play', lbTab = 'sprint';
document.querySelectorAll('#tabs .tab').forEach(b => b.onclick = () => { curTab = b.dataset.tab; if (curTab === 'lb') fetchScores(); document.querySelectorAll('#tabs .tab').forEach(x => x.classList.toggle('on', x === b)); renderMenu(); });
document.querySelectorAll('.langsw button').forEach(b => b.onclick = () => setLang(b.dataset.lang));
function avatarColor() { const t = TINTS[profile.tint] || TINTS[0]; return t.c < 0 ? 'linear-gradient(135deg,#ff3d81,#ffd23f,#36e2ff)' : '#' + new THREE.Color(t.c).getHexString(); }
function renderProfileCard() {
  const li = levelInfo(profile.xpTotal), nm = myName();
  $('#pcard').innerHTML = `
    <div class="av" style="background:${avatarColor()}">${esc((nm[0] || '?').toUpperCase())}</div>
    <div class="pc-mid"><div class="pc-name">${esc(nm)}</div><div class="pc-title">${esc(titleFor(li.L))}</div>
      <div class="xpbar"><i style="width:${li.cur / li.need * 100}%"></i></div><div class="pc-sub">${fmt(li.cur)} / ${fmt(li.need)} XP</div></div>
    <div class="lvl">${li.L}<small>LEVEL</small></div>
    <div class="coffee">${fmt(profile.coffee)} ☕</div>`;
}
const pill = l => `<span class="pill">Lv ${l}</span>`;
function renderMenu() {
  renderProfileCard(); renderOnline();
  const B = $('#tabBody'), L = lvlNow();
  if (curTab === 'play') {
    const inArena = lobbyPeers.filter(p => p.presence && p.presence.st === 'arena' && !(p.isMe && p.sameTab)).length;
    const nickPanel = NET.server ? `<div class="panel" style="margin-bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span style="font-weight:600">${tx('Your nickname', 'Takma adın')}</span><input id="qNick" maxlength="16" value="${esc(profile.nick)}" style="background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:8px;color:var(--text);padding:8px 12px;font-family:var(--head);font-size:14px;user-select:text;width:200px"><span class="note">${tx('Shown on the leaderboard and in the arena.', 'Liderlik tablosunda ve arenada bu görünür.')}</span></div>` : '';
    B.innerHTML = `${nickPanel}<div class="panel"><h3>${tx('Choose a mode', 'Mod seç')}</h3><div class="modes">
      <button class="mode" data-mode="sprint"><div class="ic">⏱</div><div class="nm">Sprint</div><div class="ds">${tx('3 minutes. Bugs keep speeding up and a Prod Incident erupts halfway. Score as much as you can.', '3 dakika. Buglar giderek hızlanır, ortada bir Prod Incident patlar. En yüksek puanı yap.')}</div><div class="bs">${tx('Best', 'Rekor')}: ${fmt(profile.best.sprint)}</div></button>
      <button class="mode" data-mode="survival"><div class="ic">🌊</div><div class="nm">${modeName('survival')}</div><div class="ds">${tx('Endless waves with a boss every 5th wave. New bug types show up as you go deeper.', 'Sonsuz dalga, her 5. dalgada boss. İlerledikçe yeni bug türleri çıkar.')}</div><div class="bs">${tx('Best', 'Rekor')}: ${profile.best.wave ? tx(`wave ${profile.best.wave}`, `${profile.best.wave}. dalga`) : '—'}</div></button>
      <button class="mode pvp" data-mode="arena" ${CAP.room ? '' : 'disabled'}><div class="ic">⚔</div><div class="nm">${modeName('arena')}</div><div class="ds">${CAP.room ? tx('Real-time free-for-all with friends. 5-minute rounds with an MVP at the end. Upgrades are off; XP still counts.', 'Arkadaşlarınla gerçek zamanlı herkes herkese karşı. 5 dakikalık maçlar, sonunda MVP. Geliştirmeler kapalı; XP yine sayılır.') : tx('The live arena is unavailable: could not reach the game server.', 'Canlı arena şu an kapalı: oyun sunucusuna bağlanılamadı.')}</div><div class="bs">${CAP.room ? `<span class="live">${inArena ? tx(`${inArena} IN THE ARENA`, `${inArena} KİŞİ ARENADA`) : tx('LIVE', 'CANLI')}</span>` : ''}</div></button>
    </div>
    <div class="keys">
      <div><kbd>W A S D</kbd> ${tx('move', 'hareket')}</div><div><kbd>${tx('Mouse', 'Fare')}</kbd> ${tx('aim', 'nişan')} · <kbd>${tx('Left click', 'Sol tık')}</kbd> ${tx('fire', 'ateş')}</div><div><kbd>Space</kbd> ${tx('jump', 'zıpla')}</div><div><kbd>R</kbd> ${tx('reload', 'şarjör')}</div>
      <div><kbd>1-${WEAPONS.length}</kbd> / <kbd>${tx('Wheel', 'Tekerlek')}</kbd> ${tx('weapon', 'silah')}</div><div><kbd>Shift</kbd> dash ${L < 2 ? pill(2) : ''}</div>
      <div><kbd>E</kbd> ${tx('grapple', 'kanca')} ${L < 5 ? pill(5) : ''}</div><div><kbd>G</kbd> / <kbd>${tx('Right click', 'Sağ tık')}</kbd> ${tx('grenade', 'bomba')} ${L < 6 ? pill(6) : ''}</div>
      <div><kbd>F</kbd> ${tx('shield', 'kalkan')} ${L < 8 ? pill(8) : ''}</div><div><kbd>Q</kbd> breakpoint ${L < 9 ? pill(9) : ''}</div><div><kbd>V</kbd> ${tx('blink', 'ışınlanma')} ${L < 12 ? pill(12) : ''}</div>
      <div><kbd>Tab</kbd> ${tx('arena scoreboard', 'arena skor tablosu')}</div><div><kbd>Esc</kbd> ${tx('pause', 'duraklat')}</div>
    </div></div>
    <div class="panel" style="margin-top:16px"><h3>${tx('Badges', 'Rozetler')} · ${profile.ach.length}/${ACH.length}</h3><div class="badges">${ACH.map(a => `<div class="badge ${profile.ach.includes(a.id) ? 'on' : ''}"><b>${esc(loc(a.name))}</b>${esc(loc(a.desc))}</div>`).join('')}</div></div>`;
    B.querySelectorAll('.mode').forEach(b => b.onclick = () => { if (b.disabled) return; requestLock(); startRun(b.dataset.mode); });
    const q = $('#qNick'); if (q) q.onchange = () => { const v = cleanNick(q.value); if (v) profile.nick = v; q.value = profile.nick; saveAll(); renderProfileCard(); setLobbyPresence(); };
  } else if (curTab === 'arsenal') {
    B.innerHTML = `<div class="panel"><h3>${tx('Weapons', 'Silahlar')}</h3><div class="grid">${WEAPONS.map((w, i) => `
      <div class="card ${L >= w.lvl ? '' : 'lock'}"><div class="h"><span class="n">${w.icon} ${esc(w.name)}</span><span class="pill ${L >= w.lvl ? 'ok' : ''}">${L >= w.lvl ? tx('Key ', 'Tuş ') + (i + 1) : 'Lv ' + w.lvl}</span></div>
      <div class="d">${esc(loc(w.desc))}</div><div class="s">${w.pellets > 1 ? w.pellets + '×' : ''}${w.dmg} ${tx('dmg', 'hasar')} · ${w.rate}/${tx('s', 'sn')} · ${w.mag} ${tx('rounds', 'mermi')}${w.bounces ? ' · ' + tx(`${w.bounces} bounces`, `${w.bounces} sekme`) : ''}</div></div>`).join('')}</div></div>
    <div class="panel" style="margin-top:16px"><h3>${tx('Abilities', 'Yetenekler')}</h3><div class="grid">${ABILITIES.map(a => `
      <div class="card ${L >= a.lvl ? '' : 'lock'}"><div class="h"><span class="n">${a.icon} ${esc(loc(a.name))}</span><span class="pill ${L >= a.lvl ? 'ok' : ''}">${L >= a.lvl ? esc(loc(a.key)) : 'Lv ' + a.lvl}</span></div><div class="d">${esc(loc(a.desc))}</div></div>`).join('')}</div></div>
    <div class="panel" style="margin-top:16px"><h3>${tx('Weapon color', 'Silah rengi')}</h3><div class="tints">${TINTS.map((t, i) => `
      <button class="tint ${profile.tint === i ? 'on' : ''}" data-i="${i}" ${L >= t.lvl ? '' : 'disabled'}><div class="sw" style="background:${t.c < 0 ? 'linear-gradient(135deg,#ff3d81,#ffd23f,#36e2ff,#7cff4f)' : '#' + new THREE.Color(t.c).getHexString()}"></div>${esc(loc(t.name))}${L >= t.lvl ? '' : '<br>Lv ' + t.lvl}</button>`).join('')}</div></div>
    <div class="panel" style="margin-top:16px"><h3>${tx('Career path', 'Kariyer yolu')}</h3><div class="road">${TITLES.map(([l, n], i) => { const nx = TITLES[i + 1]; const cur = L >= l && (!nx || L < nx[0]); return `<span class="${cur ? 'cur' : L >= l ? 'on' : ''}">Lv ${l} · ${esc(loc(n))}</span>`; }).join('')}</div></div>`;
    B.querySelectorAll('.tint').forEach(b => b.onclick = () => { profile.tint = +b.dataset.i; saveAll(); renderMenu(); setLobbyPresence(); });
  } else if (curTab === 'shop') {
    B.innerHTML = `<div class="panel"><h3>${tx('Permanent upgrades', 'Kalıcı geliştirmeler')} · ${fmt(profile.coffee)} ☕</h3><div class="grid">${UPGRADES.map(u => {
      const l = upLv(u.id), c = upCost(u, l), maxed = l >= u.max;
      return `<div class="card"><div class="h"><span class="n">${u.icon} ${esc(loc(u.name))}</span><span class="pill">${l}/${u.max}</span></div>
        <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>
        <div class="d">${l ? tx('Now: ', 'Şu an: ') + esc(u.desc(l)) : tx('Not bought yet', 'Henüz alınmadı')}${maxed ? '' : '<br>' + tx('Next: ', 'Sonraki: ') + esc(u.desc(l + 1))}</div>
        <button class="btn" data-u="${u.id}" ${maxed || profile.coffee < c ? 'disabled' : ''}>${maxed ? 'MAX' : fmt(c) + ' ☕'}</button></div>`;
    }).join('')}</div>
    <p class="note" style="margin-top:12px">${tx('You earn ☕ every run based on your score. Badges give +75 ☕. Upgrades are disabled in the Live Arena.', '☕ her turda puanına göre kazanılır. Rozetler +75 ☕ verir. Canlı Arena\'da geliştirmeler devre dışıdır.')}</p></div>`;
    B.querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
      const u = UPGRADES.find(x => x.id === b.dataset.u), l = upLv(u.id), c = upCost(u, l);
      if (l >= u.max || profile.coffee < c) return; profile.coffee -= c; profile.up[u.id] = l + 1; ensureAudio(); sfx('buy'); track('upgrade_buy', { upgrade: u.id, upgrade_level: l + 1 }); saveAll(); renderMenu();
    });
  } else if (curTab === 'lb') renderLB();
  else if (curTab === 'settings') {
    B.innerHTML = `<div class="panel"><h3>${tx('Settings', 'Ayarlar')}</h3>
      <div class="set"><span>${tx('Language', 'Dil')}</span><div class="langsw" style="grid-column:2 / 4"><button data-lang="en" class="${LANG === 'en' ? 'on' : ''}">English</button><button data-lang="tr" class="${LANG === 'tr' ? 'on' : ''}">Türkçe</button></div></div>
      <div class="set"><label for="sNick">${tx('Player name', 'Oyuncu adı')}</label><input type="text" id="sNick" maxlength="16" placeholder="${esc(CAP.myName || tx('Optional nickname', 'İsteğe bağlı takma ad'))}" value="${esc(profile.nick)}"></div>
      <div class="set"><label for="sSens">${tx('Mouse sensitivity', 'Fare hassasiyeti')}</label><input type="range" id="sSens" min="0.2" max="3" step="0.05" value="${settings.sens}"><output>${(+settings.sens).toFixed(2)}</output></div>
      <div class="set"><label for="sFov">${tx('Field of view (FOV)', 'Görüş açısı (FOV)')}</label><input type="range" id="sFov" min="65" max="105" step="1" value="${settings.fov}"><output>${settings.fov}</output></div>
      <div class="set"><label for="sVol">${tx('Volume', 'Ses')}</label><input type="range" id="sVol" min="0" max="1" step="0.05" value="${settings.vol}"><output>${Math.round(settings.vol * 100)}%</output></div>
      <p class="note">${NET.server ? tx('Your progress is saved in this browser; your records go to the shared leaderboard.', 'İlerlemen bu tarayıcıda saklanıyor; rekorların ortak liderlik tablosuna gönderiliyor.') : CAP.db && CAP.uid ? tx('Your progress is saved to your account; pick up where you left off on any device.', 'İlerlemen hesabına kaydediliyor; başka cihazdan açınca kaldığın yerden devam edersin.') : tx('Your progress is saved in this browser.', 'İlerlemen bu tarayıcıda saklanıyor.')}</p></div>`;
    B.querySelectorAll('.langsw button').forEach(b => b.onclick = () => setLang(b.dataset.lang));
    const nick = $('#sNick'); nick.onchange = () => { const v = cleanNick(nick.value); if (v || !NET.server) profile.nick = v; nick.value = profile.nick; saveAll(); renderProfileCard(); setLobbyPresence(); };
    const bind = (id, key, f) => { const el = $('#' + id); el.oninput = () => { settings[key] = +el.value; el.nextElementSibling.textContent = f(settings[key]); saveSettings(); applySettings(); }; };
    bind('sSens', 'sens', v => v.toFixed(2)); bind('sFov', 'fov', v => v); bind('sVol', 'vol', v => Math.round(v * 100) + '%');
  }
}
function applySettings() { camera.fov = settings.fov; camera.updateProjectionMatrix(); if (master) master.gain.value = settings.vol; }
function renderLBIfOpen() { if (game.state === 'menu' && curTab === 'lb') renderLB(); }
function renderLB() {
  const B = $('#tabBody');
  const cols = {
    sprint: [tx('Sprint best', 'Sprint rekoru'), s => s.sprint || 0, v => fmt(v)],
    wave: [tx('Highest wave', 'En yüksek dalga'), s => s.wave || 0, v => v ? tx(`wave ${v}`, `${v}. dalga`) : '—'],
    level: ['Level', s => s.xp || 0, (v, s) => 'Lv ' + (s.level || 1)],
    pvp: [tx('Arena frags', 'Arena fragı'), s => s.pvp || 0, v => fmt(v)],
  };
  const [label, get, show] = cols[lbTab];
  let rows = [], msg = '';
  if ((!CAP.db && !NET.server) || !CAP.uid) { msg = tx('The shared leaderboard needs the game server. Only your own records in this browser are shown.', 'Ortak liderlik tablosu oyun sunucusuyla çalışır. Burada sadece bu tarayıcıdaki rekorların görünüyor.'); rows = [{ id: 'me', nick: profile.nick, sprint: profile.best.sprint, wave: profile.best.wave, level: lvlNow(), xp: profile.xpTotal, pvp: profile.pvpKills }]; }
  else {
    rows = scoresList.filter(s => s && typeof s === 'object');
    if (lbState === 'loading') msg = tx('Loading the leaderboard…', 'Liderlik tablosu yükleniyor…');
    if (lbState === 'slow') msg = tx('Can\'t reach the leaderboard right now; what you see may be out of date.', 'Liderlik tablosuna şu an ulaşılamıyor; gösterilenler eski olabilir.');
    if (lbState === 'error') msg = NET.server ? tx('Can\'t reach the leaderboard server right now.', 'Liderlik tablosu sunucusuna şu an ulaşılamıyor.') : tx('The leaderboard could not be loaded.', 'Liderlik tablosu yüklenemedi.');
    if (NET.err) msg = tx('Your last score could not be sent; it will be retried after your next run.', 'Son skorun sunucuya gönderilemedi; bir sonraki turda tekrar denenecek.');
    if (lbWriteOff) msg = tx('Your score could not be saved: this link seems to be view-only. Ask whoever shared it for at least "Contributor" access.', 'Skorun tabloya yazılamadı: bu linkte yalnızca görüntüleme yetkin var gibi görünüyor. Linki paylaşan kişiden en az "Contributor" yetkisi iste.');
  }
  rows = rows.map(s => ({ ...s, _v: Number(get(s)) || 0 })).filter(s => s._v > 0 || s.id === CAP.uid || s.id === 'me').sort((a, b) => b._v - a._v).slice(0, 50);
  B.innerHTML = `<div class="panel"><h3>${tx('Leaderboard', 'Liderlik tablosu')}</h3>
    <div class="lbtabs">${Object.entries(cols).map(([k, c]) => `<button data-k="${k}" class="${k === lbTab ? 'on' : ''}">${c[0]}</button>`).join('')}</div>
    ${msg ? `<p class="note">${esc(msg)}</p>` : ''}
    ${rows.length ? `<table class="lb"><tr><th>#</th><th>${tx('PLAYER', 'OYUNCU')}</th><th style="text-align:right">${esc(label.toLocaleUpperCase(LANG))}</th></tr>
    ${rows.map((s, i) => {
      const me = s.id === CAP.uid || s.id === 'me'; const nm = me ? myName() : dispName(s.id, s.nick); const lv = clamp(Math.floor(Number(s.level) || 1), 1, 99);
      return `<tr class="${me ? 'me' : ''}"><td class="r">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td><td>${esc(nm)}${me ? ` <span class="pill">${tx('you', 'sen')}</span>` : ''}<div class="ttl">Lv ${lv} · ${esc(titleFor(lv))}</div></td><td class="v">${esc(show(s._v, s))}</td></tr>`;
    }).join('')}</table>`
      : `<p class="note">${tx('No scores yet. Be the first!', 'Henüz kimse skor yapmadı. İlk sen ol!')}</p>`}</div>`;
  B.querySelectorAll('.lbtabs button').forEach(b => b.onclick = () => { lbTab = b.dataset.k; renderLB(); });
}
function renderOnline() {
  const box = $('#online'); if (!box) return;
  if (!CAP.room) { $('#onlineH').textContent = tx('Online', 'Çevrimiçi'); box.innerHTML = `<p class="note">${tx('Who\'s playing shows up here when the game server is reachable.', 'Kimlerin oynadığı, oyun sunucusuna bağlanınca burada görünür.')}</p>`; return; }
  const seen = new Set(), list = [];
  for (const p of lobbyPeers) {
    if (p.kind !== 'viewer') continue; const pr = p.presence || {}; const key = p.by || pr.u || p.peer;
    if (seen.has(key)) continue; seen.add(key); list.push(p);
  }
  $('#onlineH').textContent = `${tx('Online', 'Çevrimiçi')} · ${list.length}`;
  const stText = pr => ({ sprint: tx(`Playing Sprint · ${fmt(pr.sc || 0)}`, `Sprint oynuyor · ${fmt(pr.sc || 0)}`), survival: tx(`Survival · wave ${pr.wv || 1}`, `Hayatta Kal · ${pr.wv || 1}. dalga`), arena: tx('In the Live Arena ⚔', 'Canlı Arena\'da ⚔') }[pr.st] || tx('In the menu', 'Menüde'));
  box.innerHTML = list.length ? list.map(p => {
    const pr = p.presence || {}; const nm = p.isMe ? myName() : dispName(p.by || pr.u, pr.n); const lv = clamp(Math.floor(Number(pr.lv) || 1), 1, 99);
    return `<div class="op"><div class="dot" style="background:#${new THREE.Color(tintOf(pr.tn)).getHexString()}">${esc((nm[0] || '?').toUpperCase())}</div><div><div>${esc(nm)}${p.isMe ? ` <span class="pill">${tx('you', 'sen')}</span>` : ''}</div><div class="st">Lv ${lv} · ${esc(stText(pr))}</div></div></div>`;
  }).join('') + (list.length < 2 ? `<p class="note">${tx('Share the link with friends; they\'ll show up here.', 'Linki arkadaşlarınla paylaş; burada belirirler.')}</p>` : '') : `<p class="note">${tx('Connecting…', 'Bağlanılıyor…')}</p>`;
}

/* ------------------------------ MAIN LOOP ------------------------------ */
let last = performance.now(), menuT = 0, lobbyT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.state === 'playing' && !game.paused) {
    game.t += dt;
    if (game.mode !== 'arena' || !ARENA.dead) updatePlayer(dt);
    for (const k in cds) cds[k] = Math.max(0, cds[k] - dt);
    breakT = Math.max(0, breakT - dt); overT = Math.max(0, overT - dt); shieldT = Math.max(0, shieldT - dt);
    const s = ws[curW]; if (s.rel > 0) { s.rel -= dt; if (s.rel <= 0) { s.rel = 0; s.mag = magOf(W(curW)); } }
    if (firing) fire();
    if (game.mode !== 'arena') { updateDirector(dt); updateEnemies(dt); updateDrone(dt); updatePickups(dt); }
    else updateArena(dt);
    updateProjs(dt);
    game.comboT -= dt; if (game.comboT <= 0) game.combo = 0;
    if (game.state === 'playing') updateHUD();
    lobbyT -= dt; if (lobbyT <= 0) { lobbyT = 2.5; setLobbyPresence(); }
    shake = Math.max(0, shake - dt * 1.5);
    const bob = P.onGround ? Math.sin(P.bob * 2) * 0.035 * Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 7) : 0;
    camera.position.set(P.pos.x + rand(-1, 1) * shake * 0.3, P.pos.y + P.eye + bob + rand(-1, 1) * shake * 0.3, P.pos.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
    const targetFov = settings.fov + (P.dashV.lengthSq() > 40 || GR.active ? 8 : 0) - (breakT > 0 ? 6 : 0);
    if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 10)); camera.updateProjectionMatrix(); }
    scene.fog.color.set(breakT > 0 ? 0x0a1a2a : 0x070b14);
    updateViewmodel(dt);
  } else if (game.state === 'menu' || game.state === 'results') {
    menuT += dt * 0.06;
    camera.position.set(Math.cos(menuT) * 36, 17, Math.sin(menuT) * 36); camera.lookAt(0, 0, 0);
    if (camera.fov !== settings.fov) { camera.fov = settings.fov; camera.updateProjectionMatrix(); }
  }
  if (!game.paused) { updateParts(dt); updateFx(dt); }
  renderer.clear();
  renderer.render(scene, camera);
  if (game.state === 'playing') { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
applyLang();
buildViewmodel();
renderMenu();
requestAnimationFrame(loop);
bootCaps();
// debug hook for automated checks
if (/[?&]debug/.test(location.search) || location.protocol === 'file:') window.__bugavi = { game, P, enemies, startRun, endRun, profile: () => profile, spawnEnemy, fire, ARENA, NET, setLang, useGrapple, useBlink, useShield, switchW };
