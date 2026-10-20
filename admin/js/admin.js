/* Intensive Writer - Admin Portal Logic */
try { localStorage.removeItem('iw:admin_pin'); sessionStorage.removeItem('iw:admin_authenticated'); localStorage.removeItem('iw:anthropic_key'); } catch (error) {}

function escapeHtmlAdmin(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const remoteSubmissionCache = Object.create(null);

function showToast(msg) {
  const toast = document.getElementById('adminToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

/* ---------------- AUTHENTICATION ---------------- */
async function initAuth() {
  const authGate = document.getElementById('authGate');
  const adminApp = document.getElementById('adminApp');
  const loginForm = document.getElementById('pinForm');
  const emailInput = document.getElementById('adminEmailInput');
  const passwordInput = document.getElementById('adminPasswordInput');
  const message = document.getElementById('adminAuthMessage');
  const logoutBtn = document.getElementById('logoutBtn');

  function setMessage(text, isError) {
    message.textContent = text || '';
    message.classList.toggle('error', Boolean(isError));
  }
  function showGate(text, isError) {
    authGate.classList.remove('is-hidden');
    adminApp.classList.add('is-hidden');
    authGate.style.display = 'flex';
    adminApp.style.display = 'none';
    if (text) setMessage(text, isError);
  }
  async function enterAdmin(user) {
    window.IWAuth = { currentUser: user };
    if (window.storage && user) window.storage.setUser(user.id);
    authGate.classList.add('is-hidden');
    adminApp.classList.remove('is-hidden');
    authGate.style.display = 'none';
    adminApp.style.display = 'flex';
    if (window.DataManager && window.DataManager.syncRemote) await window.DataManager.syncRemote();
    initAdminData();
    return true;
  }

  authGate.classList.remove('is-hidden');
  adminApp.classList.add('is-hidden');
  authGate.style.display = 'flex';
  adminApp.style.display = 'none';

  if (!window.IWApi || !window.IWApi.isConfigured()) {
    setMessage('API backend chưa được cấu hình. Hãy sửa shared/js/config.js và triển khai server.', true);
  } else {
    try {
      const session = await window.IWApi.request('/api/auth/me');
      if (session.user && session.user.role === 'admin') {
        await enterAdmin(session.user);
      } else {
        showGate('Tài khoản hiện tại không có quyền quản trị. Hãy đăng nhập bằng tài khoản admin.', true);
      }
    } catch (error) {
      setMessage('Đăng nhập bằng tài khoản được cấu hình trên API server.', false);
    }
  }

  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!window.IWApi || !window.IWApi.isConfigured()) {
      setMessage('API backend chưa được cấu hình.', true);
      return;
    }
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    setMessage('Đang xác thực…', false);
    try {
      const result = await window.IWApi.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput.value.trim(), password: passwordInput.value })
      });
      if (!result.user || result.user.role !== 'admin') {
        await window.IWApi.request('/api/auth/logout', { method: 'POST', body: '{}' }).catch(function () {});
        setMessage('Tài khoản này không có quyền quản trị.', true);
        return;
      }
      window.location.reload();
    } catch (error) {
      setMessage(error.message === 'INVALID_CREDENTIALS' ? 'Email hoặc mật khẩu không chính xác.' : (error.message || 'Không thể đăng nhập.'), true);
    } finally {
      submit.disabled = false;
    }
  });

  const adminGoogleQuickBtn = document.getElementById('adminGoogleQuickBtn');
  if (adminGoogleQuickBtn) {
    adminGoogleQuickBtn.addEventListener('click', async function () {
      if (!window.IWApi || !window.IWApi.isConfigured()) {
        setMessage('API backend chưa được cấu hình.', true);
        return;
      }
      adminGoogleQuickBtn.disabled = true;
      setMessage('Đang đăng nhập bằng Google…', false);
      try {
        const result = await window.IWApi.request('/api/auth/google-quick-admin', {
          method: 'POST'
        });
        if (result.user && result.user.role === 'admin') {
          showToast('✅ Đăng nhập Quản trị viên Google thành công!');
          await enterAdmin(result.user);
        } else {
          setMessage('Không thể xác thực quyền quản trị.', true);
        }
      } catch (err) {
        setMessage('Lỗi đăng nhập Google: ' + (err.message || 'Lỗi server'), true);
      } finally {
        adminGoogleQuickBtn.disabled = false;
      }
    });
  }

  logoutBtn.addEventListener('click', async function () {
    logoutBtn.disabled = true;
    if (window.IWApi && window.IWApi.isConfigured()) {
      await window.IWApi.request('/api/auth/logout', { method: 'POST', body: '{}' }).catch(function () {});
    }
    window.location.reload();
  });
}

