/* Intensive Writer - Main Application Logic */

/* ---------------- TEXT HELPERS ---------------- */
function stripListMarker(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cleanText(str) {
  return escapeHtml(stripListMarker(str));
}

function renderParagraphs(text) {
  if (!text) return '';
  const blocks = String(text).replace(/\r/g, '').split(/\n\s*\n/).map(function (block) { return block.trim(); }).filter(Boolean);
  const output = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const rendered = [];
    let paragraphLines = [];
    let listItems = [];
    let listType = null;
    function flushParagraph() {
      if (!paragraphLines.length) return;
      rendered.push('<p>' + escapeHtml(paragraphLines.join(' ').trim()) + '</p>');
      paragraphLines = [];
    }
    function flushList() {
      if (!listItems.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      rendered.push('<' + tag + '>' + listItems.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</' + tag + '>');
      listItems = [];
      listType = null;
    }
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const bullet = line.match(/^[-*•]\s+(.+)$/);
      const numbered = line.match(/^\d+[.)]\s+(.+)$/);
      if (bullet || numbered) {
        flushParagraph();
        const nextType = numbered ? 'ol' : 'ul';
        if (listType && listType !== nextType) flushList();
        listType = nextType;
        listItems.push((bullet || numbered)[1].trim());
      } else {
        flushList();
        paragraphLines.push(line);
      }
    }
    flushParagraph();
    flushList();
    output.push(rendered.join(''));
  }
  return output.join('');
}
function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/* ---------------- STATE ---------------- */
let stats = { essaysCompleted: 0, secondsSpent: 0, errorCounts: {}, praisedPhrases: [] };
let attempts = {}; // promptId -> { ideasSelected, texts:{}, feedback:{}, doneBlocks:{}, outline }
let explorationCache = {}; // ideaId -> { explanation_vi, examples_vi, use_cases, example_sentence }
let practice = { stage: 'prompts', promptId: null, openBlock: null, drawerIdeaId: null };
let timerHandle = null;

