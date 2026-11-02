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
const SEED_FLAG_KEY = 'quoteBoxSeeded';
function seedIfNeeded(items) {
  if (items.length > 0) {
    if (!localStorage.getItem(SEED_FLAG_KEY)) localStorage.setItem(SEED_FLAG_KEY, '1');
    return items;
  }
  if (localStorage.getItem(SEED_FLAG_KEY)) return items;
  localStorage.setItem(SEED_FLAG_KEY, '1');
  const now = new Date().toISOString();
  const seed = {
    id: uid(),
    text: '읽는 것\n듣는 것\n보는 것\n이것은 인생의 살\n\n왜 읽는가\n왜 듣는가\n왜 보는가\n이것은 인생의 뼈\n\n뼈가 있어야\n살이 붙는다',
    source: '카피라이터 정철',
    tags: ['인생의 뼈'],
    favorite: false,
    notes: [
      { id: uid(), text: '개발자가 남기는 첫 선물이에요 🎁 마음에 드시면 그대로 두고, 아니면 지우고 나만의 문장으로 채워보세요.', createdAt: now },
    ],
    createdAt: now,
  };
  const seeded = [seed];
  saveQuotes(seeded);
  return seeded;
}

function migrateNotes(items) {
  let changed = false;
  items.forEach((q) => {
    if (!Array.isArray(q.notes)) {
      q.notes = (typeof q.note === 'string' && q.note.trim())
        ? [{ id: uid(), text: q.note.trim(), createdAt: q.createdAt || new Date().toISOString() }]
        : [];
      changed = true;
    }
    if ('note' in q) { delete q.note; changed = true; }
  });
  if (changed) saveQuotes(items);
  return items;
}

const CATEGORY_TAG_LABEL = { quote: '명언', line: '명대사', scene: '명장면', toast: '건배사', joke: '개그' };
function migrateCategoryToTags(items) {
  let changed = false;
  items.forEach((q) => {
    if ('category' in q) {
      const tagName = CATEGORY_TAG_LABEL[q.category];
      if (tagName) {
        q.tags = q.tags || [];
        if (!q.tags.some(t => t.toLowerCase() === tagName.toLowerCase())) q.tags.push(tagName);
      }
      delete q.category;
      changed = true;
    }
  });
  if (changed) saveQuotes(items);
  return items;
}

function migrateViewCount(items) {
  let changed = false;
  items.forEach((q) => {
    if (typeof q.viewCount !== 'number') { q.viewCount = 0; changed = true; }
  });
  if (changed) saveQuotes(items);
  return items;
}

const state = {
  items: migrateViewCount(migrateNotes(migrateCategoryToTags(seedIfNeeded(loadQuotes())))),
  filter: 'all',
  tagFilter: null,
  tagFilterExpanded: false,
  search: '',
  editingId: null,
  todayId: null,
  sortMode: 'newest', // 'newest' | 'oldest' | 'shuffle'
};
const TAG_FILTER_CAP = 10;
const SORT_LABEL = { newest: '최신순', oldest: '오래된순', shuffle: '랜덤' };
const SORT_CYCLE = ['newest', 'oldest', 'shuffle'];

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function isSafeUrl(str) {
  return /^https?:\/\//i.test(str || '');
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
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 220);
  }, 2600);
}

