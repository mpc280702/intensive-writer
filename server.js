require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'iw_session';
const SESSION_DAYS = 7;
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,https://mpc280702.github.io').split(',').map(function (v) { return v.trim(); }).filter(Boolean));
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX || 10)
}) : null;

app.disable('x-powered-by');
app.set('trust proxy', isProduction ? 1 : false);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(function verifyOriginForWrites(req, res, next) {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    }
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

function cookieValue(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}
function setSessionCookie(res, value, maxAge) {
  const sameSite = isProduction ? 'SameSite=None; Secure' : 'SameSite=Lax';
  res.setHeader('Set-Cookie', COOKIE_NAME + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; Max-Age=' + maxAge + '; ' + sameSite);
}
function clearSessionCookie(res) {
  const sameSite = isProduction ? 'SameSite=None; Secure' : 'SameSite=Lax';
  res.setHeader('Set-Cookie', COOKIE_NAME + '=; Path=/; HttpOnly; Max-Age=0; ' + sameSite);
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('base64url') + '$' + derived.toString('base64url');
}
async function verifyPassword(password, stored) {
  try {
    const pieces = String(stored).split('$');
    if (pieces[0] !== 'scrypt' || !pieces[1] || !pieces[2]) return false;
    const salt = Buffer.from(pieces[1], 'base64url');
    const expected = Buffer.from(pieces[2], 'base64url');
    const actual = await scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (error) {
    return false;
  }
}
function requireDb(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED', message: 'Set DATABASE_URL on the API server.' });
  next();
}
async function getUserFromRequest(req) {
  if (!pool) return null;
  const raw = cookieValue(req, COOKIE_NAME);
  if (!raw) return null;
  const result = await pool.query(
    'SELECT u.id, u.email, u.role FROM app_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()',
    [hashToken(raw)]
  );
  return result.rows[0] || null;
}
async function requireAuth(req, res, next) {
  try {
    if (!pool) return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Please sign in.' });
    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] session lookup failed:', error.message);
    res.status(500).json({ error: 'AUTH_LOOKUP_FAILED' });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'FORBIDDEN', message: 'Administrator access required.' });
  next();
}
function validStorageKey(key) {
  return key === 'iw:stats' || /^iw:attempt:[A-Za-z0-9_-]{1,160}$/.test(key) || /^iw:explore:[A-Za-z0-9_-]{1,160}$/.test(key);
}
function parseJsonText(value) {
  try { return JSON.parse(value); } catch (error) { return null; }
}
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });

app.get('/api/health', function (req, res) {
  res.json({
    ok: true,
    databaseConfigured: Boolean(pool),
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    registrationEnabled: process.env.ALLOW_STUDENT_SIGNUP === 'true'
  });
});