/* ---------------- STORAGE LIFECYCLE ---------------- */
async function loadState() {
  try {
    const s = await window.storage.get('iw:stats');
    if (s && s.value) stats = JSON.parse(s.value);
  } catch (e) {
    console.warn('Error loading stats', e);
  }

  try {
    const list = await window.storage.list('iw:attempt:');
    if (list && list.keys) {
      for (const k of list.keys) {
        try {
          const r = await window.storage.get(k);
          if (r && r.value) {
            const pid = k.replace('iw:attempt:', '');
            attempts[pid] = JSON.parse(r.value);
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Error loading attempts', e);
  }

  try {
    const list = await window.storage.list('iw:explore:');
    if (list && list.keys) {
      for (const k of list.keys) {
        try {
          const r = await window.storage.get(k);
          if (r && r.value) {
            const iid = k.replace('iw:explore:', '');
            explorationCache[iid] = JSON.parse(r.value);
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Error loading explorations', e);
  }
}

async function saveStats() {
  await safeSet('iw:stats', stats, 'stats');
}

async function saveAttempt(pid) {
  await safeSet('iw:attempt:' + pid, attempts[pid], 'attempt:' + pid);
}

async function saveExploration(ideaId) {
  await safeSet('iw:explore:' + ideaId, explorationCache[ideaId], 'explore:' + ideaId);
}

function getAttempt(pid) {
  if (!attempts[pid]) {
    attempts[pid] = { ideasSelected: [], texts: {}, feedback: {}, doneBlocks: {}, outline: null };
  }
  if (attempts[pid].outline === undefined) attempts[pid].outline = null;
  return attempts[pid];
}

/* ---------------- TIMER ---------------- */
function startTimer() {
  if (timerHandle) return;
  let lastActivityAt = Date.now();
  ['pointerdown', 'keydown', 'input', 'touchstart', 'scroll'].forEach(function (eventName) {
    document.addEventListener(eventName, function () { lastActivityAt = Date.now(); }, { passive: true });
  });
  timerHandle = setInterval(() => {
    const active = document.visibilityState === 'visible' && (Date.now() - lastActivityAt) < 60000;
    if (active) {
      stats.secondsSpent += 10;
      saveStats();
      if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
    }
  }, 10000);
}

/* ---------------- TABS & NAVIGATION ---------------- */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('view-practice').classList.toggle('active', tab === 'practice');
  document.getElementById('view-dashboard').classList.toggle('active', tab === 'dashboard');
  if (tab === 'dashboard') renderDashboard();
}

function updateAIStatusBadge() {
  const badge = document.getElementById('aiStatusBadge');
  if (badge) badge.remove();
}

/* ---------------- RENDER: PRACTICE ---------------- */
function renderPractice() {
  PROMPTS = DataManager.getPrompts();
  IDEAS = DataManager.getAllIdeas();
  const el = document.getElementById('view-practice');
  if (practice.stage === 'prompts') renderPrompts(el);
  else if (practice.stage === 'ideasBank') renderIdeasBank(el);
  else if (practice.stage === 'outline') renderOutline(el);
  else if (practice.stage === 'writing') renderWriting(el);
  renderServiceModeNotice(el);
}

function renderServiceModeNotice(el) {
  if (!el) return;
  const apiConfigured = Boolean(window.IWApi && window.IWApi.isConfigured && window.IWApi.isConfigured());
  const signedIn = Boolean(window.IWAuth && window.IWAuth.currentUser);
  if (apiConfigured && signedIn) return;

  const message = apiConfigured
    ? 'Bạn đang chưa đăng nhập. Bản nháp vẫn được lưu trên thiết bị; đăng nhập để đồng bộ và dùng AI qua server.'
    : 'Bạn đang dùng bản demo cục bộ. Bản nháp chỉ lưu trên trình duyệt này và phản hồi là gợi ý offline, không phải chấm AI hay band IELTS chính thức.';
  const notice = document.createElement('div');
  notice.className = 'service-mode-notice';
  notice.setAttribute('role', 'status');
  notice.style.cssText = 'margin:0 0 18px;padding:12px 14px;border:1px solid #F5C56A;border-radius:10px;background:#FFF8E8;color:#694B10;font-size:.92rem;line-height:1.5;';
  notice.innerHTML = '<strong>' + (apiConfigured ? 'Chế độ chưa đồng bộ' : 'Chế độ demo cục bộ') + '</strong><br>' + escapeHtml(message);
  el.prepend(notice);
}

/* PROMPTS SELECTION SCREEN */
function renderPrompts(el) {
  el.innerHTML = `
    <div class="section-label">Đề bài trong khóa học</div>
    ${THEMES.map(theme => {
      const themePrompts = PROMPTS.filter(p => p.theme === theme);
      return `
      <div class="theme-block">
        <h3 class="theme-heading">${escapeHtml(theme)}</h3>
        <div class="prompt-grid">
          ${themePrompts.map(p => {
            const a = attempts[p.id];
            const done = a && BLOCKS.every(b => a.doneBlocks && a.doneBlocks[b.key]);
            const started = a && (a.ideasSelected && a.ideasSelected.length > 0);
            return `
            <div class="prompt-card" data-pid="${p.id}">
              <div>
                <span class="tag">${escapeHtml(p.type)}</span>
                <h3>${escapeHtml(p.title)}</h3>
              </div>
              <div class="prompt-status ${done ? '' : (started ? 'progress' : 'todo')}">
                <span class="dot"></span>
                ${done ? 'Đã hoàn thành bài viết' : (started ? 'Đang thực hiện' : 'Chưa làm')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
  `;

  el.querySelectorAll('.prompt-card').forEach(c => {
    c.addEventListener('click', () => {
      practice.promptId = c.dataset.pid;
      const a = getAttempt(practice.promptId);
      const hasWritingProgress = BLOCKS.some(b => a.texts[b.key] || a.doneBlocks[b.key]);
      if (hasWritingProgress) {
        practice.stage = 'writing';
      } else if (a.outline) {
        practice.stage = 'outline';
      } else {
        practice.stage = 'ideasBank';
      }
      practice.openBlock = null;
      renderPractice();
    });
  });
}

/* IDEAS BANK STAGE */
function renderIdeasBank(el) {
  const prompt = PROMPTS.find(p => p.id === practice.promptId);
  const ideas = IDEAS[practice.promptId] || [];
  const a = getAttempt(practice.promptId);
  const selectedCount = a.ideasSelected.length;
  const canGenerate = selectedCount >= 2;

  el.innerHTML = `
    <div class="flow-header">
      <button class="back-btn" id="backToPrompts" title="Quay lại danh sách đề">←</button>
      <div class="section-label" style="margin:0;">Ideas Bank — Khám phá ý tưởng</div>
    </div>
    <p class="prompt-title-recap"><strong>${escapeHtml(prompt.type)}:</strong> ${escapeHtml(prompt.title)}</p>
    <p style="font-size:0.95rem;color:var(--ink-soft);margin:-10px 0 20px;">
      Bấm <strong>Khám phá</strong> để hiểu tường tận ngữ cảnh và ví dụ thực tế tại Việt Nam. Chọn ít nhất <strong>2 ý tưởng</strong> để hệ thống kiến tạo dàn ý hoàn chỉnh.
    </p>

    <div class="ideas-bank-layout">
      <div class="idea-bank-grid">
        ${ideas.map(i => {
          const explored = !!explorationCache[i.id];
          const selected = a.ideasSelected.includes(i.id);
          const sideLabel = i.side === 'body1' ? 'Thân bài 1' : 'Thân bài 2';
          return `
          <div class="idea-bank-card ${selected ? 'selected' : ''}" data-iid="${i.id}">
            <div class="badges">
              <span class="badge badge-side">${sideLabel}</span>
              ${explored ? '<span class="badge badge-explored">Đã khám phá</span>' : ''}
              ${selected ? '<span class="badge badge-selected">✓ Đã chọn</span>' : ''}
            </div>
            <h4>${escapeHtml(i.text)}</h4>
            <p class="idea-summary">${cleanText(i.explain)}</p>
            <div class="idea-card-actions">
              <button class="ghost-btn small explore-btn" data-iid="${i.id}">Khám phá</button>
              <button class="primary-btn small select-btn" data-iid="${i.id}">${selected ? 'Bỏ chọn' : 'Chọn ý này'}</button>
            </div>
          </div>`;
        }).join('')}
      </div>

      <aside class="selected-panel">
        <h4>
          <span>Ý tưởng đã chọn</span>
          <span class="mono count-badge">${selectedCount}</span>
        </h4>
        ${selectedCount ? `
          <div class="selected-list">
            ${a.ideasSelected.map(iid => {
              const idea = ideas.find(i => i.id === iid);
              if (!idea) return '';
              return `<div class="selected-chip-row" data-iid="${iid}">
                <span>${escapeHtml(idea.text)}</span>
                <button class="remove-chip" data-iid="${iid}" aria-label="Bỏ chọn">✕</button>
              </div>`;
            }).join('')}
          </div>
        ` : `<p class="empty-note">Chưa chọn ý tưởng nào. Hãy khám phá và chọn ít nhất 2 ý tưởng cho 2 thân bài.</p>`}
        <button class="primary-btn" id="generateOutlineBtn" style="width:100%;margin-top:16px;" ${canGenerate ? '' : 'disabled'}>
          Tạo dàn ý (Generate Outline) →
        </button>
      </aside>
    </div>

    <div class="drawer-backdrop" id="drawerBackdrop" style="display:none;"></div>
    <div class="drawer" id="ideaDrawer" style="display:none;"></div>
  `;

  el.querySelector('#backToPrompts').addEventListener('click', () => {
    practice.stage = 'prompts';
    renderPractice();
  });

  function toggleSelect(iid) {
    const idx = a.ideasSelected.indexOf(iid);
    if (idx > -1) {
      a.ideasSelected.splice(idx, 1);
    } else {
      a.ideasSelected.push(iid);
    }
    saveAttempt(practice.promptId);
    renderIdeasBank(el);
  }

  el.querySelectorAll('.select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelect(btn.dataset.iid);
    });
  });

  el.querySelectorAll('.remove-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelect(btn.dataset.iid);
    });
  });

  el.querySelectorAll('.explore-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openIdeaDrawer(el, btn.dataset.iid);
    });
  });

  const genBtn = el.querySelector('#generateOutlineBtn');
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      if (!canGenerate) return;
      handleGenerateOutline(el);
    });
  }
}

