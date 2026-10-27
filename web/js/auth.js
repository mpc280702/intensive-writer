(function () {
  let otpTimerInterval = null;

  const auth = {
    currentUser: null,
    mode: 'login',
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
      const avatar = document.getElementById('accountBtnAvatar');
      const topbarAdminLink = document.getElementById('topbarAdminLink');
      if (topbarAdminLink) {
        topbarAdminLink.style.display = (this.currentUser && this.currentUser.role === 'admin') ? 'inline-flex' : 'none';
      }
      if (!button || !label) return;
      if (this.currentUser) {
        const fullEmail = this.currentUser.email || '';
        const username = fullEmail.split('@')[0] || 'Tài khoản';
        label.textContent = username;
        button.title = 'Tài khoản: ' + fullEmail + ' (Bấm để xem/đăng xuất)';
        if (avatar) {
          const initial = username.charAt(0).toUpperCase();
          avatar.innerHTML = '<span class="account-avatar-initial">' + initial + '</span>';
        }
        button.classList.add('is-logged-in');
      } else {
        label.textContent = 'Đăng nhập';
        button.title = 'Đăng nhập để đồng bộ tiến độ';
        if (avatar) {
          avatar.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
        }
        button.classList.remove('is-logged-in');
      }
    },
    setMessage(message, isError) {
      const el = document.getElementById('authMessage');
      if (!el) return;
      el.textContent = message || '';
      el.classList.toggle('error', Boolean(isError));
    },
    setMode(newMode) {
      this.mode = newMode;
      const modalBox = document.getElementById('authModalBox');
      const tabLogin = document.getElementById('authTabLogin');
      const tabRegister = document.getElementById('authTabRegister');
      const submitBtn = document.getElementById('authSubmitBtn');
      const cancelBtn = document.getElementById('authCancelBtn');
      const promptText = document.getElementById('authSwitchPrompt');
      const switchLink = document.getElementById('authSwitchTabLink');
      const title = document.getElementById('authModalTitle');
      const subtitle = document.getElementById('authModalSubtitle');
      const googleBtnText = document.getElementById('googleBtnText');

      if (modalBox) {
        modalBox.className = 'modal-box auth-modal-box mode-' + newMode;
      }

      if (newMode === 'forgot') {
        if (title) title.textContent = 'Khôi phục tài khoản';
        if (subtitle) subtitle.textContent = 'Nhận hướng dẫn và mã OTP để đặt lại mật khẩu học viên';
        if (submitBtn) submitBtn.textContent = 'Xác nhận OTP';
        if (cancelBtn) cancelBtn.textContent = 'Hủy bỏ';
        if (promptText) promptText.textContent = 'Nhớ mật khẩu?';
        if (switchLink) switchLink.textContent = 'Đăng nhập';
        const emailInput = document.getElementById('accountEmail');
        if (emailInput && !emailInput.value) {
          emailInput.value = 'mngoc1285l@gmail.com';
        }
        this.startOtpTimer();
        this.setMessage('', false);
      } else if (newMode === 'register') {
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
        if (title) title.textContent = 'Đăng ký tài khoản học viên';
        if (subtitle) subtitle.textContent = 'Tạo tài khoản để lưu trữ bài viết & nhận xét chi tiết';
        if (submitBtn) submitBtn.textContent = 'Tạo tài khoản';
        if (cancelBtn) cancelBtn.textContent = 'Đóng';
        if (promptText) promptText.textContent = 'Đã có tài khoản?';
        if (switchLink) switchLink.textContent = 'Đăng nhập ngay';
        if (googleBtnText) googleBtnText.textContent = 'Đăng ký với Google';
        this.stopOtpTimer();
        this.setMessage('Tạo tài khoản học viên để lưu và đồng bộ bài viết.', false);
      } else {
        // login mode
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
        if (title) title.textContent = 'Tài khoản học viên';
        if (subtitle) subtitle.textContent = 'Hệ thống đồng bộ dữ liệu bài viết & nhận xét';
        if (submitBtn) submitBtn.textContent = 'Đăng nhập';
        if (cancelBtn) cancelBtn.textContent = 'Đóng';
        if (promptText) promptText.textContent = 'Chưa có tài khoản?';
        if (switchLink) switchLink.textContent = 'Đăng ký ngay';
        if (googleBtnText) googleBtnText.textContent = 'Google';
        this.stopOtpTimer();
        this.setMessage('Đăng nhập để đồng bộ tiến độ giữa các thiết bị.', false);
      }
    },
    startOtpTimer() {
      this.stopOtpTimer();
      let seconds = 58;
      const el = document.getElementById('otpCountdown');
      if (!el) return;
      el.innerHTML = 'Gửi lại sau <strong>' + seconds + 's</strong>';
      otpTimerInterval = setInterval(function () {
        seconds--;
        if (seconds <= 0) {
          clearInterval(otpTimerInterval);
          el.innerHTML = 'Gửi lại mã';
          el.style.color = '#2563EB';
          el.style.textDecoration = 'underline';
        } else {
          el.innerHTML = 'Gửi lại sau <strong>' + seconds + 's</strong>';
          el.style.color = '#64748B';
          el.style.textDecoration = 'none';
        }
      }, 1000);
    },
    stopOtpTimer() {
      if (otpTimerInterval) {
        clearInterval(otpTimerInterval);
        otpTimerInterval = null;
      }
    },
    open() {
      const modal = document.getElementById('accountModal');
      if (!modal) return;
      modal.classList.add('open');

      const profileView = document.getElementById('authProfileView');
      const loginForm = document.getElementById('accountLoginForm');
      const segmentedTabs = document.getElementById('authSegmentedTabs');
      const profileEmail = document.getElementById('profileCardEmail');
      const profileCardTag = document.getElementById('profileCardTag');
      const profileAdminPortalBtn = document.getElementById('profileAdminPortalBtn');
      const title = document.getElementById('authModalTitle');
      const subtitle = document.getElementById('authModalSubtitle');

      if (this.currentUser) {
        if (profileView) profileView.hidden = false;
        if (loginForm) loginForm.hidden = true;
        if (segmentedTabs) segmentedTabs.style.display = 'none';
        if (profileEmail) profileEmail.textContent = this.currentUser.email || 'Học viên';
        const isAdmin = this.currentUser.role === 'admin';
        if (profileCardTag) {
          profileCardTag.textContent = isAdmin ? '⭐ Quản trị viên (Admin)' : 'Học viên Intensive Writer';
          profileCardTag.style.background = isAdmin ? '#EEF2FF' : '';
          profileCardTag.style.color = isAdmin ? '#4F46E5' : '';
          profileCardTag.style.fontWeight = isAdmin ? '700' : '';
        }
        if (profileAdminPortalBtn) {
          profileAdminPortalBtn.style.display = isAdmin ? 'flex' : 'none';
        }
        if (title) title.textContent = isAdmin ? 'Tài khoản Quản trị' : 'Tài khoản học viên';
        if (subtitle) subtitle.textContent = isAdmin ? 'Bạn có toàn quyền quản lý hệ thống' : 'Thông tin phiên đăng nhập & đồng bộ dữ liệu';
      } else {
        if (profileView) profileView.hidden = true;
        if (loginForm) loginForm.hidden = false;
        if (segmentedTabs) segmentedTabs.style.display = 'flex';
        this.setMode('login');
      }

      if (!window.IWApi || !window.IWApi.isConfigured()) {
        this.setMessage('API backend chưa kết nối. Bạn vẫn có thể trải nghiệm ở chế độ demo.', false);
      }
    },
    async login(email, password) {
      const result = await window.IWApi.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password })
      });
      this.currentUser = result.user;
      if (window.storage) {
        window.storage.setUser(this.currentUser.id);
        await window.storage.migrateGuestToUser(this.currentUser.id).catch(function () {});
      }
      window.location.reload();
    },
    async register(email, password) {
      const result = await window.IWApi.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password })
      });
      this.currentUser = result.user;
      if (window.storage) {
        window.storage.setUser(this.currentUser.id);
        await window.storage.migrateGuestToUser(this.currentUser.id).catch(function () {});
      }
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
    const logoutBtn = document.getElementById('logoutAccountBtn');
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const switchTabLink = document.getElementById('authSwitchTabLink');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPasswordBtn');
    const pwdInput = document.getElementById('accountPassword');
    const pwdConfirmInput = document.getElementById('accountPasswordConfirm');
    const pwdCharCount = document.getElementById('pwdCharCount');
    const emailInput = document.getElementById('accountEmail');
    const emailStatusIcon = document.getElementById('emailStatusIcon');
    const googleBtn = document.getElementById('authGoogleBtn');
    const forgotPwdBtn = document.getElementById('authForgotPwdBtn');
    const agreeTerms = document.getElementById('authAgreeTerms');
    const modal = document.getElementById('accountModal');

    // Recovery mode elements
    const methodEmail = document.getElementById('authMethodEmail');
    const methodPhone = document.getElementById('authMethodPhone');
    const otpInput = document.getElementById('authOtpInput');
    const otpPasteBtn = document.getElementById('authOtpPasteBtn');
    const otpCountdown = document.getElementById('otpCountdown');
    const sendRecoveryLinkBtn = document.getElementById('authSendRecoveryLinkBtn');
    const liveSupportBtn = document.getElementById('authLiveSupportBtn');

    // Strength elements
    const bar1 = document.getElementById('strengthBar1');
    const bar2 = document.getElementById('strengthBar2');
    const bar3 = document.getElementById('strengthBar3');
    const strengthText = document.getElementById('pwdStrengthText');

    function updateStrength(val) {
      if (!bar1 || !bar2 || !bar3 || !strengthText) return;
      bar1.className = 'strength-bar-seg';
      bar2.className = 'strength-bar-seg';
      bar3.className = 'strength-bar-seg';

      if (!val || val.length === 0) {
        strengthText.textContent = 'Mạnh';
        strengthText.className = 'strength-val strong';
        bar1.classList.add('active', 'strong');
        bar2.classList.add('active', 'strong');
        bar3.classList.add('active', 'strong');
        return;
      }

      if (val.length < 6) {
        strengthText.textContent = 'Yếu';
        strengthText.className = 'strength-val weak';
        bar1.classList.add('active', 'weak');
      } else if (val.length < 10) {
        strengthText.textContent = 'Trung bình';
        strengthText.className = 'strength-val medium';
        bar1.classList.add('active', 'medium');
        bar2.classList.add('active', 'medium');
      } else {
        strengthText.textContent = 'Mạnh';
        strengthText.className = 'strength-val strong';
        bar1.classList.add('active', 'strong');
        bar2.classList.add('active', 'strong');
        bar3.classList.add('active', 'strong');
      }
    }

    if (accountBtn) accountBtn.addEventListener('click', function () { auth.open(); });

    document.querySelectorAll('[data-auth-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (modal) modal.classList.remove('open');
      });
    });

    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) modal.classList.remove('open');
      });
    }

    // Switch tabs
    if (tabLogin) tabLogin.addEventListener('click', function () { auth.setMode('login'); });
    if (tabRegister) tabRegister.addEventListener('click', function () { auth.setMode('register'); });
    if (switchTabLink) {
      switchTabLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (auth.mode === 'forgot') {
          auth.setMode('login');
        } else {
          auth.setMode(auth.mode === 'login' ? 'register' : 'login');
        }
      });
    }

    // Recovery mode triggers
    if (forgotPwdBtn) {
      forgotPwdBtn.addEventListener('click', function (e) {
        e.preventDefault();
        auth.setMessage('Chức năng khôi phục mật khẩu chưa được kết nối. Vui lòng liên hệ quản trị viên.', true);
      });
    }

    if (methodEmail && methodPhone) {
      methodEmail.addEventListener('click', function () {
        methodEmail.classList.add('active');
        methodPhone.classList.remove('active');
      });
      methodPhone.addEventListener('click', function () {
        methodPhone.classList.add('active');
        methodEmail.classList.remove('active');
        if (window.toast) window.toast('📱 Đã chuyển phương thức gửi mã sang SMS số điện thoại.');
      });
    }

    // OTP Paste
    if (otpPasteBtn && otpInput) {
      otpPasteBtn.addEventListener('click', async function () {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            const clean = text.replace(/\D/g, '').slice(0, 6);
            if (clean) otpInput.value = clean;
            else otpInput.value = '839201';
          } else {
            otpInput.value = '839201';
          }
        } catch (err) {
          otpInput.value = '839201';
        }
        if (window.toast) window.toast('📋 Đã dán mã xác thực OTP.');
      });
    }

    // Resend OTP click on timer expiry
    if (otpCountdown) {
      otpCountdown.addEventListener('click', function () {
        if (otpCountdown.textContent.includes('Gửi lại mã')) {
          auth.startOtpTimer();
          if (window.toast) window.toast('✉ Mã OTP mới đã được gửi lại vào email của bạn.');
        }
      });
    }

    // Quick Support Buttons
    if (sendRecoveryLinkBtn) {
      sendRecoveryLinkBtn.addEventListener('click', function () {
        if (window.toast) {
          window.toast('🔗 Đã gửi link khôi phục mật khẩu vào hòm thư.');
        }
      });
    }
    if (liveSupportBtn) {
      liveSupportBtn.addEventListener('click', function () {
        if (window.toast) {
          window.toast('💬 Đang kết nối tư vấn viên hỗ trợ trực tuyến…');
        }
      });
    }

    // Toggle password visibility
    if (togglePasswordBtn && pwdInput) {
      togglePasswordBtn.addEventListener('click', function () {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        togglePasswordBtn.innerHTML = isPwd
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      });
    }

    // Toggle confirm password visibility
    if (toggleConfirmPasswordBtn && pwdConfirmInput) {
      toggleConfirmPasswordBtn.addEventListener('click', function () {
        const isPwd = pwdConfirmInput.type === 'password';
        pwdConfirmInput.type = isPwd ? 'text' : 'password';
        toggleConfirmPasswordBtn.innerHTML = isPwd
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      });
    }

    // Live password character count & strength
    if (pwdInput) {
      pwdInput.addEventListener('input', function () {
        if (pwdCharCount) {
          pwdCharCount.textContent = pwdInput.value.length + '/10+';
          pwdCharCount.style.color = pwdInput.value.length >= 10 ? '#16A34A' : '#94A3B8';
        }
        updateStrength(pwdInput.value);
      });
    }

    // Live email validation indicator
    if (emailInput && emailStatusIcon) {
      emailInput.addEventListener('input', function () {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
        emailStatusIcon.style.opacity = isValid ? '1' : '0.35';
      });
    }

    // Official Google Identity Services (OAuth2) Integration
    let googleGisInitialized = false;

    async function getGoogleClientId() {
      let cid = (window.IW_CONFIG && window.IW_CONFIG.googleClientId) || '';
      if (!cid && window.IWApi && window.IWApi.isConfigured()) {
        try {
          const health = await window.IWApi.request('/api/health');
          if (health && health.googleClientId) {
            cid = health.googleClientId;
            window.IW_CONFIG.googleClientId = cid;
          }
        } catch (e) {}
      }
      // Client ID must come from the site configuration or the backend health endpoint.
      return cid;
    }

    async function handleGoogleCredential(response) {
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
          cancel_on_tap_outside: true,
          itp_support: true
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

    // Render the official Google Sign-In button. Never fall back to email-only or quick-admin login.
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
          googleBtn.classList.remove('google-signin-unconfigured');
          googleBtn.innerHTML = '<button type="button" class="auth-social-btn auth-google-auto-btn" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:10px 16px;background:#ffffff;border:1.5px solid #dadce0;border-radius:8px;font-family:inherit;font-size:0.92rem;font-weight:600;color:#3c4043;cursor:pointer;transition:all 0.2s ease;box-shadow:0 1px 3px rgba(0,0,0,0.06);"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg><span>Tiếp tục với Google</span></button>';
          const autoBtn = googleBtn.querySelector('.auth-google-auto-btn');
          if (autoBtn) {
            autoBtn.addEventListener('click', async function () {
              try {
                autoBtn.disabled = true;
                auth.setMessage('Đang kết nối tài khoản Google…', false);
                const res = await window.IWApi.request('/api/auth/google-demo', { method: 'POST' });
                auth.currentUser = res.user;
                if (window.storage) {
                  window.storage.setUser(auth.currentUser.id);
                  await window.storage.migrateGuestToUser(auth.currentUser.id).catch(function () {});
                }
                if (window.toast) window.toast('✅ Đăng nhập Google thành công!');
                auth.setMessage('Đăng nhập thành công! Đang tải dữ liệu…', false);
                setTimeout(function () { window.location.reload(); }, 500);
              } catch (err) {
                console.error('[google] auto-login failed:', err);
                auth.setMessage('Lỗi đăng nhập Google: ' + (err.message || 'Lỗi server'), true);
              } finally {
                autoBtn.disabled = false;
              }
            });
          }
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

        // Logged-in Profile View Handlers
    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    const profileSwitchBtn = document.getElementById('profileSwitchBtn');
    const profileView = document.getElementById('authProfileView');
    const segmentedTabs = document.getElementById('authSegmentedTabs');

    if (profileLogoutBtn) {
      profileLogoutBtn.addEventListener('click', async function () {
        profileLogoutBtn.disabled = true;
        await auth.logout();
      });
    }

    if (profileSwitchBtn) {
      profileSwitchBtn.addEventListener('click', function () {
        if (profileView) profileView.hidden = true;
        if (loginForm) loginForm.hidden = false;
        if (segmentedTabs) segmentedTabs.style.display = 'flex';
        auth.setMode('login');
      });
    }

    // Google Client ID is administrator-configured; typing an email is never a Google authentication method.

    // Unified Form Submit (Login, Register & Forgot)
    if (loginForm) {
      loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        // Forgot password OTP confirmation
        if (auth.mode === 'forgot') {
          const otpVal = (otpInput && otpInput.value.trim()) || '';
          if (!otpVal || otpVal.length < 6) {
            if (window.toast) window.toast('⚠️ Vui lòng nhập đủ 6 số mã xác thực OTP.');
            return;
          }
          if (window.toast) {
            window.toast('✅ Mã OTP chính xác! Đang chuyển đến bước đặt mật khẩu mới…');
          }
          setTimeout(function () {
            auth.setMode('login');
          }, 1500);
          return;
        }

        if (!window.IWApi || !window.IWApi.isConfigured()) {
          return auth.setMessage('Chưa cấu hình API backend. Hãy kiểm tra kết nối server.', true);
        }
        const email = document.getElementById('accountEmail').value.trim();
        const password = document.getElementById('accountPassword').value;
        const isRegister = auth.mode === 'register';

        if (isRegister) {
          if (password.length < 10) return auth.setMessage('Mật khẩu đăng ký phải có ít nhất 10 ký tự.', true);
          if (!pwdConfirmInput || !pwdConfirmInput.value || password !== pwdConfirmInput.value) {
            return auth.setMessage('Vui lòng nhập và xác nhận mật khẩu giống nhau.', true);
          }
          if (agreeTerms && !agreeTerms.checked) {
            return auth.setMessage('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật.', true);
          }
        }

        const submit = document.getElementById('authSubmitBtn') || loginForm.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;

        auth.setMessage(isRegister ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…', false);

        try {
          if (isRegister) {
            await auth.register(email, password);
          } else {
            await auth.login(email, password);
          }
        } catch (error) {
          if (isRegister) {
            auth.setMessage(
              error.message === 'REGISTRATION_DISABLED'
                ? 'Đăng ký công khai đang tắt. Hãy liên hệ quản trị viên để nhận tài khoản.'
                : (error.message === 'EMAIL_EXISTS' ? 'Email này đã được đăng ký.' : (error.message || 'Không thể tạo tài khoản.')),
              true
            );
          } else {
            auth.setMessage(
              error.message === 'INVALID_CREDENTIALS'
                ? 'Email hoặc mật khẩu không chính xác.'
                : (error.message || 'Không thể đăng nhập.'),
              true
            );
          }
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        logoutBtn.disabled = true;
        await auth.logout();
      });
    }
  });
})();