/* ===================== Modal open/close (animated, focus-managed) ===================== */
const modalReturnFocus = new WeakMap();
const FOCUSABLE_SELECTOR = 'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])';
function focusableElements(el) {
  return Array.from(el.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(node => node.offsetParent !== null && !node.disabled);
}
function openModal(el, opts) {
  modalReturnFocus.set(el, document.activeElement);
  el.classList.remove('hidden');
  requestAnimationFrame(() => {
    el.classList.add('is-open');
    if (opts && opts.autofocus === false) {
      // 실수로 열렸을 때 키보드가 바로 올라오지 않게, 입력칸 대신 창 자체에 포커스
      const card = el.querySelector('.modal-card');
      if (card) { card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true }); }
      return;
    }
    const visible = focusableElements(el);
    const primary = visible.find(n => n.tagName === 'TEXTAREA' || n.tagName === 'INPUT' || n.tagName === 'SELECT');
    (primary || visible[0])?.focus();
  });
}
function closeModal(el) {
  el.classList.remove('is-open');
  setTimeout(() => el.classList.add('hidden'), 220);
  const toFocus = modalReturnFocus.get(el);
  modalReturnFocus.delete(el);
  if (toFocus && typeof toFocus.focus === 'function' && document.contains(toFocus)) {
    toFocus.focus();
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const openOverlays = document.querySelectorAll('.modal-overlay.is-open');
  const openOverlay = openOverlays[openOverlays.length - 1];
  if (!openOverlay) return;
  const visible = focusableElements(openOverlay);
  if (visible.length === 0) return;
  const first = visible[0];
  const last = visible[visible.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
});

/* ===================== In-app confirm sheet (replaces native confirm()) ===================== */
const confirmModal = document.getElementById('modal-confirm');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');
let confirmResolve = null;
function confirmDialog(message, okLabel) {
  confirmMessageEl.textContent = message;
  confirmOkBtn.textContent = okLabel || '확인';
  openModal(confirmModal);
  return new Promise((resolve) => { confirmResolve = resolve; });
}
function resolveConfirm(result) {
  closeModal(confirmModal);
  if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
}
confirmOkBtn.addEventListener('click', () => resolveConfirm(true));
confirmCancelBtn.addEventListener('click', () => resolveConfirm(false));
confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) resolveConfirm(false); });
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* ===================== Quote as image (share / download) ===================== */
function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  text.split('\n').forEach((paragraph) => {
    if (paragraph === '') { lines.push(''); return; }
    const words = paragraph.split(' ');
    let line = '';
    words.forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) { line = test; return; }
      if (line) { lines.push(line); line = ''; }
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
      } else {
        let chunk = '';
        for (const ch of word) {
          const test2 = chunk + ch;
          if (ctx.measureText(test2).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk = test2;
          }
        }
        line = chunk;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

/* ===== 캘리그라피 작품 느낌의 공유 이미지: 한지 질감 + 붓글씨 + 계절 수묵 + 낙관 ===== */
function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () {
    h += 0x6D2B79F5; let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(193,84,74,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

function loadImageFromCssVar(varName) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const m = /^url\(["']?(.*?)["']?\)$/.exec(raw);
  if (!m) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = m[1];
  });
}

function drawHanjiPaper(ctx, W, H, paper, rand) {
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  // 먹이 옅게 번진 얼룩
  for (let i = 0; i < 6; i++) {
    const x = rand() * W, y = rand() * H, r = 260 + rand() * 360;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70,60,50,0.05)');
    g.addColorStop(1, 'rgba(70,60,50,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // 한지 섬유
  ctx.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = rand() * W, y = rand() * H, len = 14 + rand() * 46, a = rand() * Math.PI;
    ctx.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(120,100,75,0.10)';
    ctx.lineWidth = 0.6 + rand() * 1.1;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rand() * 8, y + Math.sin(a) * len * 0.5 + rand() * 8,
                         x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // 잔 점
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(90,75,55,${0.03 + rand() * 0.07})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
  }
  // 가장자리 비네트
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(90,70,45,0.16)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// 글자마다 살짝 흔들리고 기울어진 붓글씨 한 줄 (가운데 정렬)
function drawBrushLine(ctx, line, cx, y, rand, color) {
  const chars = [...line];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  chars.forEach((ch, i) => {
    const w = widths[i];
    ctx.save();
    ctx.translate(x + w / 2, y + (rand() - 0.5) * 6);
    ctx.rotate((rand() - 0.5) * 0.045);
    // 먹이 번진 가장자리 → 선명한 획
    ctx.shadowColor = 'rgba(35,28,22,0.38)'; ctx.shadowBlur = 9;
    ctx.fillStyle = color; ctx.fillText(ch, -w / 2, 0);
    ctx.shadowBlur = 0; ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    x += w;
  });
}

function drawBrushStroke(ctx, x, y, w, color) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(w / 200, 1.6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(1, 7);
  ctx.bezierCurveTo(24, 3, 62, 9, 104, 5.5);
  ctx.bezierCurveTo(140, 2.5, 168, 3.5, 199, 6);
  ctx.bezierCurveTo(172, 8.5, 140, 7.5, 106, 9);
  ctx.bezierCurveTo(70, 10.5, 34, 10.5, 1, 7);
  ctx.fill();
  ctx.restore();
}

function drawSeal(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2); ctx.rotate(-0.12);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#B23A2E';
  const r = size * 0.1, s = size / 2;
  ctx.beginPath();
  ctx.moveTo(-s + r, -s); ctx.arcTo(s, -s, s, s, r); ctx.arcTo(s, s, -s, s, r);
  ctx.arcTo(-s, s, -s, -s, r); ctx.arcTo(-s, -s, s, -s, r); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(251,239,230,0.6)'; ctx.lineWidth = size * 0.04;
  ctx.strokeRect(-s + size * 0.07, -s + size * 0.07, size - size * 0.14, size - size * 0.14);
  ctx.fillStyle = '#FBEFE6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size * 0.44}px "Nanum Brush Script", serif`;
  const o = size * 0.22; // 4글자가 2×2로 꽉 차게
  ctx.fillText('문', -o, -o); ctx.fillText('장', o, -o);
  ctx.fillText('갈', -o, o); ctx.fillText('피', o, o);
  ctx.restore();
}

// 글씨 뒤를 한지색으로 은은하게 비워, 배경 그림과 겹쳐도 글자가 또렷하게 읽히게 한다
function drawPaperGlow(ctx, cx, cy, rx, ry, paper, alpha) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, hexToRgba(paper, alpha));
  g.addColorStop(0.62, hexToRgba(paper, alpha * 0.85));
  g.addColorStop(1, hexToRgba(paper, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

async function renderQuoteImage(q) {
  const brush = '"Nanum Brush Script", "Fraunces", serif';
  if (document.fonts && document.fonts.load) {
    try { await document.fonts.load('64px "Nanum Brush Script"', q.text + (q.source || '') + '문장갈피'); } catch (e) { /* ignore */ }
  }
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* ignore */ } }
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(String(q.id) + q.text);
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue('--paper').trim() || '#F7F3EC';
  const accent = cs.getPropertyValue('--season-accent').trim() || '#C1544A';
  const ink = '#241F1B';

  drawHanjiPaper(ctx, W, H, paper, rand);

  // 계절 수묵화 (왼쪽 아래) — 가장자리를 한지에 스며들듯 흐리게
  const art = await loadImageFromCssVar('--season-art');
  if (art) {
    const aw = 700, ah = Math.round(aw * art.naturalHeight / art.naturalWidth);
    const layer = document.createElement('canvas');
    layer.width = aw; layer.height = ah;
    const lc = layer.getContext('2d');
    lc.drawImage(art, 0, 0, aw, ah);
    lc.globalCompositeOperation = 'destination-in';
    const gx = lc.createLinearGradient(0, 0, aw, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.22, '#000'); gx.addColorStop(0.78, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = gx; lc.fillRect(0, 0, aw, ah);
    const gy = lc.createLinearGradient(0, 0, 0, ah);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.24, '#000'); gy.addColorStop(0.82, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = gy; lc.fillRect(0, 0, aw, ah);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.85;
    ctx.drawImage(layer, -50, H - ah + 10); ctx.restore();
  }

  // 붓글씨 문장
  ctx.textBaseline = 'alphabetic';
  const maxWidth = W - 300;
  const textTop = 230, textBottomLimit = H - 400;
  let fontSize = 120, lines = [], lineHeight = 0;
  while (fontSize > 40) {
    ctx.font = `${fontSize}px ${brush}`;
    lines = wrapCanvasText(ctx, q.text, maxWidth);
    lineHeight = fontSize * 1.38;
    if (lines.length * lineHeight <= (textBottomLimit - textTop)) break;
    fontSize -= 4;
  }
  ctx.font = `${fontSize}px ${brush}`;
  const blockHeight = lines.length * lineHeight;
  const top = textTop + Math.max(0, (textBottomLimit - textTop - blockHeight) / 2);
  const lineW = Math.max.apply(null, lines.map((l) => ctx.measureText(l).width));
  drawPaperGlow(ctx, W / 2, top + blockHeight / 2, lineW / 2 + 130, blockHeight / 2 + 90, paper, 0.9);
  let y = top + fontSize * 0.95;
  lines.forEach((line) => { drawBrushLine(ctx, line, W / 2, y, rand, ink); y += lineHeight; });
  const blockBottom = top + blockHeight;

  // 붓질 한 획
  drawBrushStroke(ctx, W / 2 - 180, blockBottom + 14, 360, hexToRgba(accent, 0.55));

  // 출처(낙관 옆 서명처럼 오른쪽 정렬)
  const sealSize = 104;
  const sealX = W - 150 - sealSize, sealY = blockBottom + 80;
  if (q.source) {
    ctx.font = `46px ${brush}`;
    const srcW = ctx.measureText(`— ${q.source}`).width;
    drawPaperGlow(ctx, sealX - 24 - srcW / 2, sealY + sealSize * 0.5, srcW / 2 + 70, 60, paper, 0.85);
    ctx.fillStyle = 'rgba(36,31,27,0.82)'; ctx.textAlign = 'right';
    ctx.fillText(`— ${q.source}`, sealX - 24, sealY + sealSize * 0.62);
    ctx.textAlign = 'left';
  }
  drawSeal(ctx, sealX, sealY, sealSize);

  // 위쪽 제목: 직접 쓴 붓글씨 이미지
  const titleImg = await new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = 'art/title.png';
  });
  if (titleImg) {
    const tw = 280, th = Math.round(tw * titleImg.naturalHeight / titleImg.naturalWidth);
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.drawImage(titleImg, (W - tw) / 2, 72, tw, th);
    ctx.restore();
  } else {
    ctx.font = `52px ${brush}`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(36,31,27,0.55)';
    ctx.fillText('문장갈피', W / 2, 130);
    ctx.textAlign = 'left';
  }

  // 얇은 테두리
  ctx.strokeStyle = 'rgba(36,31,27,0.22)'; ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  return canvas;
}

