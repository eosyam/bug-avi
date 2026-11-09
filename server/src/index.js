// Bug Avı oyun sunucusu — Cloudflare Worker + Durable Objects
//   /ws/lobby, /ws/arena : WebSocket odaları (presence + olay dağıtımı)
//   /scores              : ortak liderlik tablosu (GET liste, POST kendi skorunu yaz)
import { DurableObject } from 'cloudflare:workers';

const ROOM_NAMES = new Set(['lobby', 'arena']);
const MAX_PEERS = 40;
const MAX_MSG = 4096;
const MAX_PRESENCE = 1500;
const MSGS_PER_SEC = 60;

function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !(allowed.includes('*') || allowed.includes(origin))) return null;
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req.headers.get('Origin'), env);
    if (req.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (url.pathname === '/') return new Response('bug-avi-server ok\n', { headers: { 'content-type': 'text/plain' } });

    const ws = url.pathname.match(/^\/ws\/([a-z0-9-]{1,32})$/);
    if (ws) {
      if (!cors) return new Response('forbidden origin', { status: 403 });
      if (!ROOM_NAMES.has(ws[1])) return new Response('unknown room', { status: 404 });
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(ws[1])).fetch(req);
    }
    if (url.pathname === '/scores') {
      if (!cors) return new Response('forbidden origin', { status: 403 });
      if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method' }, 405, cors);
      const res = await env.BOARD.get(env.BOARD.idFromName('main')).fetch(req);
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
      return out;
    }
    return new Response('not found', { status: 404 });
  },
};

/* One Durable Object per room name. Uses the WebSocket Hibernation API, so an idle room costs nothing. */
export class Room extends DurableObject {
  async fetch() {
    if (this.ctx.getWebSockets().length >= MAX_PEERS) return new Response('room full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    const peer = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer, p: {}, w: 0, n: 0 });
    const others = this.ctx.getWebSockets().filter(w => w !== server).map(w => { const a = w.deserializeAttachment() || {}; return { peer: a.peer, p: a.p || {} }; }).filter(x => x.peer);
    server.send(JSON.stringify({ t: 'hello', peer, peers: others, time: Date.now() }));
    this.broadcast({ t: 'join', peer, p: {} }, server);
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const w of this.ctx.getWebSockets()) { if (w === except) continue; try { w.send(s); } catch (e) { } }
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    const a = ws.deserializeAttachment(); if (!a) return;
    const now = Date.now();
    if (now - a.w > 1000) { a.w = now; a.n = 0; }
    if (++a.n > MSGS_PER_SEC) { ws.serializeAttachment(a); return; }
    let m; try { m = JSON.parse(raw); } catch (e) { ws.serializeAttachment(a); return; }
    if (m && m.t === 'pres' && m.p && typeof m.p === 'object' && !Array.isArray(m.p) && JSON.stringify(m.p).length <= MAX_PRESENCE) {
      a.p = m.p; ws.serializeAttachment(a);
      this.broadcast({ t: 'pres', peer: a.peer, p: a.p }, ws);
      return;
    }
    ws.serializeAttachment(a);
    if (m && m.t === 'emit' && typeof m.topic === 'string' && /^[a-z][a-z0-9_.-]{0,47}$/.test(m.topic)) {
      this.broadcast({ t: 'msg', peer: a.peer, topic: m.topic, data: m.data === undefined ? null : m.data }); // sender gets its own echo
    } else if (m && m.t === 'ping') {
      try { ws.send('{"t":"pong"}'); } catch (e) { }
    }
  }
  async webSocketClose(ws, code) {
    const a = ws.deserializeAttachment();
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) { }
    if (a && a.peer) this.broadcast({ t: 'leave', peer: a.peer }, ws);
  }
  async webSocketError(ws) {
    const a = ws.deserializeAttachment();
    if (a && a.peer) this.broadcast({ t: 'leave', peer: a.peer }, ws);
  }
}

/* Leaderboard in the Durable Object's SQLite storage. Each player writes only their own row,
   proven by a random secret key they keep in their browser (only its hash is stored). */
async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS scores (
      pid TEXT PRIMARY KEY, keyhash TEXT NOT NULL, nick TEXT NOT NULL DEFAULT '',
      sprint INTEGER DEFAULT 0, wave INTEGER DEFAULT 0, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
      pvp INTEGER DEFAULT 0, kills INTEGER DEFAULT 0, tint INTEGER DEFAULT 0, t INTEGER DEFAULT 0)`);
  }
  async fetch(req) {
    const sql = this.ctx.storage.sql;
    if (req.method === 'GET') {
      const rows = sql.exec('SELECT pid AS id, nick, sprint, wave, level, xp, pvp, kills, tint, t FROM scores ORDER BY xp DESC LIMIT 300').toArray();
      return json({ scores: rows }, 200, { 'cache-control': 'no-store' });
    }
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const pid = String(b.pid || ''), key = String(b.key || '');
    if (!/^[a-f0-9]{16,40}$/.test(pid) || !/^[a-f0-9]{24,64}$/.test(key)) return json({ error: 'bad id' }, 400);
    const keyhash = await sha256(key);
    const ex = sql.exec('SELECT keyhash FROM scores WHERE pid = ?', pid).toArray()[0];
    if (ex && ex.keyhash !== keyhash) return json({ error: 'forbidden' }, 403);
    if (!ex && sql.exec('SELECT COUNT(*) AS c FROM scores').one().c >= 5000) return json({ error: 'full' }, 507);
    const nick = String(b.nick || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16);
    const row = [pid, keyhash, nick, int(b.sprint, 1e6), int(b.wave, 999), Math.max(1, int(b.level, 99)), int(b.xp, 1e9), int(b.pvp, 1e6), int(b.kills, 1e8), int(b.tint, 7), Date.now()];
    sql.exec(`INSERT INTO scores (pid, keyhash, nick, sprint, wave, level, xp, pvp, kills, tint, t) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(pid) DO UPDATE SET nick=excluded.nick, sprint=excluded.sprint, wave=excluded.wave, level=excluded.level,
      xp=excluded.xp, pvp=excluded.pvp, kills=excluded.kills, tint=excluded.tint, t=excluded.t`, ...row);
    return json({ ok: true });
  }
}
