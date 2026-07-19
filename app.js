if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

/* ===================== Storage ===================== */
const STORAGE_KEY = 'quoteBoxItems';

function loadQuotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveQuotes(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ===================== State ===================== */
const state = {
  items: loadQuotes(),
  filter: 'all',
  tagFilter: null,
  search: '',
  editingId: null,
  todayId: null,
};

const CATEGORY_LABEL = { quote: '💬 명언', line: '🎬 명대사', scene: '🎞️ 명장면' };

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function parseTags(str) {
  const seen = new Set();
  const tags = [];
  (str || '').split(/[,，]/).forEach(raw => {
    const tag = raw.trim().replace(/^#+/, '');
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) { seen.add(key); tags.push(tag); }
  });
  return tags;
}
function toast(msg) {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* ===================== Today's pick ===================== */
function pickToday() {
  const card = document.getElementById('today-pick');
  if (state.items.length === 0) {
    card.classList.add('hidden');
    return;
  }
  const pool = state.items.filter(q => q.id !== state.todayId);
  const pick = (pool.length > 0 ? pool : state.items)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : state.items.length))];
  state.todayId = pick.id;
  const textEl = document.getElementById('today-text');
  const moreBtn = document.getElementById('btn-today-more');
  textEl.textContent = pick.text;
  textEl.classList.add('clamped');
  moreBtn.textContent = '더보기';
  document.getElementById('today-source').textContent = pick.source ? `— ${pick.source}` : '';
  card.classList.remove('hidden');
  requestAnimationFrame(() => {
    moreBtn.classList.toggle('hidden', textEl.scrollHeight <= textEl.clientHeight + 1);
  });
}
document.getElementById('btn-shuffle').addEventListener('click', pickToday);
document.getElementById('btn-today-more').addEventListener('click', () => {
  const textEl = document.getElementById('today-text');
  const moreBtn = document.getElementById('btn-today-more');
  const expanded = textEl.classList.toggle('clamped') === false;
  moreBtn.textContent = expanded ? '접기' : '더보기';
});
document.getElementById('today-text').addEventListener('click', () => document.getElementById('btn-today-more').click());

/* ===================== Rendering ===================== */
function renderQuotes() {
  renderTagFilters();
  const list = document.getElementById('quote-list');
  list.innerHTML = '';

  let items = [...state.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (state.filter === 'fav') items = items.filter(q => q.favorite);
  else if (state.filter !== 'all') items = items.filter(q => q.category === state.filter);
  if (state.tagFilter) {
    const t = state.tagFilter.toLowerCase();
    items = items.filter(q => (q.tags || []).some(tag => tag.toLowerCase() === t));
  }
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    items = items.filter(it => it.text.toLowerCase().includes(q)
      || (it.source || '').toLowerCase().includes(q)
      || (it.note || '').toLowerCase().includes(q)
      || (it.tags || []).some(tag => tag.toLowerCase().includes(q)));
  }

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-state">${state.items.length === 0
      ? '아직 담아둔 문장이 없어요.<br>마음에 남는 명언·명대사·명장면을 적어보세요 💬'
      : '조건에 맞는 문장이 없어요.'}</p>`;
    return;
  }

  items.forEach(q => {
    const tags = q.tags || [];
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.innerHTML = `
      <span class="quote-tag">${CATEGORY_LABEL[q.category] || CATEGORY_LABEL.quote}</span>
      <p class="quote-text" title="눌러서 느낀 점 적기">${escapeHtml(q.text)}</p>
      ${q.source ? `<p class="quote-source">— ${escapeHtml(q.source)}</p>` : ''}
      <div class="quote-note-slot">${q.note ? `<p class="quote-note" title="눌러서 수정">💭 ${escapeHtml(q.note)}</p>` : ''}</div>
      ${tags.length ? `<div class="quote-topics">${tags.map(t => `<span class="topic-pill" data-topic="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="quote-foot">
        <span class="quote-date">${formatDate(q.createdAt)}</span>
        <div class="quote-actions">
          <button class="quote-fav-btn" title="즐겨찾기">${q.favorite ? '⭐' : '☆'}</button>
        </div>
      </div>
    `;
    card.querySelector('.quote-fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(q.id);
    });
    card.querySelectorAll('.topic-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        setTagFilter(pill.dataset.topic);
      });
    });
    const openNote = (e) => { e.stopPropagation(); openInlineNoteEditor(card, q); };
    card.querySelector('.quote-text').addEventListener('click', openNote);
    const noteDisplay = card.querySelector('.quote-note');
    if (noteDisplay) noteDisplay.addEventListener('click', openNote);
    card.addEventListener('click', () => openEditModal(q.id));
    list.appendChild(card);
  });
}

function openInlineNoteEditor(card, q) {
  const slot = card.querySelector('.quote-note-slot');
  if (!slot || slot.querySelector('textarea')) return;

  const wrap = document.createElement('div');
  wrap.className = 'quote-note-edit';
  const ta = document.createElement('textarea');
  ta.rows = 2;
  ta.placeholder = '이 문장을 보고 느낀 점, 깨달은 것';
  ta.value = q.note || '';
  const actions = document.createElement('div');
  actions.className = 'quote-note-edit-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary btn-small-note';
  cancelBtn.textContent = '취소';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary btn-small-note';
  saveBtn.textContent = '저장';
  actions.append(cancelBtn, saveBtn);
  wrap.append(ta, actions);
  wrap.addEventListener('click', (e) => e.stopPropagation());
  cancelBtn.addEventListener('click', () => renderQuotes());
  saveBtn.addEventListener('click', () => {
    q.note = ta.value.trim();
    saveQuotes(state.items);
    renderQuotes();
    pickToday();
  });

  slot.innerHTML = '';
  slot.appendChild(wrap);
  ta.focus();
}

function renderTagFilters() {
  const row = document.getElementById('tag-filter-row');
  const counts = new Map(); // lowercase tag -> { label, count }
  state.items.forEach(q => (q.tags || []).forEach(tag => {
    const key = tag.toLowerCase();
    const entry = counts.get(key) || { label: tag, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }));

  if (counts.size === 0) {
    row.classList.add('hidden');
    row.innerHTML = '';
    if (state.tagFilter) { state.tagFilter = null; }
    return;
  }
  row.classList.remove('hidden');
  const tags = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'));

  row.innerHTML = tags.map(t => `<button class="tag-filter-btn${state.tagFilter && state.tagFilter.toLowerCase() === t.label.toLowerCase() ? ' active' : ''}" data-topic="${escapeHtml(t.label)}">#${escapeHtml(t.label)}</button>`).join('');
  row.querySelectorAll('.tag-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setTagFilter(btn.dataset.topic));
  });
}