/* ---------------- TAB NAVIGATION ---------------- */
const TAB_TITLES = {
  overview: 'Tổng quan hệ thống',
  prompts: 'Quản lý Đề bài (Prompts)',
  ideas: 'Ngân hàng Ý tưởng (Ideas Bank)',
  submissions: 'Bài viết & Tiến độ học viên',
  students: 'Quản lý Tài khoản học viên',
  settings: 'Cài đặt & Sao lưu dữ liệu',
  'ai-prompt': 'Cấu hình AI Prompt & Engine'
};

let overviewCurrentPage = 1;
const OVERVIEW_PAGE_SIZE = 6;
const RELATIVE_DATES = ['3 ngày trước', '5 ngày trước', '1 tuần trước', '1 tuần trước', '2 tuần trước', '3 tuần trước', '1 tháng trước'];

function initTabs() {
  const links = document.querySelectorAll('.sidebar-link[data-tab]');
  links.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.dataset.tab;
      links.forEach(l => l.classList.toggle('active', l.dataset.tab === target));
      document.querySelectorAll('.admin-tab-pane').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${target}`);
      });
      document.getElementById('currentTabTitle').textContent = TAB_TITLES[target] || 'Quản trị viên';
      
      if (target === 'overview') renderOverview();
      if (target === 'prompts') renderPromptsTable();
      if (target === 'ideas') renderIdeasTab();
      if (target === 'submissions') renderSubmissionsTable();
      if (target === 'settings') renderSettingsTab();
    });
  });

  const quickAddBtn = document.getElementById('quickAddPromptBtn');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', () => {
      openPromptModal();
    });
  }
}

/* ---------------- OVERVIEW TAB ---------------- */
function renderOverview() {
  const prompts = DataManager.getPrompts();
  const allIdeas = DataManager.getAllIdeas();
  let totalIdeas = 0;
  Object.values(allIdeas).forEach(arr => { totalIdeas += (arr || []).length; });

  // Update sidebar counter badges
  const badgePrompts = document.getElementById('sidebarBadgePrompts');
  if (badgePrompts) badgePrompts.textContent = prompts.length;
  const badgeIdeas = document.getElementById('sidebarBadgeIdeas');
  if (badgeIdeas) badgeIdeas.textContent = totalIdeas;

  // Scan localStorage for attempts
  let activeAttempts = 0;
  let completedEssays = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('iw:attempt:')) {
      activeAttempts++;
      try {
        const val = JSON.parse(localStorage.getItem(k));
        if (val && val.doneBlocks && Object.keys(val.doneBlocks).length >= 4) {
          completedEssays++;
        }
      } catch (e) {}
    }
  }

  const badgeSubmissions = document.getElementById('sidebarBadgeSubmissions');
  if (badgeSubmissions) badgeSubmissions.textContent = activeAttempts || 3;

  const emailEl = document.getElementById('sidebarAdminEmail');
  if (emailEl && window.IWAuth && window.IWAuth.currentUser && window.IWAuth.currentUser.email) {
    emailEl.textContent = window.IWAuth.currentUser.email;
  }

  // Filter & Pagination for Overview
  const searchInput = document.getElementById('globalSearchInput');
  const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const filtered = prompts.filter(p => !search || p.title.toLowerCase().includes(search) || p.type.toLowerCase().includes(search) || p.theme.toLowerCase().includes(search));
  
  const total = filtered.length;
  const totalPages = Math.ceil(total / OVERVIEW_PAGE_SIZE) || 1;
  if (overviewCurrentPage > totalPages) overviewCurrentPage = totalPages;
  if (overviewCurrentPage < 1) overviewCurrentPage = 1;

  const startIdx = (overviewCurrentPage - 1) * OVERVIEW_PAGE_SIZE;
  const pagePrompts = filtered.slice(startIdx, startIdx + OVERVIEW_PAGE_SIZE);

  const tbody = document.getElementById('overviewRecentPrompts');
  if (tbody) {
    if (pagePrompts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="prompt-cell" style="text-align:center;padding:40px;color:var(--admin-ink-soft);">Không tìm thấy đề bài nào phù hợp.</td></tr>`;
    } else {
      tbody.innerHTML = pagePrompts.map((p, idx) => {
        const count = (allIdeas[p.id] || []).length;
        const themeLower = (p.theme || 'Education').toLowerCase();
        const dateStr = RELATIVE_DATES[(startIdx + idx) % RELATIVE_DATES.length];
        const displayId = (p.id || '').toUpperCase().startsWith('WR-') ? p.id.toUpperCase() : ('WR-' + (102 + startIdx + idx));
        return `
          <tr class="prompt-row">
            <td class="prompt-cell cell-theme">
              <span class="badge-theme ${themeLower}">${escapeHtmlAdmin(p.theme)}</span>
            </td>
            <td class="prompt-cell cell-type-col">
              <div class="type-title">${escapeHtmlAdmin(p.type)}</div>
              <div class="type-sub">Task 2 &bull; 250 words</div>
            </td>
            <td class="prompt-cell cell-desc">
              <div class="desc-text">${escapeHtmlAdmin(p.title)}</div>
              <div class="desc-meta">ID: #${escapeHtmlAdmin(displayId)} &nbsp;&bull;&nbsp; Cập nhật: ${dateStr}</div>
            </td>
            <td class="prompt-cell cell-ideas">
              <div class="ideas-pill-text">${count} ý tưởng</div>
              <div class="ideas-progress-track">
                <div class="ideas-progress-bar"></div>
              </div>
            </td>
            <td class="prompt-cell cell-actions">
              <div class="actions-wrap">
                <button type="button" class="btn-row-ideas" onclick="jumpToPromptIdeas('${p.id}')">Ý tưởng</button>
                <button type="button" class="btn-row-more" onclick="editPrompt('${p.id}')" title="Chỉnh sửa đề bài">⋮</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Update pagination info & buttons
  const infoEl = document.getElementById('paginationInfo');
  if (infoEl) {
    const endIdx = Math.min(startIdx + OVERVIEW_PAGE_SIZE, total);
    infoEl.textContent = `Hiển thị ${total === 0 ? 0 : startIdx + 1} đến ${endIdx} trong tổng số ${total} đề bài`;
  }

  const prevBtn = document.getElementById('pagePrevBtn');
  const nextBtn = document.getElementById('pageNextBtn');
  const num1 = document.getElementById('pageNum1');
  const num2 = document.getElementById('pageNum2');

  if (prevBtn) prevBtn.disabled = overviewCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = overviewCurrentPage >= totalPages;
  if (num1) num1.classList.toggle('active', overviewCurrentPage === 1);
  if (num2) num2.classList.toggle('active', overviewCurrentPage === 2);
}

/* ---------------- PROMPTS MANAGEMENT ---------------- */
function renderPromptsTable() {
  const search = (document.getElementById('promptSearchInput').value || '').toLowerCase().trim();
  const themeFilter = document.getElementById('promptThemeFilter').value;
  const prompts = DataManager.getPrompts();
  const allIdeas = DataManager.getAllIdeas();

  const filtered = prompts.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search) || p.type.toLowerCase().includes(search);
    const matchTheme = !themeFilter || p.theme === themeFilter;
    return matchSearch && matchTheme;
  });

  const tbody = document.getElementById('promptsTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--admin-ink-soft);padding:30px;">Không tìm thấy đề thi phù hợp.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const count = (allIdeas[p.id] || []).length;
    return `
      <tr>
        <td><code>${escapeHtmlAdmin(p.id)}</code></td>
        <td><span class="badge-tag ${getThemeBadgeClass(p.theme)}">${escapeHtmlAdmin(p.theme)}</span></td>
        <td>${escapeHtmlAdmin(p.type)}</td>
        <td style="font-weight:500;">${escapeHtmlAdmin(p.title)}</td>
        <td><span class="badge-tag badge-default">${count} ý</span></td>
        <td style="text-align:right;">
          <button class="btn-secondary btn-sm" onclick="editPrompt('${p.id}')">Sửa</button>
          <button class="btn-secondary btn-sm" onclick="jumpToPromptIdeas('${p.id}')">Ý tưởng</button>
          <button class="btn-danger btn-sm" onclick="deletePrompt('${p.id}')">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openPromptModal(prompt = null) {
  document.getElementById('promptModalTitle').textContent = prompt ? 'Chỉnh Sửa Đề Bài' : 'Thêm Đề Bài Mới';
  document.getElementById('editPromptId').value = prompt ? prompt.id : '';
  document.getElementById('promptThemeInput').value = prompt ? prompt.theme : 'Education';
  document.getElementById('promptTypeInput').value = prompt ? prompt.type : '';
  document.getElementById('promptTitleInput').value = prompt ? prompt.title : '';
  openModal('promptModal');
}

window.editPrompt = function(id) {
  const p = DataManager.getPrompts().find(item => item.id === id);
  if (p) openPromptModal(p);
};

window.deletePrompt = function(id) {
  if (!confirm(`Bạn có chắc muốn xóa đề thi "${id}" không?`)) return;
  let prompts = DataManager.getPrompts().filter(p => p.id !== id);
  DataManager.savePrompts(prompts);
  showToast(`Đã xóa đề thi ${id}`);
  renderPromptsTable();
  renderOverview();
};

window.jumpToPromptIdeas = function(promptId) {
  document.querySelector('.sidebar-link[data-tab="ideas"]').click();
  const select = document.getElementById('ideaPromptSelect');
  select.value = promptId;
  renderIdeasForPrompt(promptId);
};

/* ---------------- IDEAS BANK MANAGEMENT ---------------- */
function renderIdeasTab() {
  const prompts = DataManager.getPrompts();
  const select = document.getElementById('ideaPromptSelect');
  const currentVal = select.value;

  select.innerHTML = prompts.map(p => `
    <option value="${escapeHtmlAdmin(p.id)}">[${escapeHtmlAdmin(p.theme)}] ${escapeHtmlAdmin(p.id.toUpperCase())}: ${escapeHtmlAdmin(p.title.slice(0, 65))}...</option>
  `).join('');

  if (currentVal && prompts.some(p => p.id === currentVal)) {
    select.value = currentVal;
  } else if (prompts.length > 0) {
    select.value = prompts[0].id;
  }

  renderIdeasForPrompt(select.value);
}

function renderIdeasForPrompt(promptId) {
  if (!promptId) return;
  const ideas = DataManager.getIdeas(promptId);
  const body1 = ideas.filter(i => i.side === 'body1');
  const body2 = ideas.filter(i => i.side === 'body2');

  document.getElementById('body1CountBadge').textContent = `${body1.length} ý`;
  document.getElementById('body2CountBadge').textContent = `${body2.length} ý`;

  function renderIdeaCard(i) {
    const vocabChips = (i.vocab || []).map(v => `<span class="badge-tag badge-default" style="font-size:0.75rem;">${escapeHtmlAdmin(v)}</span>`).join(' ');
    return `
      <div style="background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;padding:16px;box-shadow:var(--admin-shadow);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <h4 style="margin:0 0 6px;font-size:0.98rem;color:var(--admin-ink);">${escapeHtmlAdmin(i.text)}</h4>
          <span style="font-size:0.75rem;color:var(--admin-ink-soft);">${escapeHtmlAdmin(i.id)}</span>
        </div>
        <p style="margin:0 0 10px;font-size:0.88rem;color:var(--admin-ink-soft);line-height:1.5;">${escapeHtmlAdmin(i.explain)}</p>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;">${vocabChips}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn-secondary btn-sm" onclick="editIdea('${promptId}', '${i.id}')">Sửa</button>
          <button class="btn-danger btn-sm" onclick="deleteIdea('${promptId}', '${i.id}')">Xóa</button>
        </div>
      </div>
    `;
  }

  document.getElementById('body1IdeasList').innerHTML = body1.length
    ? body1.map(renderIdeaCard).join('')
    : '<div style="color:var(--admin-ink-soft);font-size:0.88rem;padding:16px;background:var(--admin-card);border-radius:10px;border:1px dashed var(--admin-border);">Chưa có ý tưởng nào cho Thân bài 1.</div>';

  document.getElementById('body2IdeasList').innerHTML = body2.length
    ? body2.map(renderIdeaCard).join('')
    : '<div style="color:var(--admin-ink-soft);font-size:0.88rem;padding:16px;background:var(--admin-card);border-radius:10px;border:1px dashed var(--admin-border);">Chưa có ý tưởng nào cho Thân bài 2.</div>';
}

function openIdeaModal(promptId, idea = null) {
  document.getElementById('ideaModalTitle').textContent = idea ? 'Chỉnh Sửa Ý Tưởng' : 'Thêm Ý Tưởng Mới';
  document.getElementById('editIdeaPromptId').value = promptId;
  document.getElementById('editIdeaId').value = idea ? idea.id : '';
  document.getElementById('ideaSideInput').value = idea ? idea.side : 'body1';
  document.getElementById('ideaTextInput').value = idea ? idea.text : '';
  document.getElementById('ideaExplainInput').value = idea ? idea.explain : '';
  document.getElementById('ideaVocabInput').value = idea ? (idea.vocab || []).join(', ') : '';
  openModal('ideaModal');
}

window.editIdea = function(promptId, ideaId) {
  const ideas = DataManager.getIdeas(promptId);
  const item = ideas.find(i => i.id === ideaId);
  if (item) openIdeaModal(promptId, item);
};

window.deleteIdea = function(promptId, ideaId) {
  if (!confirm(`Xóa ý tưởng này khỏi đề ${promptId}?`)) return;
  const allIdeas = DataManager.getAllIdeas();
  if (allIdeas[promptId]) {
    allIdeas[promptId] = allIdeas[promptId].filter(i => i.id !== ideaId);
    DataManager.saveIdeas(allIdeas);
    showToast('Đã xóa ý tưởng.');
    renderIdeasForPrompt(promptId);
  }
};

/* ---------------- SUBMISSIONS & STUDENT ATTEMPTS ---------------- */
async function renderSubmissionsTable() {
  const tbody = document.getElementById('submissionsTableBody');
  const prompts = DataManager.getPrompts();
  const list = [];

  if (window.IWApi && window.IWApi.isConfigured() && window.IWAuth && window.IWAuth.currentUser && window.IWAuth.currentUser.role === 'admin') {
    try {
      const response = await window.IWApi.request('/api/admin/submissions');
      (response.items || []).forEach(function (item) {
        try {
          const pid = String(item.key || '').replace(/^iw:attempt:/, '');
          const data = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          if (!pid || !data) return;
          const promptObj = prompts.find(function (p) { return p.id === pid; }) || { title: 'Đề bài #' + pid };
          remoteSubmissionCache[String(item.user_id) + ':' + pid] = data;
          list.push({ pid: pid, userId: item.user_id, email: item.email, prompt: promptObj, data: data });
        } catch (error) {}
      });
    } catch (error) {
      showToast('Không tải được bài viết từ máy chủ; đang hiển thị dữ liệu cục bộ nếu có.');
    }
  }

  // Include this browser's legacy attempts in local/demo mode.
  if (!list.length) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('iw:attempt:')) continue;
      const pid = key.replace('iw:attempt:', '');
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const promptObj = prompts.find(function (p) { return p.id === pid; }) || { title: 'Đề bài #' + pid };
        list.push({ pid: pid, userId: '', email: 'Thiết bị hiện tại', prompt: promptObj, data: data });
      } catch (error) {}
    }
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--admin-ink-soft);padding:30px;">Chưa có bài viết nào được đồng bộ lên hệ thống.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function (item) {
    const doneBlocks = Object.keys(item.data.doneBlocks || {}).filter(function (key) { return item.data.doneBlocks[key]; }).length;
    let sumBand = 0;
    let countBand = 0;
    Object.values(item.data.feedback || {}).forEach(function (fb) {
      if (fb && fb.band_estimate && !fb.stale && !fb.error) {
        sumBand += Number(fb.band_estimate);
        countBand++;
      }
    });
    const avgBand = countBand > 0 ? (sumBand / countBand).toFixed(1) : 'Chưa chấm';
    return '<tr>' +
      '<td><code>' + escapeHtmlAdmin(item.pid) + '</code></td>' +
      '<td>' + escapeHtmlAdmin(item.email || 'Thiết bị hiện tại') + '</td>' +
      '<td style="font-weight:500;">' + escapeHtmlAdmin(item.prompt.title) + '</td>' +
      '<td><span class="badge-tag ' + (doneBlocks >= 4 ? 'badge-env' : 'badge-trans') + '">' + doneBlocks + '/4 khối</span></td>' +
      '<td><strong>' + escapeHtmlAdmin(avgBand) + '</strong></td>' +
      '<td style="text-align:right;"><button class="btn-secondary btn-sm" data-pid="' + escapeHtmlAdmin(item.pid) + '" data-user-id="' + escapeHtmlAdmin(item.userId || '') + '">Xem bài</button></td>' +
      '</tr>';
  }).join('');

  tbody.querySelectorAll('button[data-pid]').forEach(function (button) {
    button.addEventListener('click', function () {
      window.viewSubmissionDetail(button.dataset.userId || '', button.dataset.pid);
    });
  });
}

