#!/usr/bin/env node
'use strict';

/**
 * Intensive Writer — Google Sign-In security patch
 * Run from the repository root: node apply_google_login_fix.js
 * Creates timestamped backups and fails before writing if expected source anchors are missing.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = process.cwd();
const MARKER = 'GOOGLE_OAUTH_VERIFIED_LOGIN_PATCH_V1';
const files = {
  server: path.join(ROOT, 'server.js'),
  auth: path.join(ROOT, 'web', 'js', 'auth.js'),
  html: path.join(ROOT, 'web', 'index.html'),
  css: path.join(ROOT, 'web', 'css', 'style.css'),
  env: path.join(ROOT, '.env.example'),
};

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`Không tìm thấy ${path.relative(ROOT, file)}. Hãy chạy script ở thư mục gốc repository.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0) throw new Error(`Không tìm thấy đoạn cần sửa: ${label}`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Đoạn sửa không duy nhất: ${label}`);
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}
function replaceBetween(source, startText, endText, replacement, label) {
  const start = source.indexOf(startText);
  if (start < 0) throw new Error(`Không tìm thấy điểm bắt đầu: ${label}`);
  const end = source.indexOf(endText, start + startText.length);
  if (end < 0) throw new Error(`Không tìm thấy điểm kết thúc: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}
function syntaxCheck(code, filename) {
  try { new vm.Script(code, { filename }); }
  catch (error) { throw new Error(`Lỗi cú pháp sau khi sửa ${filename}: ${error.message}`); }
}
function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(line => line ? pad + line : line).join('\n');
}

const original = {
  server: readRequired(files.server),
  auth: readRequired(files.auth),
  html: readRequired(files.html),
  css: readRequired(files.css),
  env: readRequired(files.env),
};
if (original.server.includes(MARKER) || original.auth.includes(MARKER)) {
  console.log('Bản vá Google OAuth đã được áp dụng trước đó. Không sửa lặp lại.');
  process.exit(0);
}

const GOOGLE_ROUTE = `// ${MARKER}: role is derived on the server; never trust a client-supplied asAdmin flag.
app.post('/api/auth/google', loginLimiter, async function (req, res) {
  const expectedClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!expectedClientId) {
    return res.status(503).json({ error: 'GOOGLE_NOT_CONFIGURED', message: 'Google Sign-In chưa được cấu hình trên máy chủ.' });
  }

  const credential = req.body && req.body.credential;
  if (!credential || typeof credential !== 'string' || credential.length > 12000) {
    return res.status(400).json({ error: 'INVALID_CREDENTIAL', message: 'Thiếu hoặc sai định dạng Google credential.' });
  }

  try {
    // Google verifies the signed ID token and returns its claims. The audience must ALWAYS match our Web Client ID.
    const verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential);
    const googleRes = await fetch(verifyUrl, { signal: AbortSignal.timeout(10000) });
    if (!googleRes.ok) {
      return res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN', message: 'Token Google không hợp lệ hoặc đã hết hạn.' });
    }
    const claims = await googleRes.json();
    const issuer = String(claims.iss || '');
    const expiry = Number(claims.exp);
    const emailVerified = claims.email_verified === true || String(claims.email_verified).toLowerCase() === 'true';
    const audienceMatches = String(claims.aud || '') === expectedClientId && (!claims.azp || String(claims.azp) === expectedClientId);
    const issuerMatches = issuer === 'accounts.google.com' || issuer === 'https://accounts.google.com';

    if (!audienceMatches || !issuerMatches || !emailVerified || !claims.sub || !Number.isFinite(expiry) || expiry * 1000 <= Date.now()) {
      return res.status(401).json({ error: 'GOOGLE_CLAIMS_INVALID', message: 'Không thể xác minh tài khoản Google cho website này.' });
    }

    const email = String(claims.email || '').trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return res.status(401).json({ error: 'GOOGLE_EMAIL_INVALID', message: 'Google không cung cấp địa chỉ email hợp lệ.' });
    }
    const name = String(claims.name || claims.given_name || email.split('@')[0]).slice(0, 200);
    const configuredAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const isConfiguredAdmin = Boolean(configuredAdminEmail) && email === configuredAdminEmail;

    // Production must never issue ephemeral in-memory sessions or accept demo identities.
    if (!hasDb()) {
      if (isProduction) {
        return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED', message: 'Máy chủ chưa kết nối cơ sở dữ liệu; đăng nhập tạm thời bị khóa.' });
      }
      const id = 'google-' + crypto.createHash('sha256').update(String(claims.sub)).digest('hex').slice(0, 32);
      const user = { id, email, role: isConfiguredAdmin ? 'admin' : 'student', name };
      const token = crypto.randomBytes(32).toString('base64url');
      localSessions.set(hashToken(token), { user, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
      setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
      return res.json({ user });
    }

    let found = await queryDb('SELECT id, email, role FROM app_users WHERE email = ?', [email]);
    let row = found.rows[0];

    if (!row) {
      if (!isConfiguredAdmin && process.env.ALLOW_STUDENT_SIGNUP !== 'true') {
        return res.status(403).json({ error: 'REGISTRATION_DISABLED', message: 'Đăng ký học viên mới đang tắt. Vui lòng liên hệ quản trị viên.' });
      }
      const id = crypto.randomUUID ? crypto.randomUUID() : 'google-' + crypto.randomBytes(12).toString('hex');
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);
      const role = isConfiguredAdmin ? 'admin' : 'student';
      try {
        await queryDb('INSERT INTO app_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [id, email, passwordHash, role]);
        row = { id, email, role };
      } catch (insertError) {
        // Handle two simultaneous first sign-ins for the same email safely.
        if (insertError.code !== '23505' && insertError.code !== 'ER_DUP_ENTRY') throw insertError;
        found = await queryDb('SELECT id, email, role FROM app_users WHERE email = ?', [email]);
        row = found.rows[0];
        if (!row) throw insertError;
      }
    }

    // Only the verified, explicitly configured admin email may receive the configured admin role.
    if (isConfiguredAdmin && row.role !== 'admin') {
      await queryDb('UPDATE app_users SET role = ? WHERE id = ?', ['admin', row.id]);
      row.role = 'admin';
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await queryDb('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hashToken(token), row.id, expiresAt]);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
    return res.json({ user: { id: row.id, email: row.email, role: row.role, name } });
  } catch (error) {
    console.error('[auth:google] verification/sign-in failed:', error.message);
    return res.status(500).json({ error: 'GOOGLE_AUTH_FAILED', message: 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.' });
  }
});`;

const DISABLED_QUICK_ADMIN = `// ${MARKER}: removed insecure endpoint that granted an admin session without Google verification.
app.post('/api/auth/google-quick-admin', loginLimiter, function (req, res) {
  return res.status(410).json({ error: 'UNSAFE_AUTH_FLOW_DISABLED', message: 'Đăng nhập quản trị nhanh đã bị tắt. Hãy đăng nhập bằng tài khoản quản trị được xác minh.' });
});`;
const DISABLED_DIRECT = `// ${MARKER}: email text alone is not proof of Google account ownership.
app.post('/api/auth/google-direct', loginLimiter, function (req, res) {
  return res.status(410).json({ error: 'UNSAFE_AUTH_FLOW_DISABLED', message: 'Không hỗ trợ đăng nhập bằng cách nhập email בלבד. Hãy dùng xác thực Google chính thức.' });
});`;

let server = original.server;
server = replaceBetween(
  server,
  "app.post('/api/auth/google-quick-admin', loginLimiter, async function (req, res) {",
  "app.post('/api/auth/google', loginLimiter, async function (req, res) {",
  DISABLED_QUICK_ADMIN + '\n\n',
  'endpoint google-quick-admin'
);
server = replaceBetween(
  server,
  "app.post('/api/auth/google', loginLimiter, async function (req, res) {",
  "app.post('/api/auth/google-direct', loginLimiter, async function (req, res) {",
  GOOGLE_ROUTE + '\n\n',
  'endpoint google'
);
server = replaceBetween(
  server,
  "app.post('/api/auth/google-direct', loginLimiter, async function (req, res) {",
  "app.post('/api/auth/logout', async function (req, res) {",
  DISABLED_DIRECT + '\n\n',
  'endpoint google-direct'
);
server = replaceOnce(
  server,
  "  if (!hasDb()) {\n    const isMatchedAdmin =",
  "  if (!hasDb()) {\n    if (isProduction) return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED', message: 'Máy chủ chưa kết nối cơ sở dữ liệu; đăng nhập tạm thời bị khóa.' });\n    const isMatchedAdmin =",
  'khóa đăng nhập demo khi NODE_ENV=production'
);

// Keep the seed account for local development only; never seed a publicly documented shared student account in production.
const studentSeedStart = server.indexOf('  // Seed default student account');
if (studentSeedStart < 0) throw new Error('Không tìm thấy khối seed tài khoản học viên mặc định.');
const studentSeedEnd = server.indexOf('\n}\n\nasync function start()', studentSeedStart);
if (studentSeedEnd < 0) throw new Error('Không tìm thấy điểm kết thúc khối seed tài khoản học viên.');
const studentSeedBlock = server.slice(studentSeedStart, studentSeedEnd);
server = server.slice(0, studentSeedStart) +
  '  if (!isProduction) {\n' + indent(studentSeedBlock, 2) + '\n  }\n' +
  server.slice(studentSeedEnd);

const startOld = `async function start() {
  await initDatabase();
  await seedDefaultUsers();`;
const startNew = `async function start() {
  if (isProduction) {
    const configuredAdminEmail = String(process.env.ADMIN_EMAIL || '').trim();
    const configuredAdminPassword = String(process.env.ADMIN_PASSWORD || '');
    const configuredGoogleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!configuredAdminEmail || configuredAdminPassword.length < 16) {
      throw new Error('Production requires ADMIN_EMAIL and ADMIN_PASSWORD with at least 16 characters.');
    }
    if (!configuredGoogleClientId) {
      throw new Error('Production requires GOOGLE_CLIENT_ID for verified Google Sign-In.');
    }
  }
  await initDatabase();
  if (isProduction && !hasDb()) {
    throw new Error('Production requires a persistent PostgreSQL/MySQL database; in-memory fallback is disabled.');
  }
  await seedDefaultUsers();`;
server = replaceOnce(server, startOld, startNew, 'kiểm tra cấu hình production');

let auth = original.auth;
if (auth.includes('function doQuickGoogleAdminLogin()')) {
  auth = replaceBetween(
    auth,
    '    async function doQuickGoogleAdminLogin() {',
    '    // Try initializing GIS once page and script load',
    `    async function handleGoogleCredential(response) {
      if (!response || !response.credential) return;
      try {
        auth.setMessage('Đang xác minh tài khoản Google…', false);
        const result = await window.IWApi.request('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({ credential: response.credential })
        });
        auth.currentUser = result.user;
        if (window.storage) {
          window.storage.setUser(auth.currentUser.id);
          await window.storage.migrateGuestToUser(auth.currentUser.id).catch(function () {});
        }
        if (auth.currentUser.role === 'admin') {
          auth.setMessage('Đăng nhập quản trị thành công. Đang chuyển trang…', false);
          setTimeout(function () { window.location.href = new URL('../admin/', window.location.href).href; }, 500);
        } else {
          if (window.toast) window.toast('✅ Đăng nhập Google thành công!');
          auth.setMessage('Đăng nhập thành công. Đang tải dữ liệu học tập…', false);
          setTimeout(function () { window.location.reload(); }, 500);
        }
      } catch (err) {
        console.error('[google] sign-in failed:', err);
        auth.setMessage(err.message || 'Không thể xác minh tài khoản Google. Vui lòng thử lại.', true);
      }
    }

    function initGisClient(cid) {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
      try {
        window.google.accounts.id.initialize({
          client_id: cid,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        googleGisInitialized = true;
        if (googleBtn && window.google.accounts.id.renderButton) {
          googleBtn.replaceChildren();
          const width = Math.max(220, Math.min(360, (googleBtn.parentElement && googleBtn.parentElement.clientWidth) || 320));
          window.google.accounts.id.renderButton(googleBtn, {
            type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
            shape: 'rectangular', logo_alignment: 'left', locale: 'vi', width: width
          });
        }
        return true;
      } catch (err) {
        console.warn('[google] GIS initialize error:', err);
        return false;
      }
    }

`,
    'loại bỏ quick-admin và thay callback Google'
  );
} else {
  throw new Error('Không tìm thấy hàm doQuickGoogleAdminLogin để sửa.');
}

// Remove localStorage-supplied arbitrary Client ID; the owner configures it in source/backend instead.
auth = replaceBetween(
  auth,
  '      if (!cid) {\n        cid = localStorage.getItem(\'iw:google_client_id\') || \'\';',
  '      return cid;\n    }',
  '      // Client ID must come from the site configuration or the backend health endpoint.\n',
  'nguồn Google Client ID'
);

// Replace GIS bootstrap and delete the old prompt fallback to insecure quick-admin.
auth = replaceBetween(
  auth,
  '    // Try initializing GIS once page and script load',
  '    // Logged-in Profile View Handlers',
  `    // Render the official Google Sign-In button. Never fall back to email-only or quick-admin login.
    getGoogleClientId().then(function (cid) {
      if (!window.IWApi || !window.IWApi.isConfigured()) {
        if (googleBtn) {
          googleBtn.textContent = 'Cần cấu hình API backend để đăng nhập Google';
          googleBtn.classList.add('google-signin-unconfigured');
        }
        return;
      }
      if (!cid) {
        if (googleBtn) {
          googleBtn.textContent = 'Google Sign-In chưa được cấu hình';
          googleBtn.classList.add('google-signin-unconfigured');
        }
        return;
      }
      const tryRender = function () {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          clearInterval(checkTimer);
          initGisClient(cid);
        }
      };
      const checkTimer = setInterval(tryRender, 200);
      tryRender();
      setTimeout(function () { clearInterval(checkTimer); }, 10000);
    });

    `,
  'Google Sign-In bootstrap'
);

// Delete deceptive email-only Google setup flow. Google Client ID is configured by the administrator.
auth = replaceBetween(
  auth,
  '    // Google Setup & Direct Registration Handlers',
  '    // Unified Form Submit (Login, Register & Forgot)',
  '    // Google Client ID is administrator-configured; typing an email is never a Google authentication method.\n\n',
  'xóa đăng nhập Gmail chỉ bằng email'
);

// Stop showing a fake OTP flow; recovery needs a real backend/email provider before it can be enabled.
auth = replaceBetween(
  auth,
  '    if (forgotPwdBtn) {',
  '\n\n    if (methodEmail && methodPhone)',
  `    if (forgotPwdBtn) {
      forgotPwdBtn.addEventListener('click', function (e) {
        e.preventDefault();
        auth.setMessage('Chức năng khôi phục mật khẩu chưa được kết nối. Vui lòng liên hệ quản trị viên.', true);
      });
    }`,
  'vô hiệu hóa OTP khôi phục giả lập'
);

// Ensure registration validates password and confirmation, while normal login can accept older passwords.
auth = replaceOnce(
  auth,
  `        if (isRegister) {
          if (pwdConfirmInput && pwdConfirmInput.value && password !== pwdConfirmInput.value) {
            return auth.setMessage('Mật khẩu xác nhận không khớp.', true);
          }`,
  `        if (isRegister) {
          if (password.length < 10) return auth.setMessage('Mật khẩu đăng ký phải có ít nhất 10 ký tự.', true);
          if (!pwdConfirmInput || !pwdConfirmInput.value || password !== pwdConfirmInput.value) {
            return auth.setMessage('Vui lòng nhập và xác nhận mật khẩu giống nhau.', true);
          }`,
  'kiểm tra mật khẩu đăng ký'
);

let html = original.html;
html = replaceOnce(html, 'value="student@example.com"', '', 'xóa email mẫu điền sẵn');
html = replaceOnce(html, 'value="student12345678"', '', 'xóa mật khẩu mẫu điền sẵn');
html = replaceOnce(html, 'placeholder="Tối thiểu 10 ký tự" autocomplete="current-password" minlength="10"', 'placeholder="Nhập mật khẩu của bạn" autocomplete="current-password"', 'không chặn đăng nhập bằng mật khẩu cũ');
html = replaceBetween(
  html,
  '          <div class="auth-demo-hint-badge auth-login-only">',
  '\n          </div>',
  '          <div class="auth-demo-hint-badge auth-login-only">🔐 Đăng nhập an toàn: chọn nút Google chính thức để xác minh tài khoản. Không cần và không nên nhập Gmail để giả lập đăng nhập.</div>',
  'xóa thông tin tài khoản demo'
);
const googleButtonRegex = /<div class="auth-quick-actions auth-login-reg-tabs">\s*<button type="button" class="auth-social-btn" id="authGoogleBtn">[\s\S]*?<span id="googleBtnText">Google<\/span>[\s\S]*?<\/button>\s*<\/div>/;
if (!googleButtonRegex.test(html)) throw new Error('Không tìm thấy nút Google hiện tại trong web/index.html.');
html = html.replace(googleButtonRegex, '<div class="auth-quick-actions auth-login-reg-tabs">\n            <div class="google-signin-container" id="authGoogleBtn" aria-label="Đăng nhập bằng Google"></div>\n          </div>');
html = replaceBetween(
  html,
  '  <!-- Google OAuth & Direct Registration Modal -->',
  '  <!-- Full Essay Modal -->',
  '  <!-- Google sign-in uses the official Google Identity Services button; no email-only sign-in modal. -->\n\n',
  'xóa modal đăng nhập bằng email giả lập'
);

let css = original.css;
if (!css.includes('.google-signin-container')) {
  css += `\n\n/* ${MARKER}: official Google Identity Services sign-in button */