async function shareQuoteImage(q) {
  toast('이미지를 만들고 있어요…');
  let canvas;
  try {
    canvas = await renderQuoteImage(q);
  } catch (e) {
    toast('이미지 생성에 실패했어요');
    return;
  }
  canvas.toBlob(async (blob) => {
    if (!blob) { toast('이미지 생성에 실패했어요'); return; }
    const file = new File([blob], `quote-box-${q.id}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '문장갈피' });
        return;
      } catch (e) { /* cancelled or unsupported — fall through to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quote-box-${q.id}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast('이미지를 저장했어요');
  }, 'image/png');
}

/* ===================== Today's pick ===================== */
function pickToday(crossfade) {
  const card = document.getElementById('today-pick');
  if (state.items.length === 0) {
    card.classList.add('hidden');
    return;
  }
  const pool = state.items.filter(q => q.id !== state.todayId);
  const pick = (pool.length > 0 ? pool : state.items)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : state.items.length))];
  state.todayId = pick.id;
  pick.viewCount = (pick.viewCount || 0) + 1;
  saveQuotes(state.items);
  card.classList.remove('hidden');

  const textEl = document.getElementById('today-text');
  const sourceEl = document.getElementById('today-source');
  const applyText = () => {
    textEl.textContent = pick.text;
    sourceEl.textContent = pick.source ? `— ${pick.source}` : '';
    // 먹이 번지듯 나타나는 효과를 매번 다시 재생
    textEl.classList.remove('ink-in');
    void textEl.offsetWidth;
    textEl.classList.add('ink-in');
  };
  if (!crossfade) { applyText(); return; }
  textEl.classList.add('fading');
  sourceEl.classList.add('fading');
  setTimeout(() => {
    applyText();
    textEl.classList.remove('fading');
    sourceEl.classList.remove('fading');
  }, 180);
}
document.getElementById('btn-shuffle').addEventListener('click', () => {
  const btn = document.getElementById('btn-shuffle');
  btn.classList.remove('spin');
  void btn.offsetWidth; // restart animation on repeated clicks
  btn.classList.add('spin');
  pickToday(true);
});

/* ===================== Today's pick size control ===================== */
const TODAY_SIZE_KEY = 'quoteBoxTodaySize';
const TODAY_SIZES = ['sm', 'md', 'lg', 'xl'];
state.todaySize = TODAY_SIZES.includes(localStorage.getItem(TODAY_SIZE_KEY)) ? localStorage.getItem(TODAY_SIZE_KEY) : 'md';
function applyTodaySize() {
  document.getElementById('today-pick').dataset.size = state.todaySize;
  document.getElementById('btn-today-size-down').disabled = state.todaySize === TODAY_SIZES[0];
  document.getElementById('btn-today-size-up').disabled = state.todaySize === TODAY_SIZES[TODAY_SIZES.length - 1];
}
function changeTodaySize(delta) {
  const idx = TODAY_SIZES.indexOf(state.todaySize);
  const next = TODAY_SIZES[Math.min(TODAY_SIZES.length - 1, Math.max(0, idx + delta))];
  if (next === state.todaySize) return;
  state.todaySize = next;
  localStorage.setItem(TODAY_SIZE_KEY, next);
  applyTodaySize();
}
document.getElementById('btn-today-size-down').addEventListener('click', (e) => { e.stopPropagation(); changeTodaySize(-1); });
document.getElementById('btn-today-size-up').addEventListener('click', (e) => { e.stopPropagation(); changeTodaySize(1); });
applyTodaySize();

document.getElementById('btn-add-quote').addEventListener('click', () => {
  document.getElementById('add-quote-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('quote-text').focus({ preventScroll: true });
});

document.getElementById('btn-sort').addEventListener('click', () => {
  const idx = SORT_CYCLE.indexOf(state.sortMode);
  state.sortMode = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
  if (state.sortMode === 'shuffle') {
    state.shuffleOrder = [...state.items].map(q => q.id).sort(() => Math.random() - 0.5);
  }
  toast(`${SORT_LABEL[state.sortMode]}으로 정렬했어요`);
  renderQuotesWithFade();
});

/* ===================== Rendering ===================== */
function renderQuotes() {
  renderTagFilters();
  const list = document.getElementById('quote-list');
  list.innerHTML = '';

  let items = [...state.items];
  if (state.sortMode === 'oldest') {
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else if (state.sortMode === 'shuffle' && state.shuffleOrder) {
    const order = state.shuffleOrder;
    items.sort((a, b) => {
      const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  } else {
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (state.filter === 'fav') items = items.filter(q => q.favorite);
  if (state.filter === 'frequent') items = items.filter(q => q.viewCount > 0).sort((a, b) => b.viewCount - a.viewCount);
  if (state.tagFilter) {
    const t = state.tagFilter.toLowerCase();
    items = items.filter(q => (q.tags || []).some(tag => tag.toLowerCase() === t));
  }
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    items = items.filter(it => it.text.toLowerCase().includes(q)
      || (it.source || '').toLowerCase().includes(q)
      || (it.notes || []).some(n => n.text.toLowerCase().includes(q))
      || (it.tags || []).some(tag => tag.toLowerCase().includes(q)));
  }

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-state">${state.items.length === 0
      ? '아직 담아둔 문장이 없어요.<br>마음에 남는 문장을 적어보세요 💬'
      : '조건에 맞는 문장이 없어요.'}</p>`;
    return;
  }

  items.forEach(q => {
    const tags = q.tags || [];
    const notes = q.notes || [];
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    if (state.lastAddedId === q.id) card.classList.add('enter');
    if (q.favorite) {
      card.classList.add('is-fav');
      if (state.pulseFavId === q.id) card.classList.add('fold-in');
    }
    card.innerHTML = `
      <p class="quote-text" title="눌러서 느낀 점 남기기">${escapeHtml(q.text)}</p>
      ${q.source ? `<p class="quote-source">— ${escapeHtml(q.source)}</p>` : ''}
      ${isSafeUrl(q.link) ? `<a class="quote-link" href="${escapeHtml(q.link)}" target="_blank" rel="noopener noreferrer">🔗 링크 보기</a>` : ''}
      <div class="quote-notes">${notes.map(noteItemHTML).join('')}</div>
      <div class="quote-note-compose-slot"></div>
      ${tags.length ? `<div class="quote-topics">${tags.map(t => `<span class="topic-pill" data-topic="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="quote-foot">
        <span class="quote-date">${formatDate(q.createdAt)}</span>
        <div class="quote-actions">
          <button class="quote-image-btn" title="이미지로 공유" aria-label="이미지로 공유"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17.5l5-5 3.5 3.5 2.5-2.5 4 4"/></svg></button>
          <button class="quote-edit-btn" title="문장 수정" aria-label="문장 수정"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5l.9-3.9L16.3 4.7a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8.4 18.6z"/><path d="M14.5 6.5l3 3"/></svg></button>
          <button class="quote-fav-btn${q.favorite ? ' on' : ''}" title="즐겨찾기" aria-label="즐겨찾기" aria-pressed="${q.favorite ? 'true' : 'false'}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.9l-5.1 2.6 1-5.7-4.1-4 5.7-.8z"/></svg></button>
        </div>
      </div>
    `;
    card.querySelector('.quote-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(q.id);
    });
    card.querySelector('.quote-image-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      shareQuoteImage(q);
    });
    const favBtn = card.querySelector('.quote-fav-btn');
    if (state.pulseFavId === q.id) favBtn.classList.add('pop');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(q.id);
    });
    const linkEl = card.querySelector('.quote-link');
    if (linkEl) linkEl.addEventListener('click', (e) => e.stopPropagation());
    card.querySelectorAll('.topic-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        setTagFilter(pill.dataset.topic);
      });
    });
    card.querySelector('.quote-text').addEventListener('click', (e) => {
      e.stopPropagation();
      openNoteComposer(card, q);
    });
    card.querySelectorAll('.quote-note-item').forEach((itemEl) => {
      const noteId = itemEl.dataset.noteId;
      const note = notes.find(n => n.id === noteId);
      if (!note) return;
      itemEl.querySelector('.quote-note-text').addEventListener('click', (e) => {
        e.stopPropagation();
        openNoteItemEditor(itemEl, q, note);
      });
      itemEl.querySelector('.quote-note-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!(await confirmDialog('이 기록을 삭제할까요?', '삭제'))) return;
        q.notes = (q.notes || []).filter(n => n.id !== noteId);
        saveQuotes(state.items);
        syncCloudBackup();
        renderQuotes();
      });
    });
    card.addEventListener('click', () => openEditModal(q.id));
    card.addEventListener('keydown', (e) => {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditModal(q.id); }
    });
    list.appendChild(card);
  });
  state.lastAddedId = null;
  state.pulseFavId = null;
}

