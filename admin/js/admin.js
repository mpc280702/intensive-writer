/* Intensive Writer - Admin Portal Logic */

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
    authGate.style.display = 'flex';
    adminApp.style.display = 'none';
    if (text) setMessage(text, isError);
  }
  async function enterAdmin() {
    authGate.style.display = 'none';
    adminApp.style.display = 'flex';
    if (window.DataManager && window.DataManager.syncRemote) await window.DataManager.syncRemote();
    initAdminData();
    return true;
  }

  authGate.style.display = 'flex';
  adminApp.style.display = 'none';

  if (!window.IWApi || !window.IWApi.isConfigured()) {
    setMessage('API backend chưa được cấu hình. Hãy sửa shared/js/config.js và triển khai server.', true);
  } else {
    try {
      const session = await window.IWApi.request('/api/auth/me');
      if (session.user && session.user.role === 'admin') {
        await enterAdmin();
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
  settings: 'Cài đặt & Sao lưu dữ liệu'
};

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

  document.getElementById('quickAddPromptBtn').addEventListener('click', () => {
    openPromptModal();
  });
}

/* ---------------- OVERVIEW TAB ---------------- */
function renderOverview() {
  const prompts = DataManager.getPrompts();
  const allIdeas = DataManager.getAllIdeas();
  let totalIdeas = 0;
  Object.values(allIdeas).forEach(arr => { totalIdeas += (arr || []).length; });

  document.getElementById('metricTotalPrompts').textContent = prompts.length;
  document.getElementById('metricTotalIdeas').textContent = totalIdeas;

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

  document.getElementById('metricActiveAttempts').textContent = activeAttempts;
  document.getElementById('metricCompletedEssays').textContent = completedEssays;

  // Recent prompts table
  const tbody = document.getElementById('overviewRecentPrompts');
  const recent = prompts.slice(0, 6);
  tbody.innerHTML = recent.map(p => {
    const count = (allIdeas[p.id] || []).length;
    return `
      <tr>
        <td><span class="badge-tag ${getThemeBadgeClass(p.theme)}">${p.theme}</span></td>
        <td><strong>${p.type}</strong></td>
        <td>${p.title}</td>
        <td><span class="badge-tag badge-default">${count} ý tưởng</span></td>
        <td style="text-align:right;">
          <button class="btn-secondary btn-sm" onclick="jumpToPromptIdeas('${p.id}')">Ý tưởng</button>
        </td>
      </tr>
    `;
  }).join('');
}

function getThemeBadgeClass(theme) {
  const map = {
    Education: 'badge-edu',
    Environment: 'badge-env',
    Transportation: 'badge-trans',
    Technology: 'badge-tech',
    Health: 'badge-health'
  };
  return map[theme] || 'badge-default';
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
        <td><code>${p.id}</code></td>
        <td><span class="badge-tag ${getThemeBadgeClass(p.theme)}">${p.theme}</span></td>
        <td>${p.type}</td>
        <td style="font-weight:500;">${p.title}</td>
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
    <option value="${p.id}">[${p.theme}] ${p.id.toUpperCase()}: ${p.title.slice(0, 65)}...</option>
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
    const vocabChips = (i.vocab || []).map(v => `<span class="badge-tag badge-default" style="font-size:0.75rem;">${v}</span>`).join(' ');
    return `
      <div style="background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;padding:16px;box-shadow:var(--admin-shadow);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <h4 style="margin:0 0 6px;font-size:0.98rem;color:var(--admin-ink);">${i.text}</h4>
          <span style="font-size:0.75rem;color:var(--admin-ink-soft);">${i.id}</span>
        </div>
        <p style="margin:0 0 10px;font-size:0.88rem;color:var(--admin-ink-soft);line-height:1.5;">${i.explain}</p>
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
function renderSubmissionsTable() {
  const tbody = document.getElementById('submissionsTableBody');
  const prompts = DataManager.getPrompts();
  const list = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('iw:attempt:')) {
      const pid = k.replace('iw:attempt:', '');
      try {
        const data = JSON.parse(localStorage.getItem(k));
        const promptObj = prompts.find(p => p.id === pid) || { title: `Đề bài #${pid}` };
        list.push({ pid, prompt: promptObj, data });
      } catch (e) {}
    }
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--admin-ink-soft);padding:30px;">Chưa có học viên nào làm bài trên trình duyệt này.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const doneBlocks = Object.keys(item.data.doneBlocks || {}).length;
    
    // Average band estimate
    let sumBand = 0, countBand = 0;
    Object.values(item.data.feedback || {}).forEach(fb => {
      if (fb && fb.band_estimate) {
        sumBand += Number(fb.band_estimate);
        countBand++;
      }
    });
    const avgBand = countBand > 0 ? (sumBand / countBand).toFixed(1) : 'Chưa chấm';

    return `
      <tr>
        <td><code>${item.pid}</code></td>
        <td style="font-weight:500;">${item.prompt.title}</td>
        <td><span class="badge-tag ${doneBlocks >= 4 ? 'badge-env' : 'badge-trans'}">${doneBlocks}/4 khối</span></td>
        <td><strong>${avgBand}</strong></td>
        <td style="text-align:right;">
          <button class="btn-secondary btn-sm" onclick="viewSubmissionDetail('${item.pid}')">Xem bài</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.viewSubmissionDetail = function(pid) {
  const prompts = DataManager.getPrompts();
  const p = prompts.find(item => item.id === pid) || { title: `Đề #${pid}` };
  const raw = localStorage.getItem(`iw:attempt:${pid}`);
  if (!raw) return;
  const a = JSON.parse(raw);

  const container = document.getElementById('submissionModalContent');
  document.getElementById('submissionModalTitle').textContent = `Bài làm của đề [${pid.toUpperCase()}]`;

  const blocksInfo = [
    { key: 'intro', label: '1. Mở bài (Introduction)' },
    { key: 'body1', label: '2. Thân bài 1 (Body 1)' },
    { key: 'body2', label: '3. Thân bài 2 (Body 2)' },
    { key: 'conclusion', label: '4. Kết bài (Conclusion)' }
  ];

  container.innerHTML = `
    <p style="margin:0 0 16px;color:var(--admin-ink-soft);font-size:0.95rem;"><strong>Đề bài:</strong> ${p.title}</p>
    ${blocksInfo.map(b => {
      const text = (a.texts && a.texts[b.key]) || '';
      const fb = (a.feedback && a.feedback[b.key]) || null;
      return `
        <div style="background:#F8FAFC;border:1px solid var(--admin-border);border-radius:12px;padding:16px;margin-bottom:14px;">
          <h4 style="margin:0 0 8px;font-size:0.95rem;">${b.label}</h4>
          <p style="margin:0 0 10px;font-style:${text ? 'normal' : 'italic'};color:${text ? 'var(--admin-ink)' : 'var(--admin-ink-soft)'};line-height:1.6;white-space:pre-wrap;">${text || '(Chưa viết đoạn này)'}</p>
          ${fb && fb.band_estimate ? `
            <div style="border-top:1px dashed var(--admin-border);padding-top:8px;font-size:0.85rem;">
              <span class="badge-tag badge-edu">Band: ${fb.band_estimate}</span>
              ${fb.summary ? `<span style="margin-left:8px;color:var(--admin-ink-soft);">${fb.summary}</span>` : ''}
            </div>` : ''}
        </div>
      `;
    }).join('')}
  `;

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

  // Search & Filter listeners
  document.getElementById('promptSearchInput').addEventListener('input', renderPromptsTable);
  document.getElementById('promptThemeFilter').addEventListener('change', renderPromptsTable);

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
