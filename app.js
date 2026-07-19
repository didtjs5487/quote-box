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
  search: '',
  editingId: null,
  todayId: null,
};

const CATEGORY_LABEL = { quote: '💬 명언', line: '🎬 명대사', scene: '🎞️ 명장면' };

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  document.getElementById('today-text').textContent = pick.text;
  document.getElementById('today-source').textContent = pick.source ? `— ${pick.source}` : '';
  card.classList.remove('hidden');
}
document.getElementById('btn-shuffle').addEventListener('click', pickToday);

/* ===================== Rendering ===================== */
function renderQuotes() {
  const list = document.getElementById('quote-list');
  list.innerHTML = '';

  let items = [...state.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (state.filter === 'fav') items = items.filter(q => q.favorite);
  else if (state.filter !== 'all') items = items.filter(q => q.category === state.filter);
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    items = items.filter(it => it.text.toLowerCase().includes(q) || (it.source || '').toLowerCase().includes(q));
  }

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-state">${state.items.length === 0
      ? '아직 담아둔 문장이 없어요.<br>마음에 남는 명언·명대사·명장면을 적어보세요 💬'
      : '조건에 맞는 문장이 없어요.'}</p>`;
    return;
  }

  items.forEach(q => {
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.innerHTML = `
      <span class="quote-tag">${CATEGORY_LABEL[q.category] || CATEGORY_LABEL.quote}</span>
      <p class="quote-text">${escapeHtml(q.text)}</p>
      ${q.source ? `<p class="quote-source">— ${escapeHtml(q.source)}</p>` : ''}
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
    card.addEventListener('click', () => openEditModal(q.id));
    list.appendChild(card);
  });
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
  const category = document.getElementById('quote-category').value;
  state.items.push({
    id: uid(), text, source, category, favorite: false, createdAt: new Date().toISOString(),
  });
  saveQuotes(state.items);
  textInput.value = '';
  document.getElementById('quote-source').value = '';
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