function noteItemHTML(n) {
  return `
    <div class="quote-note-item" data-note-id="${n.id}">
      <p class="quote-note-text" title="눌러서 수정">💭 ${escapeHtml(n.text)}</p>
      <div class="quote-note-meta">
        <span class="quote-note-date">${formatDate(n.createdAt)}</span>
        <button class="quote-note-del" title="삭제">✕</button>
      </div>
    </div>
  `;
}

function buildNoteEditor({ initialText, placeholder, saveLabel, onSave, onCancel }) {
  const wrap = document.createElement('div');
  wrap.className = 'quote-note-edit reveal';
  const ta = document.createElement('textarea');
  ta.rows = 2;
  ta.placeholder = placeholder;
  ta.value = initialText || '';
  const actions = document.createElement('div');
  actions.className = 'quote-note-edit-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary btn-small-note';
  cancelBtn.textContent = '취소';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary btn-small-note';
  saveBtn.textContent = saveLabel;
  actions.append(cancelBtn, saveBtn);
  wrap.append(ta, actions);
  wrap.addEventListener('click', (e) => e.stopPropagation());
  cancelBtn.addEventListener('click', onCancel);
  saveBtn.addEventListener('click', () => onSave(ta.value.trim()));
  return { wrap, ta };
}

function openNoteComposer(card, q) {
  const slot = card.querySelector('.quote-note-compose-slot');
  if (!slot) return;
  const existingTa = slot.querySelector('textarea');
  if (existingTa) { existingTa.focus(); return; }
  const { wrap, ta } = buildNoteEditor({
    initialText: '',
    placeholder: '이 문장을 보고 느낀 점, 깨달은 것을 남겨보세요',
    saveLabel: '남기기',
    onCancel: () => renderQuotes(),
    onSave: (val) => {
      if (!val) { renderQuotes(); return; }
      q.notes = q.notes || [];
      q.notes.push({ id: uid(), text: val, createdAt: new Date().toISOString() });
      saveQuotes(state.items);
      syncCloudBackup();
      renderQuotes();
      pickToday();
    },
  });
  slot.appendChild(wrap);
  ta.focus();
}

