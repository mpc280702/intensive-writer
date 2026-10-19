(function () {
  const auth = {
    currentUser: null,
    async bootstrap() {
      if (!window.IWApi || !window.IWApi.isConfigured()) {
        this.currentUser = null;
        if (window.storage) window.storage.setUser('guest');
        this.updateButton();
        this.setMessage('Chế độ local/demo: hãy cấu hình API server để đăng nhập và đồng bộ dữ liệu.', true);
        return null;
      }
      try {
        const result = await window.IWApi.request('/api/auth/me');
        this.currentUser = result.user || null;
      } catch (error) {
        this.currentUser = null;
      }
      if (window.storage) window.storage.setUser((this.currentUser && this.currentUser.id) || 'guest');
      this.updateButton();
      return this.currentUser;
    },
    updateButton() {
      const button = document.getElementById('accountBtn');
      const label = document.getElementById('accountBtnLabel');
      if (!button || !label) return;
      label.textContent = this.currentUser ? this.currentUser.email : 'Đăng nhập';
      button.title = this.currentUser ? 'Tài khoản và đăng xuất' : 'Đăng nhập để đồng bộ tiến độ';
    },
    setMessage(message, isError) {
      const el = document.getElementById('authMessage');
      if (!el) return;
      el.textContent = message || '';
      el.classList.toggle('error', Boolean(isError));
    },
    open() {
      const modal = document.getElementById('accountModal');
      if (!modal) return;
      modal.classList.add('open');
      this.setMessage(
        window.IWApi && window.IWApi.isConfigured()
          ? (this.currentUser ? 'Bạn đã đăng nhập. Tiến độ được đồng bộ theo tài khoản.' : 'Đăng nhập để đồng bộ tiến độ giữa các thiết bị.')
          : 'API backend chưa được cấu hình. Ứng dụng vẫn chạy ở chế độ local/demo.',
        !(window.IWApi && window.IWApi.isConfigured())
      );
      const logout = document.getElementById('logoutAccountBtn');
      if (logout) logout.hidden = !this.currentUser;
      const register = document.getElementById('registerAccountBtn');
      if (register) register.hidden = !(window.IW_CONFIG && window.IW_CONFIG.allowStudentSignup === true);
    },
    async login(email, password) {
      const result = await window.IWApi.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password })
      });
      this.currentUser = result.user;
      if (window.storage) window.storage.setUser(this.currentUser.id);
      window.location.reload();
    },
    async register(email, password) {
      const result = await window.IWApi.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password })
      });
      this.currentUser = result.user;
      if (window.storage) window.storage.setUser(this.currentUser.id);
      window.location.reload();
    },
    async logout() {
      if (window.IWApi && window.IWApi.isConfigured()) {
        await window.IWApi.request('/api/auth/logout', { method: 'POST', body: '{}' }).catch(function () {});
      }
      this.currentUser = null;
      if (window.storage) window.storage.setUser('guest');
      window.location.reload();
    }
  };
  window.IWAuth = auth;

  document.addEventListener('DOMContentLoaded', function () {
    const accountBtn = document.getElementById('accountBtn');
    const loginForm = document.getElementById('accountLoginForm');
    const registerBtn = document.getElementById('registerAccountBtn');
    const logoutBtn = document.getElementById('logoutAccountBtn');

    if (accountBtn) accountBtn.addEventListener('click', function () { auth.open(); });
    document.querySelectorAll('[data-auth-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        const modal = document.getElementById('accountModal');
        if (modal) modal.classList.remove('open');
      });
    });
    const modal = document.getElementById('accountModal');
    if (modal) modal.addEventListener('click', function (event) {
      if (event.target === modal) modal.classList.remove('open');
    });

    if (loginForm) loginForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!window.IWApi || !window.IWApi.isConfigured()) return auth.setMessage('Chưa cấu hình API backend. Hãy sửa shared/js/config.js và triển khai server.', true);
      const email = document.getElementById('accountEmail').value.trim();
      const password = document.getElementById('accountPassword').value;
      const submit = loginForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      auth.setMessage('Đang đăng nhập…', false);
      try { await auth.login(email, password); }
      catch (error) { auth.setMessage(error.message === 'INVALID_CREDENTIALS' ? 'Email hoặc mật khẩu không chính xác.' : (error.message || 'Không thể đăng nhập.'), true); }
      finally { submit.disabled = false; }
    });

    if (registerBtn) registerBtn.addEventListener('click', async function () {
      if (!window.IWApi || !window.IWApi.isConfigured()) return auth.setMessage('Chưa cấu hình API backend.', true);
      const email = document.getElementById('accountEmail').value.trim();
      const password = document.getElementById('accountPassword').value;
      if (!email || !password) return auth.setMessage('Nhập email và mật khẩu trước khi đăng ký.', true);
      registerBtn.disabled = true;
      auth.setMessage('Đang tạo tài khoản…', false);
      try { await auth.register(email, password); }
      catch (error) { auth.setMessage(error.message === 'REGISTRATION_DISABLED' ? 'Đăng ký đang bị tắt. Hãy liên hệ quản trị viên.' : (error.message || 'Không thể đăng ký.'), true); }
      finally { registerBtn.disabled = false; }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', async function () {
      logoutBtn.disabled = true;
      await auth.logout();
    });
  });
})();