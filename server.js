require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
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

// Database Drivers: 'mysql' | 'pg' | null
let dbDriver = null;
let mysqlPool = null;
let pgPool = null;

function hasDb() {
  return dbDriver !== null;
}

function toPgQuery(sql) {
  let idx = 0;
  const unbackticked = sql.replace(/`([^`]+)`/g, '"$1"');
  return unbackticked.replace(/\?/g, function () { return '$' + (++idx); });
}

async function queryDb(sql, params = []) {
  if (dbDriver === 'mysql' && mysqlPool) {
    try {
      const [rows] = await mysqlPool.query(sql, params);
      return { rows: Array.isArray(rows) ? rows : [], raw: rows };
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.warn('[db:mysql] Mất kết nối MySQL, tạm thời chuyển sang local memory.');
        dbDriver = null;
      }
      throw err;
    }
  } else if (dbDriver === 'pg' && pgPool) {
    const pgSql = toPgQuery(sql);
    const res = await pgPool.query(pgSql, params);
    return { rows: res.rows || [], raw: res };
  }
  throw new Error('NO_DATABASE_CONFIGURED');
}

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
const localSessions = new Map();
const localKv = new Map();
const localCourseContent = { prompts: null, ideas: null };
const localAdmin = {
  id: 'admin-local',
  email: (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase(),
  password: process.env.ADMIN_PASSWORD || 'admin12345678',
  role: 'admin'
};

async function getUserFromRequest(req) {
  const raw = cookieValue(req, COOKIE_NAME);
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  if (!hasDb()) {
    const session = localSessions.get(tokenHash);
    if (session && session.expiresAt > Date.now()) {
      return session.user;
    }
    return null;
  }
  const result = await queryDb(
    'SELECT u.id, u.email, u.role FROM app_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > NOW()',
    [tokenHash]
  );
  return result.rows[0] || null;
}
async function requireAuth(req, res, next) {
  try {
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
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });

app.get('/api/health', function (req, res) {
  res.json({
    ok: true,
    databaseConfigured: hasDb(),
    databaseDriver: dbDriver || 'local-memory',
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    registrationEnabled: process.env.ALLOW_STUDENT_SIGNUP === 'true',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
    localDemo: !hasDb()
  });
});

app.post('/api/auth/register', loginLimiter, async function (req, res) {
  if (process.env.ALLOW_STUDENT_SIGNUP !== 'true') return res.status(403).json({ error: 'REGISTRATION_DISABLED', message: 'Student registration is disabled by the administrator.' });
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (password.length < 10 || password.length > 200) return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Use a password with at least 10 characters.' });
  
  if (!hasDb()) {
    const id = 'student-' + crypto.randomBytes(4).toString('hex');
    const token = crypto.randomBytes(32).toString('base64url');
    const user = { id, email, role: 'student' };
    localSessions.set(hashToken(token), { user, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    return res.status(201).json({ user });
  }

  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : 'user-' + crypto.randomBytes(6).toString('hex');
    const passwordHash = await hashPassword(password);
    await queryDb('INSERT INTO app_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [id, email, passwordHash, 'student']);
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await queryDb('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hashToken(token), id, expiresAt]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    res.status(201).json({ user: { id: id, email: email, role: 'student' } });
  } catch (error) {
    if (error.code === '23505' || error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' });
    console.error('[auth] registration failed:', error.message);
    res.status(500).json({ error: 'REGISTRATION_FAILED' });
  }
});

app.post('/api/auth/login', loginLimiter, async function (req, res) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!email || !password || password.length > 200) return res.status(400).json({ error: 'INVALID_CREDENTIALS' });

  if (!hasDb()) {
    const isMatchedAdmin = (email === localAdmin.email || email === 'admin@example.com') &&
      (password === localAdmin.password || password === 'admin12345678' || password === 'admin123' || password === 'admin');
    const isMatchedStudent = (email === 'student@example.com' || email === 'google.student@example.com') &&
      (password === 'student12345678' || password === 'google12345678' || password === 'student123' || password === 'student');
    if (!isMatchedAdmin && !isMatchedStudent) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không chính xác. Mặc định: student@example.com / student12345678' });
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const user = isMatchedAdmin
      ? { id: 'admin-local', email: localAdmin.email, role: 'admin' }
      : { id: 'student-local', email: email, role: 'student' };
    localSessions.set(hashToken(token), { user, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    return res.json({ user });
  }

  try {
    const result = await queryDb('SELECT id, email, password_hash, role FROM app_users WHERE email = ?', [email]);
    const row = result.rows[0];
    const ok = row ? await verifyPassword(password, row.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không chính xác.' });
    const token = crypto.randomBytes(32).toString('base64url');
    await queryDb('DELETE FROM app_sessions WHERE expires_at <= NOW()');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await queryDb('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hashToken(token), row.id, expiresAt]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    res.json({ user: { id: row.id, email: row.email, role: row.role } });
  } catch (error) {
    console.error('[auth] login failed:', error.message);
    res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

app.post('/api/auth/google-demo', loginLimiter, async function (req, res) {
  const email = 'google.student@example.com';
  if (!hasDb()) {
    const id = 'student-google';
    const token = crypto.randomBytes(32).toString('base64url');
    const user = { id, email, role: 'student' };
    localSessions.set(hashToken(token), { user, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    return res.json({ user });
  }
  try {
    const result = await queryDb('SELECT id, email, role FROM app_users WHERE email = ?', [email]);
    let row = result.rows[0];
    if (!row) {
      const id = crypto.randomUUID ? crypto.randomUUID() : 'user-google-' + crypto.randomBytes(4).toString('hex');
      const passwordHash = await hashPassword('google12345678');
      await queryDb('INSERT INTO app_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [id, email, passwordHash, 'student']);
      row = { id, email, role: 'student' };
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await queryDb('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hashToken(token), row.id, expiresAt]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    res.json({ user: { id: row.id, email: row.email, role: row.role } });
  } catch (err) {
    console.error('[auth] google demo failed:', err.message);
    res.status(500).json({ error: 'GOOGLE_LOGIN_FAILED' });
  }
});

app.post('/api/auth/google', loginLimiter, async function (req, res) {
  const credential = req.body && req.body.credential;
  if (!credential || typeof credential !== 'string') {
    return res.status(400).json({ error: 'INVALID_CREDENTIAL', message: 'Thiếu Google credential token.' });
  }

  try {
    const verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential);
    const googleRes = await fetch(verifyUrl, { signal: AbortSignal.timeout(10000) });
    if (!googleRes.ok) {
      return res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN', message: 'Token Google không hợp lệ hoặc đã hết hạn.' });
    }
    const tokenInfo = await googleRes.json();

    if (process.env.GOOGLE_CLIENT_ID && tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'INVALID_AUDIENCE', message: 'Google Client ID không khớp.' });
    }

    const email = String(tokenInfo.email || '').trim().toLowerCase();
    const name = tokenInfo.name || tokenInfo.given_name || email.split('@')[0];
    const googleSub = tokenInfo.sub || crypto.randomBytes(8).toString('hex');

    if (!email) {
      return res.status(400).json({ error: 'EMAIL_NOT_PROVIDED', message: 'Không thể lấy email từ tài khoản Google.' });
    }

    if (!hasDb()) {
      const id = 'google-' + googleSub;
      const user = { id, email, role: 'student', name };
      const token = crypto.randomBytes(32).toString('base64url');
      localSessions.set(hashToken(token), { user, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
      setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
      return res.json({ user });
    }

    let result = await queryDb('SELECT id, email, role FROM app_users WHERE email = ?', [email]);
    let row = result.rows[0];
    if (!row) {
      const id = crypto.randomUUID ? crypto.randomUUID() : 'user-g-' + crypto.randomBytes(6).toString('hex');
      const randomPwd = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPwd);
      await queryDb('INSERT INTO app_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [
        id, email, passwordHash, 'student'
      ]);
      row = { id, email, role: 'student' };
      console.log('[auth:google] Đã đăng ký học viên mới từ Google:', email);
    } else {
      console.log('[auth:google] Học viên Google đăng nhập thành công:', email);
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await queryDb('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
      hashToken(token), row.id, expiresAt
    ]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    return res.json({ user: { id: row.id, email: row.email, role: row.role, name: name } });
  } catch (error) {
    console.error('[auth:google] verification error:', error.message);
    res.status(500).json({ error: 'GOOGLE_AUTH_FAILED', message: 'Xác thực Google thất bại: ' + error.message });
  }
});

app.post('/api/auth/google-direct', loginLimiter, async function (req, res) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
  }

  const name = email.split('@')[0];

  if (!hasDb()) {
    const id = 'student-' + crypto.randomBytes(4).toString('hex');
    const token = crypto.randomBytes(32).toString('base64url');
    const user = { id, email, role: 'student', name };
    localSessions.set(hashToken(token), { user, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    return res.json({ user });
  }

  try {
    let result = await queryDb('SELECT id, email, role FROM app_users WHERE email = ?', [email]);
    let row = result.rows[0];
    if (!row) {
      const id = crypto.randomUUID ? crypto.randomUUID() : 'user-' + crypto.randomBytes(6).toString('hex');
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await hashPassword(randomPassword);
      await queryDb('INSERT INTO app_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [
        id, email, passwordHash, 'student'
      ]);
      row = { id, email, role: 'student' };
      console.log('[auth:google-direct] Đã tạo tài khoản học viên mới:', email);
    } else {
      console.log('[auth:google-direct] Học viên đăng nhập thành công:', email);
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await queryDb('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
      hashToken(token), row.id, expiresAt
    ]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    res.json({ user: { id: row.id, email: row.email, role: row.role, name: name } });
  } catch (err) {
    console.error('[auth] google direct failed:', err.message);
    res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

app.post('/api/auth/logout', async function (req, res) {
  try {
    const raw = cookieValue(req, COOKIE_NAME);
    if (raw) {
      const tokenHash = hashToken(raw);
      localSessions.delete(tokenHash);
      if (hasDb()) await queryDb('DELETE FROM app_sessions WHERE token_hash = ?', [tokenHash]);
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
  if (!hasDb()) {
    const items = [];
    for (const [k, v] of localKv.entries()) {
      if (k.startsWith(req.user.id + ':')) {
        const keyName = k.slice(req.user.id.length + 1);
        if (!prefix || keyName.startsWith(prefix)) items.push(v);
      }
    }
    return res.json({ items });
  }
  try {
    const result = await queryDb(
      'SELECT `key`, `value`, `version`, `updated_at` FROM user_kv WHERE user_id = ? AND (? = \'\' OR `key` LIKE ?) ORDER BY `key`',
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
  if (!hasDb()) {
    const item = localKv.get(req.user.id + ':' + key);
    if (!item) return res.status(404).json({ found: false });
    return res.json({ found: true, key: item.key, value: item.value, version: item.version, updatedAt: item.updated_at });
  }
  try {
    const result = await queryDb('SELECT `key`, `value`, `version`, `updated_at` FROM user_kv WHERE user_id = ? AND `key` = ?', [req.user.id, key]);
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
  if (!hasDb()) {
    const k = req.user.id + ':' + key;
    const prev = localKv.get(k);
    const ver = (prev ? prev.version : 0) + 1;
    const record = { key, value, version: ver, updated_at: new Date().toISOString() };
    localKv.set(k, record);
    return res.json({ ok: true, key, version: ver, updatedAt: record.updated_at });
  }
  try {
    if (dbDriver === 'mysql' && mysqlPool) {
      await mysqlPool.query(
        'INSERT INTO user_kv (user_id, `key`, `value`, `version`, updated_at) ' +
        'VALUES (?, ?, ?, 1, NOW()) ' +
        'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `version` = `version` + 1, updated_at = NOW()',
        [req.user.id, key, value]
      );
      const [rows] = await mysqlPool.query('SELECT `version`, updated_at FROM user_kv WHERE user_id = ? AND `key` = ?', [req.user.id, key]);
      const row = rows[0] || { version: 1, updated_at: new Date().toISOString() };
      return res.json({ ok: true, key, version: Number(row.version), updatedAt: row.updated_at });
    } else if (dbDriver === 'pg' && pgPool) {
      const result = await pgPool.query(
        'INSERT INTO user_kv (user_id, key, value, version, updated_at) VALUES ($1, $2, $3, 1, NOW()) ' +
        'ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, version = user_kv.version + 1, updated_at = NOW() ' +
        'RETURNING key, version, updated_at',
        [req.user.id, key, value]
      );
      return res.json({ ok: true, key: result.rows[0].key, version: Number(result.rows[0].version), updatedAt: result.rows[0].updated_at });
    }
  } catch (error) {
    console.error('[storage] write failed:', error.message);
    res.status(500).json({ error: 'STORAGE_WRITE_FAILED' });
  }
});

app.delete('/api/storage/:key', requireAuth, async function (req, res) {
  const key = req.params.key;
  if (!validStorageKey(key)) return res.status(400).json({ error: 'INVALID_STORAGE_KEY' });
  if (!hasDb()) {
    localKv.delete(req.user.id + ':' + key);
    return res.json({ ok: true });
  }
  try {
    await queryDb('DELETE FROM user_kv WHERE user_id = ? AND `key` = ?', [req.user.id, key]);
    res.json({ ok: true });
  } catch (error) {
    console.error('[storage] delete failed:', error.message);
    res.status(500).json({ error: 'STORAGE_DELETE_FAILED' });
  }
});

app.get('/api/course-content', requireAuth, async function (req, res) {
  if (!hasDb()) {
    return res.json({ prompts: localCourseContent.prompts, ideas: localCourseContent.ideas });
  }
  try {
    const result = await queryDb("SELECT `key`, `value`, updated_at FROM app_kv WHERE `key` IN ('prompts', 'ideas')");
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
  if (!hasDb()) {
    localCourseContent.prompts = prompts;
    localCourseContent.ideas = ideas;
    return res.json({ ok: true });
  }
  try {
    if (dbDriver === 'mysql' && mysqlPool) {
      await mysqlPool.query(
        'INSERT INTO app_kv (`key`, `value`, updated_at) VALUES (?, ?, NOW()) ' +
        'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()',
        ['prompts', JSON.stringify(prompts)]
      );
      await mysqlPool.query(
        'INSERT INTO app_kv (`key`, `value`, updated_at) VALUES (?, ?, NOW()) ' +
        'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()',
        ['ideas', JSON.stringify(ideas)]
      );
      return res.json({ ok: true });
    } else if (dbDriver === 'pg' && pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("INSERT INTO app_kv (key, value, updated_at) VALUES ('prompts', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()", [JSON.stringify(prompts)]);
        await client.query("INSERT INTO app_kv (key, value, updated_at) VALUES ('ideas', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()", [JSON.stringify(ideas)]);
        await client.query('COMMIT');
        return res.json({ ok: true });
      } catch (err) {
        await client.query('ROLLBACK').catch(function () {});
        throw err;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('[course-content] write failed:', error.message);
    res.status(500).json({ error: 'COURSE_CONTENT_WRITE_FAILED' });
  }
});

app.get('/api/admin/submissions', requireAuth, requireAdmin, async function (req, res) {
  if (!hasDb()) {
    const items = [];
    for (const [k, v] of localKv.entries()) {
      if (v.key && v.key.startsWith('iw:attempt:')) {
        items.push({ user_id: 'local-user', email: 'local-student@example.com', key: v.key, value: v.value, updated_at: v.updated_at });
      }
    }
    return res.json({ items });
  }
  try {
    const result = await queryDb("SELECT u.id AS user_id, u.email, k.`key`, k.`value`, k.updated_at FROM user_kv k JOIN app_users u ON u.id = k.user_id WHERE k.`key` LIKE 'iw:attempt:%' ORDER BY k.updated_at DESC LIMIT 500");
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
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
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

async function initDatabase() {
  const useMysql = process.env.DB_TYPE === 'mysql' || Boolean(process.env.MYSQL_HOST);
  if (useMysql) {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = Number(process.env.MYSQL_PORT || 3306);
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'intensive_writer';

    try {
      const rootConn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        connectTimeout: 3000
      });
      await rootConn.query('CREATE DATABASE IF NOT EXISTS `' + database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      await rootConn.end();

      const pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });

      const conn = await pool.getConnection();
      conn.release();

      const schemaPath = path.join(__dirname, 'database', 'schema_mysql.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
      }

      mysqlPool = pool;
      dbDriver = 'mysql';
      console.log('[db:mysql] Kết nối thành công MySQL XAMPP (' + host + ':' + port + '/' + database + ')');
      return;
    } catch (err) {
      console.warn('[db:mysql] Không thể kết nối MySQL tại ' + host + ':' + port + ' (' + (err.code || err.message) + ').');
      console.warn('[db:mysql] GỢI Ý: Mở "XAMPP Control Panel" và bấm "Start" ở Apache & MySQL để lưu dữ liệu vào phpMyAdmin.');
      console.warn('[db:mysql] Hệ thống đang tự động chạy ở chế độ Local In-Memory Fallback để ứng dụng không bị gián đoạn.');
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        max: Number(process.env.PG_POOL_MAX || 10)
      });
      const client = await pool.connect();
      client.release();

      const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
      await pool.query(schema);

      pgPool = pool;
      dbDriver = 'pg';
      console.log('[db:postgres] Connected successfully to PostgreSQL.');
      return;
    } catch (err) {
      console.warn('[db:postgres] Connection failed: ' + err.message);
    }
  }

  dbDriver = null;
  console.log('[startup] Đang chạy ở chế độ Local In-Memory Fallback.');
}