/* EXPLORE DRAWER */
function renderDrawerContent(idea, promptTitle, exploration, isSelected) {
  if (!exploration) {
    return `
      <div class="drawer-header">
        <h3>${escapeHtml(idea.text)}</h3>
        <button class="drawer-close" id="drawerClose">✕</button>
      </div>
      <div class="drawer-body">
        <div class="loading-line" style="padding:24px 0;"><span class="spinner"></span>Đang phân tích ý tưởng chuyên sâu...</div>
      </div>`;
  }
  if (exploration.error) {
    return `
      <div class="drawer-header">
        <h3>${escapeHtml(idea.text)}</h3>
        <button class="drawer-close" id="drawerClose">✕</button>
      </div>
      <div class="drawer-body">
        <p class="err-msg">Không thể tải nội dung khám phá lúc này. Vui lòng thử lại.</p>
        <button class="ghost-btn" id="retryExplore">Thử lại</button>
      </div>`;
  }

  return `
    <div class="drawer-header">
      <div>
        <span class="badge badge-side" style="margin-bottom:6px;display:inline-block;">${idea.side === 'body1' ? 'Thân bài 1' : 'Thân bài 2'}</span>
        <h3>${escapeHtml(idea.text)}</h3>
      </div>
      <button class="drawer-close" id="drawerClose">✕</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-section">
        <h5>Bản chất ý tưởng (Meaning)</h5>
        ${renderParagraphs(exploration.explanation_vi)}
      </div>
      <div class="drawer-section">
        <h5>Ví dụ thực tế tại Việt Nam</h5>
        <div class="example-list">
          ${(exploration.examples_vi || []).map(ex => `<p class="example-para">${cleanText(ex)}</p>`).join('')}
        </div>
      </div>
      <div class="drawer-section">
        <h5>Khi nào nên áp dụng?</h5>
        ${renderParagraphs(exploration.use_cases)}
      </div>
      <div class="drawer-section">
        <h5>Từ vựng & Collocations gợi ý</h5>
        <div class="vocab-chips">
          ${idea.vocab.map(v => `<span class="chip">${escapeHtml(v)}</span>`).join('')}
        </div>
      </div>
      <div class="drawer-section">
        <h5>Câu mẫu band 7.0+ (Example Sentence)</h5>
        <div class="fb-item good-item" style="background:var(--paper-warm);color:var(--ink);font-style:italic;">
          "${cleanText(exploration.example_sentence)}"
        </div>
      </div>
      <button class="primary-btn" id="drawerSelectBtn" style="width:100%;margin-top:10px;">
        ${isSelected ? 'Đã chọn ý này ✓' : 'Chọn ý tưởng này'}
      </button>
    </div>`;
}