function setTagFilter(tag) {
  state.tagFilter = (state.tagFilter && state.tagFilter.toLowerCase() === tag.toLowerCase()) ? null : tag;
  renderQuotes();
}

function toggleFavorite(id) {
  const q = state.items.find(it => it.id === id);
  if (!q) return;
  q.favorite = !q.favorite;
  saveQuotes(state.items);
  renderQuotes();
}

/* ===================== Filters & search ===================== */
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn));
    renderQuotes();
  });
});
document.getElementById('search-input').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderQuotes();
});

/* ===================== Add ===================== */
document.getElementById('form-quote-add').addEventListener('submit', (e) => {
  e.preventDefault();
  const textInput = document.getElementById('quote-text');
  const text = textInput.value.trim();
  if (!text) return;
  const source = document.getElementById('quote-source').value.trim();
  const note = document.getElementById('quote-note').value.trim();
  const category = document.getElementById('quote-category').value;
  const tags = parseTags(document.getElementById('quote-tags').value);
  state.items.push({
    id: uid(), text, source, note, category, tags, favorite: false, createdAt: new Date().toISOString(),
  });
  saveQuotes(state.items);
  textInput.value = '';
  document.getElementById('quote-source').value = '';
  document.getElementById('quote-note').value = '';
  document.getElementById('quote-tags').value = '';
  renderQuotes();
  pickToday();
  toast('담아뒀어요');
});

/* ===================== Edit / delete ===================== */
const editModal = document.getElementById('modal-edit');
function openEditModal(id) {
  const q = state.items.find(it => it.id === id);
  if (!q) return;
  state.editingId = id;
  document.getElementById('edit-text').value = q.text;
  document.getElementById('edit-source').value = q.source || '';
  document.getElementById('edit-note').value = q.note || '';
  document.getElementById('edit-tags').value = (q.tags || []).join(', ');
  document.getElementById('edit-category').value = q.category;
  editModal.classList.remove('hidden');
}
function closeEditModal() { editModal.classList.add('hidden'); state.editingId = null; }
document.getElementById('modal-edit-close').addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

document.getElementById('form-quote-edit').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = state.items.find(it => it.id === state.editingId);
  if (!q) return;
  const text = document.getElementById('edit-text').value.trim();
  if (!text) return;
  q.text = text;
  q.source = document.getElementById('edit-source').value.trim();
  q.note = document.getElementById('edit-note').value.trim();
  q.tags = parseTags(document.getElementById('edit-tags').value);
  q.category = document.getElementById('edit-category').value;
  saveQuotes(state.items);
  closeEditModal();
  renderQuotes();
  pickToday();
});

document.getElementById('btn-delete-quote').addEventListener('click', () => {
  if (!confirm('이 문장을 삭제할까요?')) return;
  state.items = state.items.filter(it => it.id !== state.editingId);
  saveQuotes(state.items);
  closeEditModal();
  renderQuotes();
  pickToday();
});

/* ===================== Backup: export / import ===================== */
const backupModal = document.getElementById('modal-backup');
document.getElementById('btn-export').addEventListener('click', () => backupModal.classList.remove('hidden'));
document.getElementById('modal-backup-close').addEventListener('click', () => backupModal.classList.add('hidden'));
backupModal.addEventListener('click', (e) => { if (e.target === backupModal) backupModal.classList.add('hidden'); });

document.getElementById('btn-do-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quote-box-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('invalid');
      const existingIds = new Set(state.items.map(it => it.id));
      const merged = [...state.items];
      imported.forEach(it => {
        if (it && it.text && !existingIds.has(it.id)) {
          merged.push({
            id: it.id || uid(),
            text: it.text,
            source: it.source || '',
            note: typeof it.note === 'string' ? it.note : '',
            tags: Array.isArray(it.tags) ? it.tags.filter(t => typeof t === 'string' && t.trim()) : [],
            category: CATEGORY_LABEL[it.category] ? it.category : 'quote',
            favorite: !!it.favorite,
            createdAt: it.createdAt || new Date().toISOString(),
          });
        }
      });
      state.items = merged;
      saveQuotes(state.items);
      renderQuotes();
      pickToday();
      backupModal.classList.add('hidden');
      toast(`${imported.length}개 항목을 가져왔어요`);
    } catch (err) {
      toast('파일을 읽을 수 없어요. JSON 형식을 확인해주세요.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ===================== Init ===================== */
renderQuotes();
pickToday();