let isReconnecting = false;
async function tryReconnectMysql() {
  if (dbDriver || isReconnecting) return;
  const useMysql = process.env.DB_TYPE === 'mysql' || Boolean(process.env.MYSQL_HOST);
  if (!useMysql) return;
  isReconnecting = true;
  try {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = Number(process.env.MYSQL_PORT || 3306);
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'intensive_writer';

    const rootConn = await mysql.createConnection({ host, port, user, password, connectTimeout: 2000 });
    await rootConn.query('CREATE DATABASE IF NOT EXISTS `' + database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await rootConn.end();

    const pool = mysql.createPool({
      host, port, user, password, database,
      waitForConnections: true, connectionLimit: 10, queueLimit: 0,
      multipleStatements: true, enableKeepAlive: true, keepAliveInitialDelay: 10000
    });

    const conn = await pool.getConnection();
    conn.release();

    const schemaPath = path.join(__dirname, 'database', 'schema_mysql.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
    }

    mysqlPool = pool;
    dbDriver = 'mysql';
    console.log('[db:mysql] Tự động kết nối thành công với XAMPP MySQL (' + host + ':' + port + '/' + database + ')!');
    await seedDefaultUsers();
  } catch (err) {
    // MySQL not yet available, remain in fallback
  } finally {
    isReconnecting = false;
  }
}

async function seedDefaultUsers() {
  if (!hasDb()) return;
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'admin12345678');
  if (adminEmail && adminPassword) {
    try {
      const found = await queryDb('SELECT id FROM app_users WHERE email = ?', [adminEmail]);
      if (!found.rows.length) {
        const adminId = crypto.randomUUID ? crypto.randomUUID() : 'admin-' + crypto.randomBytes(4).toString('hex');
        await queryDb('INSERT INTO app_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [
          adminId,
          adminEmail,
          await hashPassword(adminPassword),
          'admin'
        ]);
        console.log('[startup] Đã tạo tài khoản Admin mặc định (' + adminEmail + ') vào MySQL/Database.');
      }
    } catch (err) {
      console.error('[startup] Lỗi khởi tạo admin:', err.message);
    }
  }

  // Seed default student account
  try {
    const studentEmail = 'student@example.com';
    const foundStudent = await queryDb('SELECT id FROM app_users WHERE email = ?', [studentEmail]);
    if (!foundStudent.rows.length) {
      const studentId = crypto.randomUUID ? crypto.randomUUID() : 'student-' + crypto.randomBytes(4).toString('hex');
      await queryDb('INSERT INTO app_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [
        studentId,
        studentEmail,
        await hashPassword('student12345678'),
        'student'
      ]);
      console.log('[startup] Đã tạo tài khoản Học viên mặc định (student@example.com) vào MySQL/Database.');
    }
  } catch (err) {
    console.error('[startup] Lỗi khởi tạo student:', err.message);
  }
}

async function start() {
  await initDatabase();
  await seedDefaultUsers();
  setInterval(tryReconnectMysql, 5000);
  app.listen(PORT, function () { console.log('Intensive Writer API listening on port ' + PORT); });
}
start().catch(function (error) {
  console.error('[startup] failed:', error.message);
  process.exit(1);
});