async function openIdeaDrawer(el, ideaId) {
  const ideas = IDEAS[practice.promptId] || [];
  const prompt = PROMPTS.find(p => p.id === practice.promptId);
  const a = getAttempt(practice.promptId);
  const idea = ideas.find(i => i.id === ideaId);
  if (!idea) return;

  practice.drawerIdeaId = ideaId;

  const backdrop = el.querySelector('#drawerBackdrop');
  const drawer = el.querySelector('#ideaDrawer');
  backdrop.style.display = 'block';
  drawer.style.display = 'flex';
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    drawer.classList.add('open');
  });

  function closeDrawer() {
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
    setTimeout(() => {
      backdrop.style.display = 'none';
      drawer.style.display = 'none';
    }, 250);
  }

  function bindDrawerButtons() {
    const closeBtn = drawer.querySelector('#drawerClose');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    backdrop.onclick = closeDrawer;

    const retryBtn = drawer.querySelector('#retryExplore');
    if (retryBtn) retryBtn.addEventListener('click', () => fetchExploration());

    const selectBtn = drawer.querySelector('#drawerSelectBtn');
    if (selectBtn) {
      selectBtn.addEventListener('click', () => {
        const idx = a.ideasSelected.indexOf(ideaId);
        if (idx > -1) {
          a.ideasSelected.splice(idx, 1);
        } else {
          a.ideasSelected.push(ideaId);
        }
        saveAttempt(practice.promptId);
        closeDrawer();
        renderIdeasBank(el);
      });
    }
  }

  drawer.innerHTML = renderDrawerContent(idea, prompt.title, explorationCache[ideaId], a.ideasSelected.includes(ideaId));
  bindDrawerButtons();

  if (explorationCache[ideaId]) return;

  async function fetchExploration() {
    drawer.innerHTML = renderDrawerContent(idea, prompt.title, null, a.ideasSelected.includes(ideaId));
    bindDrawerButtons();

    try {
      const parsed = await AIService.exploreIdea(prompt, idea);
      explorationCache[ideaId] = parsed;
      saveExploration(ideaId);
      if (practice.drawerIdeaId === ideaId) {
        drawer.innerHTML = renderDrawerContent(idea, prompt.title, parsed, a.ideasSelected.includes(ideaId));
        bindDrawerButtons();
      }
    } catch (err) {
      console.error('exploration error', err);
      explorationCache[ideaId] = { error: true };
      if (practice.drawerIdeaId === ideaId) {
        drawer.innerHTML = renderDrawerContent(idea, prompt.title, { error: true }, a.ideasSelected.includes(ideaId));
        bindDrawerButtons();
      }
    }
  }

  fetchExploration();
}

/* OUTLINE GENERATION */
async function handleGenerateOutline(el) {
  const prompt = PROMPTS.find(p => p.id === practice.promptId);
  const ideas = IDEAS[practice.promptId] || [];
  const a = getAttempt(practice.promptId);
  const selectedIdeas = a.ideasSelected.map(id => ideas.find(i => i.id === id)).filter(Boolean);

  const genBtn = el.querySelector('#generateOutlineBtn');
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="spinner"></span> Đang tạo dàn ý...';
  }

  try {
    const parsed = await AIService.generateOutline(prompt, selectedIdeas);
    a.outline = parsed;
    saveAttempt(practice.promptId);
    practice.stage = 'outline';
    renderPractice();
  } catch (err) {
    console.error('outline error', err);
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.textContent = 'Tạo dàn ý (Generate Outline) →';
    }
    alert('Không thể tạo dàn ý lúc này. Vui lòng thử lại.');
  }
}