function openNoteItemEditor(itemEl, q, note) {
  if (itemEl.querySelector('textarea')) return;
  const { wrap, ta } = buildNoteEditor({
    initialText: note.text,
    placeholder: '느낀 점, 깨달은 것',
    saveLabel: '저장',
    onCancel: () => renderQuotes(),
    onSave: (val) => {
      if (!val) return;
      note.text = val;
      saveQuotes(state.items);
      syncCloudBackup();
      renderQuotes();
    },
  });
  itemEl.innerHTML = '';
  itemEl.appendChild(wrap);
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
  const allTags = [...counts.values()].sort((a, b) => a.label.localeCompare(b.label, 'ko'));

  let visibleTags = allTags;
  const overCap = allTags.length > TAG_FILTER_CAP;
  if (overCap && !state.tagFilterExpanded) {
    const topByUsage = [...allTags].sort((a, b) => b.count - a.count).slice(0, TAG_FILTER_CAP);
    const topKeys = new Set(topByUsage.map(t => t.label.toLowerCase()));
    if (state.tagFilter) topKeys.add(state.tagFilter.toLowerCase());
    visibleTags = allTags.filter(t => topKeys.has(t.label.toLowerCase()));
  }

  let html = visibleTags.map(t => `<button class="tag-filter-btn${state.tagFilter && state.tagFilter.toLowerCase() === t.label.toLowerCase() ? ' active' : ''}" data-topic="${escapeHtml(t.label)}">#${escapeHtml(t.label)}</button>`).join('');
  if (overCap) {
    html += state.tagFilterExpanded
      ? `<button class="tag-filter-more" id="btn-tag-filter-more">접기</button>`
      : `<button class="tag-filter-more" id="btn-tag-filter-more">+${allTags.length - visibleTags.length}개 더보기</button>`;
  }
  row.innerHTML = html;
  row.querySelectorAll('.tag-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setTagFilter(btn.dataset.topic));
  });
  const moreBtn = document.getElementById('btn-tag-filter-more');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      state.tagFilterExpanded = !state.tagFilterExpanded;
      renderTagFilters();
    });
  }
}

function renderQuotesWithFade() {
  const list = document.getElementById('quote-list');
  list.classList.add('list-fading');
  setTimeout(() => {
    renderQuotes();
    requestAnimationFrame(() => list.classList.remove('list-fading'));
  }, 120);
}

function setTagFilter(tag) {
  state.tagFilter = (state.tagFilter && state.tagFilter.toLowerCase() === tag.toLowerCase()) ? null : tag;
  renderQuotesWithFade();
}

function toggleFavorite(id) {
  const q = state.items.find(it => it.id === id);
  if (!q) return;
  q.favorite = !q.favorite;
  saveQuotes(state.items);
  syncCloudBackup();
  state.pulseFavId = id;
  renderQuotes();
}

