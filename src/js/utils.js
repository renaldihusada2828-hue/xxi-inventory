// ============================================================
// utils.js
// ============================================================

export function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value + 'T00:00:00');
  if (isNaN(d)) return String(value);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function highlightMatch(text, q) {
  const escaped = escHtml(text);
  if (!q) return escaped;
  const reg = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escaped.replace(reg, '<mark>$1</mark>');
}

export function showToast(msg, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

export function showSpinner(show) {
  document.getElementById('spinner')?.classList.toggle('open', show);
}