/* RENDER: OUTLINE STAGE */
function renderOutline(el) {
  const prompt = PROMPTS.find(p => p.id === practice.promptId);
  const a = getAttempt(practice.promptId);
  const o = a.outline;

  if (!o) {
    practice.stage = 'ideasBank';
    return renderIdeasBank(el);
  }

  el.innerHTML = `
    <div class="flow-header">
      <button class="back-btn" id="backToIdeasBank" title="Quay lại chọn ý">←</button>
      <div class="section-label" style="margin:0;">Dàn ý bài viết (Essay Outline)</div>
    </div>
    <p class="prompt-title-recap"><strong>${escapeHtml(prompt.type)}:</strong> ${escapeHtml(prompt.title)}</p>
    <div class="outline-card">
      <div class="outline-block">
        <h5>Thesis Statement (Luận điểm tổng quát)</h5>
        <p class="outline-thesis">${cleanText(o.thesis)}</p>
      </div>
      <div class="outline-two-col">
        <div class="outline-block">
          <h5>Thân bài 1 — Topic Sentence & Gợi ý</h5>
          <p>${o.topic_sentences && o.topic_sentences.body1 ? cleanText(o.topic_sentences.body1) : '<span class="empty-note">Chưa có ý tưởng cho thân bài 1.</span>'}</p>
          <ul class="struct-list bullet-list">
            ${((o.bullets && o.bullets.body1) || []).map(b => `<li>${cleanText(b)}</li>`).join('')}
          </ul>
        </div>
        <div class="outline-block">
          <h5>Thân bài 2 — Topic Sentence & Gợi ý</h5>
          <p>${o.topic_sentences && o.topic_sentences.body2 ? cleanText(o.topic_sentences.body2) : '<span class="empty-note">Chưa có ý tưởng cho thân bài 2.</span>'}</p>
          <ul class="struct-list bullet-list">
            ${((o.bullets && o.bullets.body2) || []).map(b => `<li>${cleanText(b)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
    <p style="font-size:0.92rem;color:var(--ink-soft);margin:16px 0 20px;">
      💡 Dàn ý đóng vai trò làm khung xương logic. Hãy vận dụng ngôn ngữ và cấu trúc của riêng bạn ở bước viết tiếp theo.
    </p>
    <div class="write-actions" style="justify-content:flex-start;gap:12px;">
      <button class="ghost-btn" id="regenOutline">Chỉnh sửa ý tưởng</button>
      <button class="primary-btn" id="toWriting">Bắt đầu viết bài →</button>
    </div>
  `;

  el.querySelector('#backToIdeasBank').addEventListener('click', () => {
    practice.stage = 'ideasBank';
    renderPractice();
  });
  el.querySelector('#regenOutline').addEventListener('click', () => {
    practice.stage = 'ideasBank';
    renderPractice();
  });
  el.querySelector('#toWriting').addEventListener('click', () => {
    practice.stage = 'writing';
    practice.openBlock = 'intro';
    renderPractice();
  });
}

/* RENDER: WRITING STAGE */
function renderWriting(el) {
  const prompt = PROMPTS.find(p => p.id === practice.promptId);
  const ideas = IDEAS[practice.promptId] || [];
  const a = getAttempt(practice.promptId);
  const selectedIdeas = a.ideasSelected.map(id => ideas.find(i => i.id === id)).filter(Boolean);
  const body1Ideas = selectedIdeas.filter(i => i.side === 'body1');
  const body2Ideas = selectedIdeas.filter(i => i.side === 'body2');
  const allDone = BLOCKS.every(b => a.doneBlocks[b.key]);

  el.innerHTML = `
    <div class="flow-header">
      <button class="back-btn" id="backToOutline" title="Quay lại dàn ý">←</button>
      <div class="section-label" style="margin:0;">Luyện viết từng đoạn</div>
    </div>
    <p class="prompt-title-recap"><strong>${escapeHtml(prompt.type)}:</strong> ${escapeHtml(prompt.title)}</p>
    ${a.outline ? `
      <div class="outline-recap">
        <span class="outline-recap-label">Thesis:</span>
        <span>${escapeHtml(a.outline.thesis)}</span>
      </div>` : ''}

    <div class="essay-blocks">
      ${BLOCKS.map((b, idx) => {
        const relevantIdeas = b.key === 'body1' ? body1Ideas : b.key === 'body2' ? body2Ideas : [];
        const isOpen = practice.openBlock === b.key;
        const isDone = !!a.doneBlocks[b.key];
        const textVal = a.texts[b.key] || '';
        const curWords = countWords(textVal);

        return `
        <div class="block ${isOpen ? 'open' : ''} ${isDone ? 'done' : ''}" data-block="${b.key}">
          <div class="block-head">
            <div class="left">
              <div class="block-num">${isDone ? '✓' : idx + 1}</div>
              <h3>${b.label}</h3>
            </div>
            <div class="left">
              <span class="status">${isDone ? 'Đã có feedback' : (textVal ? 'Đang viết...' : 'Chưa viết')}</span>
              <span class="chevron">▾</span>
            </div>
          </div>
          <div class="block-body">
            <div class="block-body-inner">
              <div class="helper-col">
                ${(a.outline && (b.key === 'body1' || b.key === 'body2') && a.outline.topic_sentences && a.outline.topic_sentences[b.key]) ? `
                <div>
                  <h5>Topic sentence gợi ý</h5>
                  <p class="helper-sentence">${cleanText(a.outline.topic_sentences[b.key])}</p>
                  ${(a.outline.bullets && a.outline.bullets[b.key] && a.outline.bullets[b.key].length) ? `
                    <ul class="struct-list bullet-list">
                      ${a.outline.bullets[b.key].map(bu => `<li>${cleanText(bu)}</li>`).join('')}
                    </ul>` : ''}
                </div>` : ''}

                ${relevantIdeas.length ? `
                <div style="margin-top:14px;">
                  <h5>Ý tưởng cho đoạn này</h5>
                  <div class="helper-idea-list">
                    ${relevantIdeas.map(i => `
                      <div class="helper-idea">
                        <strong>${escapeHtml(i.text)}</strong>
                        <div class="vocab-chips" style="margin-top:6px;">
                          ${i.vocab.map(v => `<span class="chip">${escapeHtml(v)}</span>`).join('')}
                        </div>
                      </div>`).join('')}
                  </div>
                </div>` : ''}

                <div style="margin-top:14px;">
                  <h5>Cấu trúc câu học thuật gợi ý</h5>
                  <ul class="struct-list">
                    ${STRUCTURES[b.struct].map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                  </ul>
                </div>
              </div>

              <div class="writing-container">
                <textarea class="writing-area" data-key="${b.key}" placeholder="Viết đoạn ${b.label.toLowerCase()} của bạn tại đây...">${escapeHtml(textVal)}</textarea>
                <div class="word-count-bar">
                  <span>Số từ: <span class="count-val word-count-span" data-key="${b.key}">${curWords}</span> từ</span>
                  <span>Mục tiêu: ${b.targetWords}</span>
                </div>
                <div class="write-actions">
                  <button class="ghost-btn savebtn" data-key="${b.key}">Lưu nháp</button>
                  <button class="primary-btn feedbackbtn" data-key="${b.key}">Nhận feedback AI</button>
                </div>
                <div class="feedback-slot" data-key="${b.key}">
                  ${renderFeedbackHTML(a.feedback[b.key])}
                </div>
              </div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    ${allDone ? `
      <div class="essay-complete-banner">
        <div class="left-banner">
          <span class="big">🌻</span>
          <div>
            <strong>Tuyệt vời! Bạn đã hoàn thành toàn bộ bài viết này.</strong><br>
            <span style="font-size:0.9rem;color:var(--ink-soft);">Cây hoa hướng dương trong Bảng điều khiển đã được nâng lên một giai đoạn mới!</span>
          </div>
        </div>
        <button class="primary-btn" id="viewFullEssayBtn">Xem toàn bộ bài viết</button>
      </div>` : ''}
  `;

  el.querySelector('#backToOutline').addEventListener('click', () => {
    practice.stage = a.outline ? 'outline' : 'ideasBank';
    renderPractice();
  });

  const fullEssayBtn = el.querySelector('#viewFullEssayBtn');
  if (fullEssayBtn) {
    fullEssayBtn.addEventListener('click', openFullEssayModal);
  }

  el.querySelectorAll('.block-head').forEach(h => {
    h.addEventListener('click', () => {
      const key = h.closest('.block').dataset.block;
      practice.openBlock = practice.openBlock === key ? null : key;
      renderWriting(el);
    });
  });

  el.querySelectorAll('.writing-area').forEach(ta => {
    ta.addEventListener('click', e => e.stopPropagation());
    ta.addEventListener('input', () => {
      const key = ta.dataset.key;
      a.texts[key] = ta.value;
      const currentFeedback = a.feedback[key];
      if (currentFeedback && !currentFeedback.loading && !currentFeedback.error && !currentFeedback.stale &&
          String(currentFeedback.source_text || '') !== ta.value) {
        a.feedback[key] = { stale: true };
        a.doneBlocks[key] = false;
        rebuildFeedbackStats();
        const feedbackSlot = el.querySelector(`.feedback-slot[data-key="${key}"]`);
        if (feedbackSlot) feedbackSlot.innerHTML = renderFeedbackHTML(a.feedback[key]);
        saveAttempt(practice.promptId);
        saveStats();
      }
      const countEl = el.querySelector(`.word-count-span[data-key="${key}"]`);
      if (countEl) countEl.textContent = countWords(ta.value);
    });
  });

  el.querySelectorAll('.savebtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveAttempt(practice.promptId);
      btn.textContent = 'Đã lưu ✓';
      setTimeout(() => { btn.textContent = 'Lưu nháp'; }, 1500);
    });
  });

  el.querySelectorAll('.feedbackbtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.key;
      requestFeedback(el, key);
    });
  });
}

