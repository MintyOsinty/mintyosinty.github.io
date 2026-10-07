/**
 * MintyOsinty \u2014 Space Invaders leaderboard (Cloudflare Worker, module syntax)
 *
 * Bindings (set in the Cloudflare dashboard \u2192 Worker \u2192 Settings):
 *   SCORES       KV namespace binding
 *   SIGNING_KEY  Secret \u2014 any long random string (signs game tokens)
 *   ADMIN_TOKEN  Secret \u2014 any long random string (lets you delete bad scores)
 *
 * Routes:
 *   GET  /scores            \u2192 { scores: [{ name, score, wave, date }] }  (top 10)
 *   POST /start             \u2192 { token }   call when a game begins
 *   POST /submit            \u2192 { ok, rank, scores }   body: { token, name, score, wave }
 *   POST /admin/remove      \u2192 { ok, scores }   header Authorization: Bearer <ADMIN_TOKEN>, body: { rank }
 */

const ALLOWED_ORIGINS = ['https://mintyosinty.github.io'];
const BOARD_KEY = 'top10';
const BOARD_SIZE = 10;

// Game rules mirrored from invaders.js \u2014 used to reject impossible scores.
const MAX_POINTS_PER_WAVE = 30 * 8 + 20 * 16 + 10 * 16 + 100; // all invaders + wave-clear bonus = 820
const MAX_UFO_POINTS = 300;
const MIN_UFO_GAP_SECONDS = 18;
const MIN_SECONDS_PER_WAVE = 15;   // a full wave can't realistically be cleared faster
const MIN_GAME_SECONDS = 5;
const MAX_GAME_SECONDS = 3 * 60 * 60;
const SUBMIT_COOLDOWN_SECONDS = 60; // one submission per IP per minute (KV's minimum TTL)

// Three-letter names only. Blocks the obvious ones.
const BLOCKED = new Set(['ASS', 'FUK', 'FUC', 'FCK', 'CUM', 'COK', 'KKK', 'NIG', 'NGR', 'FAG', 'DIK', 'DIC', 'TIT', 'SEX',
  'SHT', 'HOE', 'JIZ', 'PUS', 'VAG', 'NAZ']);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/scores') {
        return json({ scores: await readBoard(env) }, 200, cors, 'public, max-age=15');
      }

      if (request.method === 'POST' && url.pathname === '/admin/remove') {
        return await adminRemove(request, env, cors);
      }

      // Game endpoints only accept requests from the site itself.
      if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'forbidden' }, 403, cors);

      if (request.method === 'POST' && url.pathname === '/start') {
        const t = Math.floor(Date.now() / 1000);
        const nonce = randomId();
        const payload = `${t}.${nonce}`;
        return json({ token: `${payload}.${await sign(payload, env.SIGNING_KEY)}` }, 200, cors);
      }

      if (request.method === 'POST' && url.pathname === '/submit') {
        return await submit(request, env, cors);
      }

      return json({ error: 'not found' }, 404, cors);
    } catch (err) {
      return json({ error: 'server error' }, 500, cors);
    }
  }
};

async function submit(request, env, cors) {
  const body = await readJson(request);
  if (!body) return json({ error: 'bad request' }, 400, cors);

  const name = String(body.name || '').toUpperCase();
  const score = Number(body.score);
  const wave = Number(body.wave);
  const token = String(body.token || '');

  if (!/^[A-Z0-9]{3}$/.test(name) || BLOCKED.has(name)) return json({ error: 'invalid name' }, 400, cors);
  if (!Number.isInteger(score) || score <= 0 || score % 10 !== 0 || score > 999990) return json({ error: 'invalid score' }, 400, cors);
  if (!Number.isInteger(wave) || wave < 1 || wave > 999) return json({ error: 'invalid wave' }, 400, cors);

  // 1. Token must be one we issued, unmodified.
  const parts = token.split('.');
  if (parts.length !== 3) return json({ error: 'invalid token' }, 400, cors);
  const [ts, nonce, sig] = parts;
  if (!(await verify(`${ts}.${nonce}`, sig, env.SIGNING_KEY))) return json({ error: 'invalid token' }, 400, cors);

  // 2. Score must be possible in the time played.
  const elapsed = Math.floor(Date.now() / 1000) - Number(ts);
  if (elapsed < MIN_GAME_SECONDS || elapsed > MAX_GAME_SECONDS) return json({ error: 'token expired' }, 400, cors);
  const maxWaves = Math.floor(elapsed / MIN_SECONDS_PER_WAVE) + 1;
  const maxUfos = Math.floor(elapsed / MIN_UFO_GAP_SECONDS) + 1;
  if (wave > maxWaves) return json({ error: 'implausible' }, 400, cors);
  if (score > wave * MAX_POINTS_PER_WAVE + maxUfos * MAX_UFO_POINTS) return json({ error: 'implausible' }, 400, cors);

  // 3. Each token can be used once; each IP can submit once a minute.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const [used, recent] = await Promise.all([env.SCORES.get(`used:${nonce}`), env.SCORES.get(`rl:${ip}`)]);
  if (used) return json({ error: 'already submitted' }, 409, cors);
  if (recent) return json({ error: 'slow down' }, 429, cors);
  await Promise.all([
    env.SCORES.put(`used:${nonce}`, '1', { expirationTtl: MAX_GAME_SECONDS }),
    env.SCORES.put(`rl:${ip}`, '1', { expirationTtl: SUBMIT_COOLDOWN_SECONDS })
  ]);

  // 4. Insert if it makes the board.
  const board = await readBoard(env);
  const entry = { name, score, wave, date: new Date().toISOString().slice(0, 10) };
  board.push(entry);
  board.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  const top = board.slice(0, BOARD_SIZE);
  const rank = top.indexOf(entry) + 1; // 0 = didn't place
  if (rank > 0) await env.SCORES.put(BOARD_KEY, JSON.stringify(top));

  return json({ ok: true, rank, scores: top }, 200, cors);
}

async function adminRemove(request, env, cors) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || !timingSafeEqual(auth, `Bearer ${env.ADMIN_TOKEN}`)) return json({ error: 'unauthorized' }, 401, cors);
  const body = await readJson(request);
  const rank = Number(body && body.rank);
  const board = await readBoard(env);
  if (!Number.isInteger(rank) || rank < 1 || rank > board.length) return json({ error: 'invalid rank' }, 400, cors);
  board.splice(rank - 1, 1);
  await env.SCORES.put(BOARD_KEY, JSON.stringify(board));
  return json({ ok: true, scores: board }, 200, cors);
}

/* ---------- helpers ---------- */
async function readBoard(env) {
  try {
    const list = JSON.parse((await env.SCORES.get(BOARD_KEY)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 1024) return null;
    return JSON.parse(text);
  } catch { return null; }
}

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (ALLOWED_ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(data, status, headers, cache) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': cache || 'no-store' }
  });
}

function randomId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret) {
  if (!secret) throw new Error('SIGNING_KEY not set');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function sign(payload, secret) {
  const key = await hmacKey(secret);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

async function verify(payload, sig, secret) {
  try {
    const key = await hmacKey(secret);
    return await crypto.subtle.verify('HMAC', key, fromB64url(sig), new TextEncoder().encode(payload));
  } catch { return false; }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