/* ===================== Filters & search ===================== */
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn));
    renderQuotesWithFade();
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
  const link = document.getElementById('quote-link').value.trim();
  const noteText = document.getElementById('quote-note').value.trim();
  const tags = parseTags(document.getElementById('quote-tags').value);
  const createdAt = new Date().toISOString();
  const notes = noteText ? [{ id: uid(), text: noteText, createdAt }] : [];
  const newId = uid();
  state.items.push({
    id: newId, text, source, link, notes, tags, favorite: false, createdAt,
  });
  saveQuotes(state.items);
  syncCloudBackup();
  textInput.value = '';
  document.getElementById('quote-source').value = '';
  document.getElementById('quote-link').value = '';
  document.getElementById('quote-note').value = '';
  document.getElementById('quote-tags').value = '';
  state.lastAddedId = newId;
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
  document.getElementById('edit-link').value = q.link || '';
  document.getElementById('edit-tags').value = (q.tags || []).join(', ');
  openModal(editModal, { autofocus: false });
}
function closeEditModal() { closeModal(editModal); state.editingId = null; }
document.getElementById('modal-edit-close').addEventListener('click', closeEditModal);
document.getElementById('btn-cancel-edit').addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

document.getElementById('form-quote-edit').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = state.items.find(it => it.id === state.editingId);
  if (!q) return;
  const text = document.getElementById('edit-text').value.trim();
  if (!text) return;
  q.text = text;
  q.source = document.getElementById('edit-source').value.trim();
  q.link = document.getElementById('edit-link').value.trim();
  q.tags = parseTags(document.getElementById('edit-tags').value);
  saveQuotes(state.items);
  syncCloudBackup();
  closeEditModal();
  renderQuotes();
  pickToday();
});

document.getElementById('btn-delete-quote').addEventListener('click', async () => {
  if (!(await confirmDialog('이 문장을 삭제할까요?', '삭제'))) return;
  state.items = state.items.filter(it => it.id !== state.editingId);
  saveQuotes(state.items);
  syncCloudBackup();
  closeEditModal();
  renderQuotes();
  pickToday();
});

/* ===================== Stats / timeline (모아보기) ===================== */
const statsModal = document.getElementById('modal-stats');
function renderStats() {
  const body = document.getElementById('stats-body');
  const items = state.items;
  const total = items.length;

  if (total === 0) {
    body.innerHTML = `<p class="hint-text">아직 담아둔 문장이 없어요. 문장을 담으면 여기에 기록이 쌓여요.</p>`;
    openModal(statsModal);
    return;
  }

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisYear = now.getFullYear();
  let monthCount = 0, yearCount = 0;
  const monthGroups = new Map();
  items.forEach(q => {
    const d = new Date(q.createdAt);
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthGroups.set(key, (monthGroups.get(key) || 0) + 1);
    if (key === thisMonthKey) monthCount += 1;
    if (d.getFullYear() === thisYear) yearCount += 1;
  });
  const monthKeys = [...monthGroups.keys()].sort().reverse();
  const topViewed = [...items].filter(q => q.viewCount > 0).sort((a, b) => b.viewCount - a.viewCount).slice(0, 3);
  const oldest = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const truncate = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;

  body.innerHTML = `
    <div class="stats-highlight">
      <div class="stats-number">${total}</div>
      <div class="stats-number-label">모아둔 문장</div>
    </div>
    <p class="hint-text" style="text-align:center">이번 달 ${monthCount}개 · 올해 ${yearCount}개 담았어요</p>

    <div class="stats-section">
      <h3 class="block-title">월별로</h3>
      ${monthKeys.map(k => {
        const [y, m] = k.split('.');
        return `<div class="stats-row"><span>${y}년 ${Number(m)}월</span><span class="count">${monthGroups.get(k)}개</span></div>`;
      }).join('')}
    </div>

    ${topViewed.length ? `
    <div class="stats-section">
      <h3 class="block-title">자주 꺼내본 문장</h3>
      ${topViewed.map(q => `
        <p class="stats-quote-preview">${escapeHtml(truncate(q.text, 60))}</p>
        <p class="stats-quote-meta">${q.source ? escapeHtml(q.source) + ' · ' : ''}${q.viewCount}번 봤어요</p>
      `).join('')}
    </div>` : ''}

    <div class="stats-section">
      <h3 class="block-title">처음 담은 문장</h3>
      <p class="stats-quote-preview">${escapeHtml(truncate(oldest.text, 80))}</p>
      <p class="stats-quote-meta">${formatDate(oldest.createdAt)}${oldest.source ? ' · ' + escapeHtml(oldest.source) : ''}</p>
    </div>
  `;
  openModal(statsModal);
}
document.getElementById('btn-stats').addEventListener('click', renderStats);
document.getElementById('modal-stats-close').addEventListener('click', () => closeModal(statsModal));
statsModal.addEventListener('click', (e) => { if (e.target === statsModal) closeModal(statsModal); });

/* ===================== Share ===================== */
const shareModal = document.getElementById('modal-share');
function shareUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}
function buildQrSvg(text) {
  for (let type = 2; type <= 20; type += 1) {
    try {
      const qr = qrcode(type, 'M');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ scalable: true });
    } catch (e) { /* text too long for this type, try a bigger one */ }
  }
  return '';
}
document.getElementById('btn-share').addEventListener('click', () => {
  const url = shareUrl();
  document.getElementById('share-qr').innerHTML = buildQrSvg(url);
  document.getElementById('share-link-input').value = url;
  openModal(shareModal);
});
document.getElementById('modal-share-close').addEventListener('click', () => closeModal(shareModal));
shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeModal(shareModal); });

document.getElementById('btn-copy-link').addEventListener('click', async () => {
  const input = document.getElementById('share-link-input');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (e) {
    input.select();
    document.execCommand('copy');
  }
  toast('링크를 복사했어요');
});