/* FEEDBACK RENDERING */
function renderFeedbackHTML(fb) {
  if (!fb) return '';
  if (fb.loading) {
    return `<div class="feedback-box"><div class="loading-line"><span class="spinner"></span>Đang phân tích ngữ pháp, cách dùng từ và ý nghĩa...</div></div>`;
  }
  if (fb.error) {
    return '<div class="feedback-box"><div class="err-msg">Không thể lấy feedback lúc này. Vui lòng thử lại.</div></div>';
  }
  if (fb.stale) {
    return '<div class="feedback-box"><div class="err-msg">Bản nháp đã thay đổi sau khi yêu cầu feedback. Hãy chạy phân tích lại để nhận nhận xét khớp với nội dung mới.</div></div>';
  }

  const grammar = (fb.grammar_issues || []).map(g => `
    <div class="fb-item">
      <span class="orig">${cleanText(g.original)}</span> → <span class="fix">${cleanText(g.suggestion)}</span>
      <br><span style="color:var(--ink-soft);font-size:0.85rem;">${cleanText(g.explanation || g.issue_type || '')}</span>
    </div>
  `).join('');

  const vocab = (fb.vocab_issues || []).map(v => `
    <div class="fb-item">
      <span class="orig">${cleanText(v.original)}</span> → <span class="fix">${cleanText(v.suggestion)}</span>
      <br><span style="color:var(--ink-soft);font-size:0.85rem;">${cleanText(v.issue || '')}</span>
    </div>
  `).join('');

  const good = (fb.good_phrases || []).map(g => `
    <div class="fb-item good-item">✓ ${cleanText(g)}</div>
  `).join('');

  return `
    <div class="feedback-box">
      ${fb.band_estimate ? `<span class="band-pill">Ước lượng GRA &amp; LR cho đoạn văn: ${escapeHtml(String(fb.band_estimate))}</span>
      <div class="fb-note">Đây không phải band IELTS Writing tổng thể; Task Response và Coherence &amp; Cohesion cần được đánh giá trên toàn bài.</div>` : ''}
      ${grammar ? `<div class="fb-group grammar"><h6>Chỉnh sửa ngữ pháp (${(fb.grammar_issues || []).length})</h6>${grammar}</div>` : ''}
      ${vocab ? `<div class="fb-group vocab"><h6>Gợi ý nâng cấp từ vựng (${(fb.vocab_issues || []).length})</h6>${vocab}</div>` : ''}
      ${good ? `<div class="fb-group good"><h6>Điểm sáng & Cụm từ hay</h6>${good}</div>` : ''}
      ${fb.summary ? `<div class="fb-note">${cleanText(fb.summary)}</div>` : ''}
    </div>
  `;
}

