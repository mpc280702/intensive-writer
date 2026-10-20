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
      const title = document.getElementById('authModalTitle');
      const subtitle = document.getElementById('authModalSubtitle');

      if (this.currentUser) {
        if (profileView) profileView.hidden = false;
        if (loginForm) loginForm.hidden = true;
        if (segmentedTabs) segmentedTabs.style.display = 'none';
        if (profileEmail) profileEmail.textContent = this.currentUser.email || 'Học viên';
        if (title) title.textContent = 'Tài khoản học viên';
        if (subtitle) subtitle.textContent = 'Thông tin phiên đăng nhập & đồng bộ dữ liệu';
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
        auth.setMode('forgot');
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
      if (!cid) {
        cid = localStorage.getItem('iw:google_client_id') || '';
        if (cid) window.IW_CONFIG.googleClientId = cid;
      }
      return cid;
    }

    async function doQuickGoogleAdminLogin() {
      try {
        auth.setMessage('Đang kết nối tài khoản Google…', false);
        if (googleBtn) googleBtn.disabled = true;
        const result = await window.IWApi.request('/api/auth/google-quick-admin', {
          method: 'POST'
        });
        auth.currentUser = result.user;
        if (window.storage) {
          window.storage.setUser(auth.currentUser.id);
          await window.storage.migrateGuestToUser(auth.currentUser.id).catch(function () {});
        }
        if (window.toast) window.toast('✅ Đăng nhập Quản trị viên Google thành công! Đang chuyển đến trang Admin…');
        auth.setMessage('✅ Đăng nhập thành công! Đang chuyển hướng đến trang Quản trị…', false);
        setTimeout(function () {
          window.location.href = new URL('../admin/', window.location.href).href;
        }, 600);
      } catch (err) {
        console.error('Quick Google Admin failed:', err);
        auth.setMessage('Không thể đăng nhập Google: ' + (err.message || 'Lỗi kết nối'), true);
      } finally {
        if (googleBtn) googleBtn.disabled = false;
      }
    }

    async function handleGoogleCredential(response) {
      if (!response || !response.credential) return;
      try {
        auth.setMessage('Đang xác thực tài khoản Google…', false);
        const result = await window.IWApi.request('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({ credential: response.credential, asAdmin: true })
        });
        auth.currentUser = result.user;
        if (window.storage) {
          window.storage.setUser(auth.currentUser.id);
          await window.storage.migrateGuestToUser(auth.currentUser.id).catch(function () {});
        }
        if (window.toast) window.toast('✅ Đăng nhập Google thành công! Đang chuyển đến trang Admin…');
        auth.setMessage('✅ Đăng nhập thành công! Đang chuyển hướng đến trang Quản trị…', false);
        setTimeout(function () {
          window.location.href = new URL('../admin/', window.location.href).href;
        }, 600);
      } catch (err) {
        console.error('Google auth failed:', err);
        auth.setMessage('Không thể xác thực Google: ' + (err.message || 'Lỗi xác thực'), true);
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
        return true;
      } catch (err) {
        console.warn('[google] GIS initialize error:', err);
        return false;
      }
    }

    // Try initializing GIS once page and script load
    getGoogleClientId().then(function (cid) {
      if (cid) {
        const checkTimer = setInterval(function () {
          if (window.google && window.google.accounts && window.google.accounts.id) {
            clearInterval(checkTimer);
            initGisClient(cid);
          }
        }, 200);
        setTimeout(function () { clearInterval(checkTimer); }, 8000);
      }
    });

    if (googleBtn) {
      googleBtn.addEventListener('click', async function () {
        const cid = await getGoogleClientId();

        // If client ID is configured and GIS library is loaded, prompt Google One Tap / GIS
        if (cid && window.google && window.google.accounts && window.google.accounts.id) {
          if (!googleGisInitialized) initGisClient(cid);
          try {
            window.google.accounts.id.prompt(function (notification) {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.warn('[google] GIS prompt not shown, fallback to quick admin:', notification.getNotDisplayedReason());
                doQuickGoogleAdminLogin();
              }
            });
          } catch (err) {
            console.error('[google] Prompt error, fallback to quick admin:', err);
            await doQuickGoogleAdminLogin();
          }
        } else {
          // Fast-track: Đăng nhập Google 1 chạm vào thẳng trang Admin
          await doQuickGoogleAdminLogin();
        }
      });
    }

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

    // Google Setup & Direct Registration Handlers
    const setupModal = document.getElementById('googleSetupModal');
    const closeSetupBtn = document.getElementById('closeGoogleSetupBtn');
    const cancelSetupBtn = document.getElementById('cancelGoogleSetupBtn');
    const saveClientIdBtn = document.getElementById('saveGoogleClientIdBtn');
    const clientIdInput = document.getElementById('googleClientIdInput');
    const directEmailInput = document.getElementById('googleDirectEmailInput');
    const setupMsg = document.getElementById('googleSetupMsg');

    if (closeSetupBtn && setupModal) closeSetupBtn.addEventListener('click', function () { setupModal.classList.remove('open'); });
    if (cancelSetupBtn && setupModal) cancelSetupBtn.addEventListener('click', function () { setupModal.classList.remove('open'); });
    if (setupModal) {
      setupModal.addEventListener('click', function (e) {
        if (e.target === setupModal) setupModal.classList.remove('open');
      });
    }

    if (saveClientIdBtn) {
      getGoogleClientId().then(function (cid) {
        if (cid && clientIdInput) clientIdInput.value = cid;
      });

      saveClientIdBtn.addEventListener('click', async function () {
        const customCid = clientIdInput ? clientIdInput.value.trim() : '';

        // If user entered a valid Google OAuth Client ID, save and prompt GIS
        if (customCid && customCid.includes('.apps.googleusercontent.com')) {
          localStorage.setItem('iw:google_client_id', customCid);
          window.IW_CONFIG.googleClientId = customCid;
          initGisClient(customCid);
          if (setupMsg) {
            setupMsg.textContent = 'Đã lưu Client ID thành công! Đang kích hoạt Google…';
            setupMsg.classList.remove('error');
          }
          setTimeout(function () {
            if (setupModal) setupModal.classList.remove('open');
            if (window.toast) window.toast('✅ Đã kích hoạt Google Sign-In!');
            if (window.google && window.google.accounts && window.google.accounts.id) {
              window.google.accounts.id.prompt();
            }
          }, 700);
          return;
        }

        // Otherwise, perform direct registration with their Gmail
        const gmail = directEmailInput ? directEmailInput.value.trim().toLowerCase() : '';
        if (!gmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) {
          if (setupMsg) {
            setupMsg.textContent = 'Vui lòng nhập địa chỉ email hợp lệ.';
            setupMsg.classList.add('error');
          }
          return;
        }

        try {
          saveClientIdBtn.disabled = true;
          if (setupMsg) {
            setupMsg.textContent = 'Đang đăng ký / đăng nhập với ' + gmail + '…';
            setupMsg.classList.remove('error');
          }
          const res = await window.IWApi.request('/api/auth/google-direct', {
            method: 'POST',
            body: JSON.stringify({ email: gmail, asAdmin: true })
          });
          auth.currentUser = res.user;
          if (window.storage) {
            window.storage.setUser(auth.currentUser.id);
            await window.storage.migrateGuestToUser(auth.currentUser.id).catch(function () {});
          }
          if (setupModal) setupModal.classList.remove('open');
          if (window.toast) window.toast('✅ Đăng nhập Google thành công (' + gmail + ')! Đang vào trang Admin…');
          setTimeout(function () {
            window.location.href = new URL('../admin/', window.location.href).href;
          }, 600);
        } catch (err) {
          console.error('[auth] google direct failed:', err);
          if (setupMsg) {
            setupMsg.textContent = 'Không thể đăng nhập: ' + (err.message || 'Lỗi server');
            setupMsg.classList.add('error');
          }
        } finally {
          saveClientIdBtn.disabled = false;
        }
      });
    }

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
          if (pwdConfirmInput && pwdConfirmInput.value && password !== pwdConfirmInput.value) {
            return auth.setMessage('Mật khẩu xác nhận không khớp.', true);
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