/* ===================== Cloud backup (optional, no login) ===================== */
let cloudDb = null;
if (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.apiKey && window.__FIREBASE_CONFIG__.apiKey !== 'YOUR_API_KEY') {
  try {
    firebase.initializeApp(window.__FIREBASE_CONFIG__);
    cloudDb = firebase.firestore();
  } catch (e) { cloudDb = null; }
}

const CLOUD_NICKNAME_KEY = 'quoteBoxCloudNickname';
const CLOUD_HASH_KEY = 'quoteBoxCloudHash';
state.cloudNickname = localStorage.getItem(CLOUD_NICKNAME_KEY) || null;
state.cloudHash = localStorage.getItem(CLOUD_HASH_KEY) || null;

async function hashKey(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function syncCloudBackup() {
  if (!cloudDb || !state.cloudHash) return;
  cloudDb.collection('backups').doc(state.cloudHash).set({
    nickname: state.cloudNickname,
    items: state.items,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(() => { /* offline or blocked — will retry on the next change */ });
}

function updateCloudBackupUI() {
  const unavailableEl = document.getElementById('cloud-backup-unavailable');
  const connectedEl = document.getElementById('cloud-backup-connected');
  const setupEl = document.getElementById('cloud-backup-setup');
  if (!cloudDb) {
    unavailableEl.classList.remove('hidden');
    connectedEl.classList.add('hidden');
    setupEl.classList.add('hidden');
    return;
  }
  unavailableEl.classList.add('hidden');
  if (state.cloudHash) {
    connectedEl.classList.remove('hidden');
    setupEl.classList.add('hidden');
    document.getElementById('cloud-backup-nickname-display').textContent = state.cloudNickname || '';
  } else {
    connectedEl.classList.add('hidden');
    setupEl.classList.remove('hidden');
  }
}

document.getElementById('form-cloud-setup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('cloud-setup-error');
  errEl.textContent = '';
  const nickname = document.getElementById('cloud-nickname').value.trim();
  const password = document.getElementById('cloud-password').value.trim();
  const hint = document.getElementById('cloud-hint').value.trim();
  if (!/^\d{4}$/.test(password)) { errEl.textContent = '암호는 숫자 4자리로 입력해주세요'; return; }
  if (!cloudDb) { errEl.textContent = '백업 기능을 아직 쓸 수 없어요'; return; }
  try {
    const hash = await hashKey(password);
    await cloudDb.collection('backupHints').doc(nickname).set({
      hint, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await cloudDb.collection('backups').doc(hash).set({
      nickname, items: state.items, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    state.cloudNickname = nickname;
    state.cloudHash = hash;
    localStorage.setItem(CLOUD_NICKNAME_KEY, nickname);
    localStorage.setItem(CLOUD_HASH_KEY, hash);
    document.getElementById('form-cloud-setup').reset();
    updateCloudBackupUI();
    toast('백업을 시작했어요');
  } catch (err) {
    errEl.textContent = '백업 설정에 실패했어요: ' + (err.code || err.message);
  }
});

document.getElementById('btn-cloud-disconnect').addEventListener('click', async () => {
  if (!(await confirmDialog('이 기기의 자동 백업 연결을 해제할까요? (클라우드에 저장된 데이터는 그대로 남아있고, 나중에 같은 암호로 다시 연결할 수 있어요)', '연결 해제'))) return;
  state.cloudNickname = null;
  state.cloudHash = null;
  localStorage.removeItem(CLOUD_NICKNAME_KEY);
  localStorage.removeItem(CLOUD_HASH_KEY);
  updateCloudBackupUI();
  toast('연결을 해제했어요');
});

document.getElementById('btn-view-hint').addEventListener('click', async () => {
  const nickname = document.getElementById('restore-nickname').value.trim();
  const displayEl = document.getElementById('restore-hint-display');
  displayEl.textContent = '';
  if (!nickname || !cloudDb) return;
  try {
    const doc = await cloudDb.collection('backupHints').doc(nickname).get();
    displayEl.textContent = (doc.exists && doc.data().hint)
      ? '💡 힌트: ' + doc.data().hint
      : '그 이름으로 된 힌트를 못 찾았어요.';
  } catch (err) {
    displayEl.textContent = '힌트를 불러오지 못했어요.';
  }
});

document.getElementById('form-cloud-restore').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('cloud-restore-error');
  errEl.textContent = '';
  const nickname = document.getElementById('restore-nickname').value.trim();
  const password = document.getElementById('restore-password').value.trim();
  if (!/^\d{4}$/.test(password)) { errEl.textContent = '암호는 숫자 4자리로 입력해주세요'; return; }
  if (!cloudDb) { errEl.textContent = '백업 기능을 아직 쓸 수 없어요'; return; }
  try {
    const hash = await hashKey(password);
    const doc = await cloudDb.collection('backups').doc(hash).get();
    if (!doc.exists) { errEl.textContent = '그 암호로 된 백업을 찾지 못했어요'; return; }
    const data = doc.data();
    const remoteItems = Array.isArray(data.items) ? data.items : [];
    const existingIds = new Set(state.items.map(it => it.id));
    let addedCount = 0;
    remoteItems.forEach((it) => {
      if (it && it.id && !existingIds.has(it.id)) {
        state.items.push(it);
        addedCount += 1;
      }
    });
    saveQuotes(state.items);
    state.cloudNickname = data.nickname || nickname;
    state.cloudHash = hash;
    localStorage.setItem(CLOUD_NICKNAME_KEY, state.cloudNickname);
    localStorage.setItem(CLOUD_HASH_KEY, hash);
    renderQuotes();
    pickToday();
    updateCloudBackupUI();
    document.getElementById('form-cloud-restore').reset();
    document.getElementById('restore-hint-display').textContent = '';
    toast(`${addedCount}개 문장을 복구했어요`);
  } catch (err) {
    errEl.textContent = '복구에 실패했어요: ' + (err.code || err.message);
  }
});

/* ===================== Backup: export / import ===================== */
const backupModal = document.getElementById('modal-backup');
document.getElementById('btn-export').addEventListener('click', () => openModal(backupModal));
document.getElementById('modal-backup-close').addEventListener('click', () => closeModal(backupModal));
backupModal.addEventListener('click', (e) => { if (e.target === backupModal) closeModal(backupModal); });

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

document.getElementById('btn-print-pdf').addEventListener('click', () => {
  if (state.items.length === 0) { toast('담아둔 문장이 없어요'); return; }
  const el = document.getElementById('print-collection');
  const items = [...state.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  el.innerHTML = `
    <h1 class="print-title">문장갈피</h1>
    <p class="print-subtitle">마음에 남는 문장 모음 · ${items.length}개 · ${todayStr()}</p>
    ${items.map(q => `
      <div class="print-quote">
        <p class="print-quote-text">${escapeHtml(q.text)}</p>
        ${q.source ? `<p class="print-quote-source">— ${escapeHtml(q.source)}</p>` : ''}
        <p class="print-quote-meta">${formatDate(q.createdAt)}${(q.tags || []).length ? ' · ' + q.tags.map(t => '#' + escapeHtml(t)).join(' ') : ''}</p>
      </div>
    `).join('')}
  `;
  window.print();
});

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
          const createdAt = it.createdAt || new Date().toISOString();
          const notes = Array.isArray(it.notes)
            ? it.notes.filter(n => n && typeof n.text === 'string' && n.text.trim()).map(n => ({
                id: n.id || uid(), text: n.text, createdAt: n.createdAt || createdAt,
              }))
            : (typeof it.note === 'string' && it.note.trim() ? [{ id: uid(), text: it.note.trim(), createdAt }] : []);
          const tags = Array.isArray(it.tags) ? it.tags.filter(t => typeof t === 'string' && t.trim()) : [];
          const legacyCategoryTag = CATEGORY_TAG_LABEL[it.category];
          if (legacyCategoryTag && !tags.some(t => t.toLowerCase() === legacyCategoryTag.toLowerCase())) {
            tags.push(legacyCategoryTag);
          }
          merged.push({
            id: it.id || uid(),
            text: it.text,
            source: it.source || '',
            link: typeof it.link === 'string' ? it.link : '',
            notes,
            tags,
            favorite: !!it.favorite,
            createdAt,
          });
        }
      });
      state.items = merged;
      saveQuotes(state.items);
      syncCloudBackup();
      renderQuotes();
      pickToday();
      closeModal(backupModal);
      toast(`${imported.length}개 항목을 가져왔어요`);
    } catch (err) {
      toast('파일을 읽을 수 없어요. JSON 형식을 확인해주세요.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ===================== First-run hint ===================== */
const HINT_FLAG_KEY = 'quoteBoxHintDismissed';
if (state.items.length > 0 && !localStorage.getItem(HINT_FLAG_KEY)) {
  document.getElementById('hint-banner').classList.remove('hidden');
}
document.getElementById('hint-banner-close').addEventListener('click', () => {
  localStorage.setItem(HINT_FLAG_KEY, '1');
  document.getElementById('hint-banner').classList.add('hidden');
});

/* ===================== Quick capture (share target / bookmarklet) ===================== */
function appBaseUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

(function handleIncomingShare() {
  const params = new URLSearchParams(location.search);
  const sharedText = (params.get('share_text') || '').trim();
  const sharedTitle = (params.get('share_title') || '').trim();
  const sharedUrl = (params.get('share_url') || '').trim();
  if (!sharedText && !sharedTitle && !sharedUrl) return;

  document.getElementById('quote-text').value = sharedText || sharedTitle;
  if (sharedTitle && sharedText) document.getElementById('quote-source').value = sharedTitle;
  if (sharedUrl) document.getElementById('quote-link').value = sharedUrl;

  history.replaceState(null, '', location.pathname);
  document.getElementById('form-quote-add').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('quote-text').focus();
  toast('가져온 내용을 채워뒀어요. 확인하고 담아두기를 눌러주세요');
})();

function bookmarkletCode() {
  return "(function(){var t=(window.getSelection?window.getSelection().toString():'').trim();"
    + "var u=encodeURIComponent(location.href);var ti=encodeURIComponent(document.title);"
    + "var tx=encodeURIComponent(t);window.open('" + appBaseUrl() + "?share_text='+tx+'&share_title='+ti+'&share_url='+u,'_blank');})();";
}
(function setupBookmarklet() {
  const link = document.getElementById('bookmarklet-link');
  if (link) link.href = 'javascript:' + bookmarkletCode();
})();
const btnCopyBookmarklet = document.getElementById('btn-copy-bookmarklet');
if (btnCopyBookmarklet) {
  btnCopyBookmarklet.addEventListener('click', async () => {
    const text = 'javascript:' + bookmarkletCode();
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast('주소를 복사했어요. 북마크 편집 화면에 붙여넣어주세요');
  });
}

/* ===================== Keyboard: Escape closes the topmost open modal ===================== */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (confirmModal.classList.contains('is-open')) { resolveConfirm(false); return; }
  if (editModal.classList.contains('is-open')) { closeEditModal(); return; }
  if (shareModal.classList.contains('is-open')) { closeModal(shareModal); return; }
  if (backupModal.classList.contains('is-open')) { closeModal(backupModal); return; }
});

/* ===================== Init ===================== */
renderQuotes();
pickToday();
updateCloudBackupUI();
syncCloudBackup();