.google-signin-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 42px;
  margin: 4px 0;
}
.google-signin-container > div,
.google-signin-container iframe {
  max-width: 100%;
}
.google-signin-unconfigured {
  color: #64748B;
  font-size: 0.84rem;
  line-height: 1.45;
  text-align: center;
  padding: 10px;
  border: 1px dashed #CBD5E1;
  border-radius: 10px;
  background: #F8FAFC;
}
`;
}

let env = original.env;
if (!env.includes('GOOGLE_CLIENT_ID=')) {
  env = replaceOnce(env, 'ADMIN_PASSWORD=replace-with-a-long-random-password\n', 'ADMIN_PASSWORD=replace-with-a-long-random-password\nGOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com\n', 'thêm GOOGLE_CLIENT_ID vào .env.example');
}

// Syntax-check changed JavaScript before writing anything.
syntaxCheck(server, 'server.js');
syntaxCheck(auth, 'web/js/auth.js');

const changed = [
  [files.server, server], [files.auth, auth], [files.html, html], [files.css, css], [files.env, env]
];
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backups = [];
for (const [file] of changed) {
  backups.push([file, `${file}.backup-google-login-${stamp}`]);
}
for (let i = 0; i < changed.length; i++) {
  const [file, contents] = changed[i];
  fs.copyFileSync(file, backups[i][1]);
  fs.writeFileSync(file, contents, 'utf8');
}

console.log('Đã áp dụng bản sửa Google OAuth. Các file đã thay đổi:');
for (const [file] of changed) console.log(' - ' + path.relative(ROOT, file));
console.log('\nBản sao lưu được tạo cạnh từng file với hậu tố .backup-google-login-' + stamp);
console.log('Đã khóa 2 endpoint đăng nhập không an toàn: /api/auth/google-quick-admin và /api/auth/google-direct.');
console.log('Đã bỏ asAdmin khỏi yêu cầu Google; vai trò chỉ được xác định từ tài khoản máy chủ sau khi xác minh Google token.');
console.log('\nBước tiếp theo: đọc GOOGLE_LOGIN_SETUP.md và cấu hình GOOGLE_CLIENT_ID, API URL, database và ADMIN_PASSWORD.');