app.post('/api/auth/register', requireDb, loginLimiter, async function (req, res) {
  if (process.env.ALLOW_STUDENT_SIGNUP !== 'true') return res.status(403).json({ error: 'REGISTRATION_DISABLED', message: 'Student registration is disabled by the administrator.' });
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (password.length < 10 || password.length > 200) return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Use a password with at least 10 characters.' });
  try {
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await pool.query('INSERT INTO app_users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)', [id, email, passwordHash, 'student']);
    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query("INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')", [hashToken(token), id]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    res.status(201).json({ user: { id: id, email: email, role: 'student' } });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' });
    console.error('[auth] registration failed:', error.message);
    res.status(500).json({ error: 'REGISTRATION_FAILED' });
  }
});

app.post('/api/auth/login', requireDb, loginLimiter, async function (req, res) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!email || !password || password.length > 200) return res.status(400).json({ error: 'INVALID_CREDENTIALS' });
  try {
    const result = await pool.query('SELECT id, email, password_hash, role FROM app_users WHERE email = $1', [email]);
    const row = result.rows[0];
    const ok = row ? await verifyPassword(password, row.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query('DELETE FROM app_sessions WHERE expires_at <= NOW()');
    await pool.query("INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')", [hashToken(token), row.id]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    res.json({ user: { id: row.id, email: row.email, role: row.role } });
  } catch (error) {
    console.error('[auth] login failed:', error.message);
    res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

app.post('/api/auth/logout', async function (req, res) {
  try {
    if (pool) {
      const raw = cookieValue(req, COOKIE_NAME);
      if (raw) await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [hashToken(raw)]);
    }
  } catch (error) {
    console.error('[auth] logout cleanup failed:', error.message);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});
app.get('/api/auth/me', requireAuth, function (req, res) { res.json({ user: req.user }); });

app.get('/api/storage', requireAuth, async function (req, res) {
  const prefix = String(req.query.prefix || '');
  if (prefix && !['iw:attempt:', 'iw:explore:', 'iw:stats'].includes(prefix)) return res.status(400).json({ error: 'INVALID_PREFIX' });
  try {
    const result = await pool.query(
      "SELECT key, value, version, updated_at FROM user_kv WHERE user_id = $1 AND ($2 = '' OR key LIKE $3) ORDER BY key",
      [req.user.id, prefix, prefix.endsWith(':') ? prefix + '%' : prefix]
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error('[storage] list failed:', error.message);
    res.status(500).json({ error: 'STORAGE_READ_FAILED' });
  }
});
app.get('/api/storage/:key', requireAuth, async function (req, res) {
  const key = req.params.key;
  if (!validStorageKey(key)) return res.status(400).json({ error: 'INVALID_STORAGE_KEY' });
  try {
    const result = await pool.query('SELECT key, value, version, updated_at FROM user_kv WHERE user_id = $1 AND key = $2', [req.user.id, key]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ found: false });
    res.json({ found: true, key: row.key, value: row.value, version: Number(row.version), updatedAt: row.updated_at });
  } catch (error) {
    console.error('[storage] read failed:', error.message);
    res.status(500).json({ error: 'STORAGE_READ_FAILED' });
  }
});
app.put('/api/storage/:key', requireAuth, async function (req, res) {
  const key = req.params.key;
  const value = req.body && req.body.value;
  if (!validStorageKey(key)) return res.status(400).json({ error: 'INVALID_STORAGE_KEY' });
  if (typeof value !== 'string' || value.length > 500000) return res.status(400).json({ error: 'INVALID_STORAGE_VALUE' });
  try {
    const result = await pool.query(
      'INSERT INTO user_kv (user_id, key, value, version, updated_at) VALUES ($1, $2, $3, 1, NOW()) ' +
      'ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, version = user_kv.version + 1, updated_at = NOW() ' +
      'RETURNING key, version, updated_at',
      [req.user.id, key, value]
    );
    res.json({ ok: true, key: result.rows[0].key, version: Number(result.rows[0].version), updatedAt: result.rows[0].updated_at });
  } catch (error) {
    console.error('[storage] write failed:', error.message);
    res.status(500).json({ error: 'STORAGE_WRITE_FAILED' });
  }
});
app.delete('/api/storage/:key', requireAuth, async function (req, res) {
  const key = req.params.key;
  if (!validStorageKey(key)) return res.status(400).json({ error: 'INVALID_STORAGE_KEY' });
  try {
    await pool.query('DELETE FROM user_kv WHERE user_id = $1 AND key = $2', [req.user.id, key]);
    res.json({ ok: true });
  } catch (error) {
    console.error('[storage] delete failed:', error.message);
    res.status(500).json({ error: 'STORAGE_DELETE_FAILED' });
  }
});

app.get('/api/course-content', requireAuth, async function (req, res) {
  try {
    const result = await pool.query("SELECT key, value, updated_at FROM app_kv WHERE key IN ('prompts', 'ideas')");
    const payload = {};
    for (const row of result.rows) payload[row.key] = parseJsonText(row.value);
    res.json({ prompts: payload.prompts || null, ideas: payload.ideas || null });
  } catch (error) {
    console.error('[course-content] read failed:', error.message);
    res.status(500).json({ error: 'COURSE_CONTENT_READ_FAILED' });
  }
});
app.put('/api/course-content', requireAuth, requireAdmin, async function (req, res) {
  const prompts = req.body && req.body.prompts;
  const ideas = req.body && req.body.ideas;
  if (!Array.isArray(prompts) || !ideas || typeof ideas !== 'object' || Array.isArray(ideas)) return res.status(400).json({ error: 'INVALID_COURSE_CONTENT' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO app_kv (key, value, updated_at) VALUES ('prompts', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()", [JSON.stringify(prompts)]);
    await client.query("INSERT INTO app_kv (key, value, updated_at) VALUES ('ideas', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()", [JSON.stringify(ideas)]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(function () {});
    console.error('[course-content] write failed:', error.message);
    res.status(500).json({ error: 'COURSE_CONTENT_WRITE_FAILED' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/submissions', requireAuth, requireAdmin, async function (req, res) {
  try {
    const result = await pool.query("SELECT u.id AS user_id, u.email, k.key, k.value, k.updated_at FROM user_kv k JOIN app_users u ON u.id = k.user_id WHERE k.key LIKE 'iw:attempt:%' ORDER BY k.updated_at DESC LIMIT 500");
    res.json({ items: result.rows });
  } catch (error) {
    console.error('[admin] submissions read failed:', error.message);
    res.status(500).json({ error: 'SUBMISSIONS_READ_FAILED' });
  }
});

app.post('/api/ai/claude', requireAuth, aiLimiter, async function (req, res) {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'Set ANTHROPIC_API_KEY on the server.' });
  const systemPrompt = String((req.body && req.body.systemPrompt) || '');
  const userPrompt = String((req.body && req.body.userPrompt) || '');
  const maxTokens = Math.max(100, Math.min(2200, Number((req.body && req.body.maxTokens) || 1000)));
  if (!systemPrompt || !userPrompt || systemPrompt.length > 12000 || userPrompt.length > 60000) return res.status(400).json({ error: 'INVALID_AI_REQUEST' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      console.error('[ai] provider returned:', response.status, (data.error && data.error.type) || (data.error && data.error.message) || 'unknown error');
      return res.status(502).json({ error: 'AI_PROVIDER_ERROR', message: 'The AI service could not complete the request.' });
    }
    const text = (data.content || []).filter(function (item) { return item.type === 'text'; }).map(function (item) { return item.text; }).join('\n');
    const fence = String.fromCharCode(96).repeat(3);
    const clean = text.replace(new RegExp('^\\s*' + fence + '(?:json)?\\s*', 'i'), '').replace(new RegExp('\\s*' + fence + '\\s*$'), '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch (error) { return res.status(502).json({ error: 'AI_INVALID_JSON', message: 'The AI returned an invalid response format.' }); }
    res.json({ result: parsed });
  } catch (error) {
    console.error('[ai] request failed:', error.message);
    res.status(502).json({ error: 'AI_REQUEST_FAILED', message: 'The AI service is temporarily unavailable.' });
  }
});

app.use('/shared', express.static(path.join(__dirname, 'shared'), { fallthrough: false }));
app.use('/web', express.static(path.join(__dirname, 'web'), { fallthrough: false }));
app.use('/admin', express.static(path.join(__dirname, 'admin'), { fallthrough: false }));
app.get('/', function (req, res) { res.redirect(302, '/web/'); });
app.get('/admin', function (req, res) { res.redirect(302, '/admin/'); });
app.get('/web', function (req, res) { res.redirect(302, '/web/'); });
app.use(function (error, req, res, next) {
  console.error('[server] unhandled error:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});

async function start() {
  if (pool) {
    const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
    await pool.query(schema);
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || '');
    if (adminEmail && adminPassword) {
      if (adminPassword.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
      const found = await pool.query('SELECT id FROM app_users WHERE email = $1', [adminEmail]);
      if (!found.rowCount) {
        await pool.query('INSERT INTO app_users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)', [crypto.randomUUID(), adminEmail, await hashPassword(adminPassword), 'admin']);
        console.log('[startup] Initial admin account created from environment.');
      }
    }
  } else {
    console.warn('[startup] DATABASE_URL is missing. Auth, shared persistence and server-side AI are disabled; local demo remains available.');
  }
  app.listen(PORT, function () { console.log('Intensive Writer API listening on port ' + PORT); });
}
start().catch(function (error) {
  console.error('[startup] failed:', error.message);
  process.exit(1);
});