function rebuildFeedbackStats() {
  const errorCounts = {};
  const praised = [];
  let completed = 0;
  for (const attempt of Object.values(attempts)) {
    if (!attempt || !attempt.feedback) continue;
    for (const feedback of Object.values(attempt.feedback)) {
      if (!feedback || feedback.loading || feedback.error || feedback.stale) continue;
      (feedback.grammar_issues || []).forEach(function (issue) {
        const category = issue.issue_type || 'Grammar';
        errorCounts[category] = (errorCounts[category] || 0) + 1;
      });
      (feedback.good_phrases || []).forEach(function (phrase) {
        if (phrase && !praised.includes(phrase)) praised.push(phrase);
      });
    }
    const isComplete = BLOCKS.every(function (block) {
      return attempt.doneBlocks && attempt.doneBlocks[block.key] && attempt.feedback[block.key] && !attempt.feedback[block.key].error && !attempt.feedback[block.key].stale;
    });
    if (isComplete) completed += 1;
  }
  stats.errorCounts = errorCounts;
  stats.praisedPhrases = praised.slice(-40);
  stats.essaysCompleted = completed;
}

/* REQUEST FEEDBACK */
async function requestFeedback(el, blockKey) {
  const a = getAttempt(practice.promptId);
  const text = (a.texts[blockKey] || '').trim();
  const slot = el.querySelector(`.feedback-slot[data-key="${blockKey}"]`);

  if (!text) {
    slot.innerHTML = `<div class="feedback-box"><div class="err-msg">Hãy viết một vài câu trước khi nhận feedback nhé.</div></div>`;
    return;
  }

  a.feedback[blockKey] = { loading: true };
  slot.innerHTML = renderFeedbackHTML(a.feedback[blockKey]);

  const blockObj = BLOCKS.find(b => b.key === blockKey);
  const blockLabel = blockObj ? blockObj.label : blockKey;
  const prompt = PROMPTS.find(p => p.id === practice.promptId);

  try {
    const parsed = await AIService.evaluateParagraph(prompt, blockKey, blockLabel, text);
    if ((a.texts[blockKey] || '').trim() !== text) {
      a.feedback[blockKey] = { stale: true, evaluatedText: text };
      saveAttempt(practice.promptId);
      renderWriting(el);
      return;
    }
    parsed.source_text = text;
    a.feedback[blockKey] = parsed;
    a.doneBlocks[blockKey] = true;
    rebuildFeedbackStats();
    const isAllDone = BLOCKS.every(b => a.doneBlocks[b.key] && a.feedback[b.key] && !a.feedback[b.key].stale && !a.feedback[b.key].error);
    if (isAllDone) a._countedComplete = true;
    saveAttempt(practice.promptId);
    saveStats();
    renderWriting(el);  } catch (err) {
    console.error('feedback error', err);
    a.feedback[blockKey] = { error: true };
    slot.innerHTML = renderFeedbackHTML(a.feedback[blockKey]);
  }
}

/* ---------------- FULL ESSAY MODAL ---------------- */
function openFullEssayModal() {
  const prompt = PROMPTS.find(p => p.id === practice.promptId);
  const a = getAttempt(practice.promptId);

  const introText = (a.texts.intro || '').trim();
  const b1Text = (a.texts.body1 || '').trim();
  const b2Text = (a.texts.body2 || '').trim();
  const concText = (a.texts.conclusion || '').trim();

  const fullEssay = [introText, b1Text, b2Text, concText].filter(Boolean).join('\n\n');
  const totalWords = countWords(fullEssay);

  const modalBackdrop = document.getElementById('fullEssayModal');
  const modalContent = document.getElementById('fullEssayContent');
  const wordCountSpan = document.getElementById('fullEssayWordCount');

  wordCountSpan.textContent = `${totalWords} từ (Khuyến nghị chuẩn Task 2: 250 - 320 từ)`;
  modalContent.innerHTML = `
    <h4 style="margin:0 0 10px;color:var(--denim);font-size:0.9rem;text-transform:uppercase;">${escapeHtml(prompt.type)}</h4>
    <h3 style="margin:0 0 18px;font-size:1.15rem;">${escapeHtml(prompt.title)}</h3>
    <div style="background:var(--paper-warm);border:1px solid var(--line);border-radius:14px;padding:20px;font-size:1rem;line-height:1.75;white-space:pre-wrap;">${escapeHtml(fullEssay)}</div>
  `;

  modalBackdrop.classList.add('open');

  const copyBtn = document.getElementById('copyEssayBtn');
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(fullEssay).then(() => {
      copyBtn.textContent = 'Đã sao chép! ✓';
      setTimeout(() => { copyBtn.textContent = 'Sao chép toàn bộ'; }, 1800);
    });
  };

  const downloadBtn = document.getElementById('downloadEssayBtn');
  downloadBtn.onclick = () => {
    const blob = new Blob([`${prompt.title}\n\n${fullEssay}`], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `IELTS_Writing_${practice.promptId}.txt`;
    link.click();
  };
}

function closeModals() {
  document.querySelectorAll('.modal-backdrop').forEach(function (modal) {
    modal.classList.remove('open');
  });
}

/* ---------------- DASHBOARD ---------------- */
function stageFromCount(n) {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  return 4;
}

const STAGE_CAPTIONS = [
  'Hạt giống mới gieo',
  'Mầm non nhú lên',
  'Lá đã xanh tốt',
  'Nụ hoa đầu tiên',
  'Vườn hoa hướng dương rực rỡ'
];