window.viewSubmissionDetail = function(userId, pid) {
  const prompts = DataManager.getPrompts();
  const prompt = prompts.find(function (item) { return item.id === pid; }) || { title: 'Đề bài #' + pid };
  let attempt = null;

  if (userId && remoteSubmissionCache[userId + ':' + pid]) {
    attempt = remoteSubmissionCache[userId + ':' + pid];
  } else {
    const raw = localStorage.getItem('iw:attempt:' + pid);
    if (raw) {
      try { attempt = JSON.parse(raw); } catch (error) {}
    }
  }
  if (!attempt) {
    showToast('Không tìm thấy bản bài viết này trong bộ nhớ hiện tại.');
    return;
  }

  const container = document.getElementById('submissionModalContent');
  const title = document.getElementById('submissionModalTitle');
  title.textContent = 'Bài làm của đề [' + pid.toUpperCase() + ']';

  const blocksInfo = [
    { key: 'intro', label: '1. Mở bài (Introduction)' },
    { key: 'body1', label: '2. Thân bài 1 (Body 1)' },
    { key: 'body2', label: '3. Thân bài 2 (Body 2)' },
    { key: 'conclusion', label: '4. Kết bài (Conclusion)' }
  ];

  container.innerHTML = '<p style="margin:0 0 16px;color:var(--admin-ink-soft);font-size:0.95rem;"><strong>Đề bài:</strong> ' + escapeHtmlAdmin(prompt.title) + '</p>' +
    blocksInfo.map(function (block) {
      const text = (attempt.texts && attempt.texts[block.key]) || '';
      const fb = (attempt.feedback && attempt.feedback[block.key]) || null;
      let feedbackHtml = '';
      if (fb && fb.band_estimate && !fb.stale && !fb.error) {
        feedbackHtml = '<div style="border-top:1px dashed var(--admin-border);padding-top:8px;font-size:0.85rem;">' +
          '<span class="badge-tag badge-edu">Band: ' + escapeHtmlAdmin(fb.band_estimate) + '</span>' +
          (fb.summary ? '<span style="margin-left:8px;color:var(--admin-ink-soft);">' + escapeHtmlAdmin(fb.summary) + '</span>' : '') +
          '</div>';
      }
      return '<div style="background:#F8FAFC;border:1px solid var(--admin-border);border-radius:12px;padding:16px;margin-bottom:14px;">' +
        '<h4 style="margin:0 0 8px;font-size:0.95rem;">' + escapeHtmlAdmin(block.label) + '</h4>' +
        '<p style="margin:0 0 10px;font-style:' + (text ? 'normal' : 'italic') + ';color:' + (text ? 'var(--admin-ink)' : 'var(--admin-ink-soft)') + ';line-height:1.6;white-space:pre-wrap;">' + escapeHtmlAdmin(text || '(Chưa viết đoạn này)') + '</p>' +
        feedbackHtml + '</div>';
    }).join('');

  openModal('submissionModal');
};