function sunflowerSVG(stage) {
  return `
  <svg viewBox="0 0 260 220" width="220" height="186" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="130" cy="205" rx="90" ry="10" fill="rgba(38,52,74,0.08)"/>
    <rect x="126" y="${stage >= 1 ? 90 : 190}" width="8" height="${stage >= 1 ? 110 : 10}" rx="4" fill="var(--sage,#5B8266)" style="transition:all .6s ease;"/>
    <g style="opacity:${stage >= 2 ? 1 : 0};transition:opacity .6s ease;">
      <path d="M126 150 C 95 140, 80 155, 78 175 C 105 178, 122 165, 126 150 Z" fill="var(--sage-light,#8FAE86)"/>
      <path d="M134 165 C 165 155, 180 170, 182 190 C 155 193, 138 180, 134 165 Z" fill="var(--sage-light,#8FAE86)"/>
    </g>
    <g style="opacity:${stage >= 3 ? 1 : 0};transform:${stage >= 3 ? 'scale(1)' : 'scale(0.5)'};transform-origin:130px 85px;transition:all .6s ease;">
      ${Array.from({ length: 12 }).map((_, i) => {
        const angle = i * 30;
        return `<ellipse cx="130" cy="85" rx="9" ry="22" fill="var(--sunflower,#E8A63B)" transform="rotate(${angle} 130 85) translate(0 -26)"/>`;
      }).join('')}
      <circle cx="130" cy="85" r="20" fill="var(--sunflower-dark,#C98A24)"/>
    </g>
    <g style="opacity:${stage >= 4 ? 1 : 0};transition:opacity .6s ease;">
      <g transform="translate(-58,20) scale(0.55)">
        ${Array.from({ length: 10 }).map((_, i) => {
          const angle = i * 36;
          return `<ellipse cx="130" cy="85" rx="9" ry="22" fill="var(--sunflower,#E8A63B)" transform="rotate(${angle} 130 85) translate(0 -26)"/>`;
        }).join('')}
        <circle cx="130" cy="85" r="20" fill="var(--sunflower-dark,#C98A24)"/>
      </g>
      <g transform="translate(50,35) scale(0.45)">
        ${Array.from({ length: 10 }).map((_, i) => {
          const angle = i * 36;
          return `<ellipse cx="130" cy="85" rx="9" ry="22" fill="var(--sunflower,#E8A63B)" transform="rotate(${angle} 130 85) translate(0 -26)"/>`;
        }).join('')}
        <circle cx="130" cy="85" r="20" fill="var(--sunflower-dark,#C98A24)"/>
      </g>
    </g>
  </svg>`;
}

function fmtHours(sec) {
  const h = sec / 3600;
  return h < 1 ? Math.round(sec / 60) + ' phút' : h.toFixed(1) + ' giờ';
}

function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  const stage = stageFromCount(stats.essaysCompleted);
  const errorEntries = Object.entries(stats.errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const phrases = stats.praisedPhrases.slice(-10).reverse();

  el.innerHTML = `
    <div class="section-label">Tiến độ & Thành tựu</div>
    <div class="dash-grid">
      <div class="garden-panel">
        <h3>Vườn hoa hướng dương</h3>
        <div class="stage-caption">${STAGE_CAPTIONS[stage]} · Giai đoạn ${stage + 1}/5</div>
        ${sunflowerSVG(stage)}
      </div>
      <div class="stat-stack">
        <div class="stat-card accent">
          <span class="label">Bài luận đã hoàn thành</span>
          <span class="value mono">${stats.essaysCompleted}</span>
        </div>
        <div class="stat-card">
          <span class="label">Thời gian đã luyện tập</span>
          <span class="value mono">${fmtHours(stats.secondsSpent)}</span>
        </div>
        <div class="stat-card">
          <span class="label">Cụm từ hay được ghi nhận</span>
          <span class="value mono">${stats.praisedPhrases.length}</span>
        </div>
      </div>
    </div>
    <div class="two-col">
      <div class="list-panel errors">
        <h4>Các lỗi ngữ pháp cần lưu tâm</h4>
        ${errorEntries.length ? errorEntries.map(([k, v]) => `
          <div class="tag-row">
            <span>${escapeHtml(k)}</span>
            <span class="cnt">${v} lần</span>
          </div>`).join('') : '<div class="empty-note">Chưa có dữ liệu — hãy hoàn thành một đoạn văn để nhận feedback đầu tiên.</div>'}
      </div>
      <div class="list-panel phrases">
        <h4>Bộ sưu tập từ vựng & Collocation khen ngợi</h4>
        ${phrases.length ? `<div>${phrases.map(p => `<span class="phrase-pill">${escapeHtml(p)}</span>` ).join('')}</div>` : '<div class="empty-note">Chưa có cụm từ nào được tuyên dương — hãy cố gắng viết thật hay nhé!</div>'}
      </div>
    </div>
  `;
}

/* ---------------- INITIALIZATION ---------------- */
(async function init() {
  if (window.IWAuth) await window.IWAuth.bootstrap();
  if (window.IWAuth && window.IWAuth.currentUser && window.DataManager && window.DataManager.syncRemote) await window.DataManager.syncRemote();
  await loadState();
  rebuildFeedbackStats();

  // Tab listeners
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(mb => {
    mb.addEventListener('click', (e) => {
      if (e.target === mb) closeModals();
    });
  });

  updateAIStatusBadge();
  renderPractice();
  renderDashboard();
  startTimer();
})();