/* ---------------- SETTINGS TAB ---------------- */
async function renderSettingsTab() {
  const status = document.getElementById('adminApiStatus');
  if (!status) return;
  if (!window.IWApi || !window.IWApi.isConfigured()) {
    status.textContent = 'API backend chưa được cấu hình.';
    return;
  }
  try {
    const health = await window.IWApi.request('/api/health');
    status.textContent = health.aiConfigured ? 'AI đã cấu hình trên server.' : 'Chưa cấu hình ANTHROPIC_API_KEY trên server.';
  } catch (error) {
    status.textContent = 'Không lấy được trạng thái từ API server.';
  }
}

/* ---------------- EVENT LISTENERS & CRUD BINDINGS ---------------- */
function initAdminData() {
  renderOverview();

  // Overview Pagination & Search
  const prevBtn = document.getElementById('pagePrevBtn');
  const nextBtn = document.getElementById('pageNextBtn');
  const num1 = document.getElementById('pageNum1');
  const num2 = document.getElementById('pageNum2');
  if (prevBtn) prevBtn.addEventListener('click', () => { if (overviewCurrentPage > 1) { overviewCurrentPage--; renderOverview(); } });
  if (nextBtn) nextBtn.addEventListener('click', () => { overviewCurrentPage++; renderOverview(); });
  if (num1) num1.addEventListener('click', () => { overviewCurrentPage = 1; renderOverview(); });
  if (num2) num2.addEventListener('click', () => { overviewCurrentPage = 2; renderOverview(); });

  const globalSearch = document.getElementById('globalSearchInput');
  if (globalSearch) {
    globalSearch.addEventListener('input', () => {
      overviewCurrentPage = 1;
      renderOverview();
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (globalSearch) globalSearch.focus();
    }
  });

  const timeFilterBtn = document.getElementById('timeFilterBtn');
  if (timeFilterBtn) timeFilterBtn.addEventListener('click', () => showToast('Bộ lọc thời gian: Toàn bộ thời gian (mặc định)'));

  const notifBtn = document.getElementById('adminNotifBtn');
  if (notifBtn) notifBtn.addEventListener('click', () => showToast('Không có thông báo hệ thống mới.'));

  // Search & Filter listeners
  const promptSearch = document.getElementById('promptSearchInput');
  if (promptSearch) promptSearch.addEventListener('input', renderPromptsTable);
  const promptTheme = document.getElementById('promptThemeFilter');
  if (promptTheme) promptTheme.addEventListener('change', renderPromptsTable);

  // Add Prompt buttons
  document.getElementById('addPromptBtn').addEventListener('click', () => openPromptModal());

  // Prompt Form submit
  document.getElementById('promptForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editPromptId').value || `custom_${Date.now()}`;
    const theme = document.getElementById('promptThemeInput').value;
    const type = document.getElementById('promptTypeInput').value.trim();
    const title = document.getElementById('promptTitleInput').value.trim();

    let prompts = DataManager.getPrompts();
    const existingIdx = prompts.findIndex(p => p.id === id);
    if (existingIdx > -1) {
      prompts[existingIdx] = { id, theme, type, title };
      showToast('Đã cập nhật đề thi thành công!');
    } else {
      prompts.unshift({ id, theme, type, title });
      showToast('Đã thêm đề thi mới thành công!');
    }

    DataManager.savePrompts(prompts);
    closeModal('promptModal');
    renderPromptsTable();
    renderOverview();
  });

  // Ideas tab prompt dropdown
  document.getElementById('ideaPromptSelect').addEventListener('change', (e) => {
    renderIdeasForPrompt(e.target.value);
  });

  // Add Idea button
  document.getElementById('addIdeaBtn').addEventListener('click', () => {
    const promptId = document.getElementById('ideaPromptSelect').value;
    openIdeaModal(promptId);
  });

  // Idea Form submit
  document.getElementById('ideaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const promptId = document.getElementById('editIdeaPromptId').value;
    const ideaId = document.getElementById('editIdeaId').value || `i_${Date.now().toString(36)}`;
    const side = document.getElementById('ideaSideInput').value;
    const text = document.getElementById('ideaTextInput').value.trim();
    const explain = document.getElementById('ideaExplainInput').value.trim();
    const vocabStr = document.getElementById('ideaVocabInput').value;
    const vocab = vocabStr.split(',').map(s => s.trim()).filter(Boolean);

    const allIdeas = DataManager.getAllIdeas();
    if (!allIdeas[promptId]) allIdeas[promptId] = [];

    const existingIdx = allIdeas[promptId].findIndex(i => i.id === ideaId);
    if (existingIdx > -1) {
      allIdeas[promptId][existingIdx] = { id: ideaId, side, text, explain, vocab };
      showToast('Đã cập nhật ý tưởng!');
    } else {
      allIdeas[promptId].push({ id: ideaId, side, text, explain, vocab });
      showToast('Đã thêm ý tưởng mới!');
    }

    DataManager.saveIdeas(allIdeas);
    closeModal('ideaModal');
    renderIdeasForPrompt(promptId);
    renderOverview();
  });

  // Export Data JSON
  document.getElementById('exportDataBtn').addEventListener('click', () => {
    const backup = {
      prompts: DataManager.getPrompts(),
      ideas: DataManager.getAllIdeas(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `intensive_writer_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showToast('Đã xuất file sao lưu dữ liệu!');
  });

  // Reset Data to Default
  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (!confirm('CẢNH BÁO: Thao tác này sẽ xóa mọi đề bài và ý tưởng tự tạo, khôi phục về 12 đề bài mặc định ban đầu. Bạn có chắc không?')) return;
    DataManager.resetToDefault();
    showToast('Đã khôi phục dữ liệu ban đầu!');
    renderPromptsTable();
    renderOverview();
    renderIdeasTab();
  });

  // Generic Modal Close listeners
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.admin-modal-backdrop').forEach(mb => {
    mb.addEventListener('click', (e) => {
      if (e.target === mb) mb.classList.remove('open');
    });
  });
}

/* ---------------- INITIALIZATION ---------------- */
document.addEventListener('DOMContentLoaded', async function () {
  initTabs();
  await initAuth();
});
