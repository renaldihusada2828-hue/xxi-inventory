// ============================================================
// app.js — Main application
// ============================================================

import { getProducts } from './products.js';
import { submitTransaksi, getLog, getExpiringProducts } from './transactions.js';import {
  escHtml, formatDate, formatDateTime,
  highlightMatch, showToast, showSpinner,
} from './utils.js';

// ============================================================
// STATE
// ============================================================
let allProducts      = [];
let filteredProducts = [];
let selectedProduct  = null;
let highlightIdx     = -1;
let currentType      = 'PENAMBAHAN';
let currentMode      = 'HARIAN';

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  buildTanggal();
  loadProducts();
  loadExpiring();   // tab expired auto-load
  loadLog();        // tab log auto-load
  // tab stok dimuat hanya saat diklik (lihat switchTab)

  document.addEventListener('click', (e) => {
    if (
      !document.getElementById('inp-produk')?.contains(e.target) &&
      !document.getElementById('ac-dropdown')?.contains(e.target)
    ) closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement?.id === 'inp-jumlah') {
      handleSubmit();
    }
  });
});

// ============================================================
// TANGGAL SELECT
// ============================================================
function buildTanggal() {
  const today = new Date().getDate();
  const sel   = document.getElementById('sel-tanggal');
  for (let d = 1; d <= 31; d++) {
    const o = document.createElement('option');
    o.value       = d;
    o.textContent = `Tanggal ${d}`;
    if (d === today) o.selected = true;
    sel.appendChild(o);
  }
}

// ============================================================
// LOAD PRODUCTS
// ============================================================
async function loadProducts(force = false) {
  showSpinner(true);
  try {
    const res = await getProducts(force);
    showSpinner(false);
    if (!res.success) { showToast('Gagal memuat produk: ' + res.message, 'error'); return; }
    allProducts = res.data;

    if (selectedProduct) {
      const found = allProducts.find(p => p.id === selectedProduct.id);
      if (found) { selectedProduct = found; renderStokInfo(found); }
      else { clearProduk(); }
    }
    // Update sheet label dengan jumlah produk
    const lbl = document.getElementById('sheet-label');
    if (lbl) lbl.textContent = `Gudang Transit · ${allProducts.length} produk`;
  } catch (e) {
    showSpinner(false);
    showToast('Error: ' + e.message, 'error');
  }
}

// ============================================================
// PRODUCT LIST
// ============================================================
function getProductList() {
  if (currentType === 'PENAMBAHAN' && currentMode === 'MINGGUAN') {
    return allProducts.filter(p => p.is_weekly);
  }
  return allProducts;
}

function getCategory(p) {
  if (p.is_usage)  return 'USAGE';
  if (p.is_weekly) return 'WEEKLY';
  return 'LAINNYA';
}

const CAT_ORDER = ['USAGE', 'WEEKLY', 'LAINNYA'];

// ============================================================
// DROPDOWN
// ============================================================
function openDropdown()  { document.getElementById('ac-dropdown').classList.add('open'); }
function closeDropdown() { document.getElementById('ac-dropdown').classList.remove('open'); highlightIdx = -1; }

window.onProdukFocus = () => {
  renderDropdown(document.getElementById('inp-produk').value);
  openDropdown();
};

window.onProdukInput = () => {
  selectedProduct = null;
  document.getElementById('stok-info').style.display = 'none';
  renderDropdown(document.getElementById('inp-produk').value);
  openDropdown();
};

function renderDropdown(query) {
  const q       = query.trim().toLowerCase();
  const list    = getProductList();
  const matched = q ? list.filter(p => p.produk.toLowerCase().includes(q)) : list;

  const sorted = [];
  CAT_ORDER.forEach(cat => matched.filter(p => getCategory(p) === cat).forEach(p => sorted.push(p)));
  filteredProducts = sorted;

  const dd = document.getElementById('ac-dropdown');
  if (!filteredProducts.length) {
    dd.innerHTML = '<div class="ac-empty">Produk tidak ditemukan.</div>';
    return;
  }

  let html = '';
  let lastCat = '';
  filteredProducts.forEach((p, i) => {
    const cat = getCategory(p);
    if (cat !== lastCat) {
      html += `<div class="ac-category">${escHtml(cat)}</div>`;
      lastCat = cat;
    }
    html += `<div class="ac-item" data-idx="${i}">${highlightMatch(p.produk, q)}</div>`;
  });
  dd.innerHTML = html;

  dd.querySelectorAll('.ac-item').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectProduk(parseInt(el.dataset.idx));
    });
  });
}

window.onProdukKeydown = (e) => {
  const dd    = document.getElementById('ac-dropdown');
  const items = dd.querySelectorAll('.ac-item');

  if (!dd.classList.contains('open')) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') window.onProdukFocus();
    return;
  }
  if      (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, items.length - 1); }
  else if (e.key === 'ArrowUp')   { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightIdx >= 0) selectProduk(highlightIdx);
    else if (filteredProducts.length === 1) selectProduk(0);
  }
  else if (e.key === 'Escape') { closeDropdown(); return; }

  items.forEach((x, i) => x.classList.toggle('hi', i === highlightIdx));
};

function selectProduk(idx) {
  const p = filteredProducts[idx];
  if (!p) return;
  selectedProduct = p;
  document.getElementById('inp-produk').value = p.produk;
  closeDropdown();
  renderStokInfo(p);
  document.getElementById('inp-jumlah')?.focus();
}

function clearProduk() {
  selectedProduct = null;
  document.getElementById('inp-produk').value = '';
  document.getElementById('stok-info').style.display = 'none';
  closeDropdown();
}

function resolveManualProduct() {
  const typed = document.getElementById('inp-produk').value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!typed) return null;
  const found = getProductList().find(p =>
    p.produk.trim().toLowerCase().replace(/\s+/g, ' ') === typed
  );
  if (found) {
    selectedProduct = found;
    document.getElementById('inp-produk').value = found.produk;
    renderStokInfo(found);
    return found;
  }
  return null;
}

// ============================================================
// STOK INFO
// ============================================================
function renderStokInfo(p) {
  const el = document.getElementById('stok-info');
  el.style.display = 'inline-flex';
  if      (p.sisa_stok <= 0) { el.className = 'stok-badge empty'; el.textContent = `Stok habis · ${p.sisa_stok}`; }
  else if (p.sisa_stok <= 5) { el.className = 'stok-badge low';   el.textContent = `Stok rendah · ${p.sisa_stok}`; }
  else                       { el.className = 'stok-badge ok';    el.textContent = `Sisa: ${p.sisa_stok}`; }
}

// ============================================================
// TYPE & MODE
// ============================================================
window.setType = (type) => {
  currentType  = type;
  const isAdd  = type === 'PENAMBAHAN';

  document.getElementById('btn-add').className    = 'toggle-btn' + (isAdd  ? ' active-add'   : '');
  document.getElementById('btn-reduce').className = 'toggle-btn' + (!isAdd ? ' active-reduce' : '');
  document.getElementById('mode-section').style.display = isAdd ? 'block' : 'none';

  if (!isAdd) {
    currentMode = 'HARIAN';
    document.getElementById('btn-harian').classList.add('active');
    document.getElementById('btn-mingguan').classList.remove('active');
    document.getElementById('group-tanggal').style.display = 'block';
    document.getElementById('group-minggu').style.display  = 'none';
  }

  document.getElementById('exp-box').style.display = isAdd ? 'block' : 'none';
  const btn    = document.getElementById('btn-submit');
  btn.textContent = isAdd ? 'Simpan Penambahan' : 'Simpan Pengurangan';
  btn.className   = 'btn-submit ' + (isAdd ? 'add' : 'reduce');
  clearProduk();
};

window.setMode = (mode) => {
  currentMode     = mode;
  const isHarian  = mode === 'HARIAN';
  document.getElementById('btn-harian').classList.toggle('active',  isHarian);
  document.getElementById('btn-mingguan').classList.toggle('active', !isHarian);
  document.getElementById('group-tanggal').style.display = isHarian ? 'block' : 'none';
  document.getElementById('group-minggu').style.display  = isHarian ? 'none'  : 'block';
  clearProduk();
};

window.toggleExpInput = () => {
  const noExp = document.getElementById('chk-no-exp').checked;
  const inp   = document.getElementById('inp-exp');
  inp.disabled = noExp;
  if (noExp) inp.value = '';
};

// ============================================================
// SUBMIT
// ============================================================
window.submitTransaksiHandler = handleSubmit;

async function handleSubmit() {
  if (!selectedProduct) {
    const m = resolveManualProduct();
    if (!m) { showToast('Produk tidak ditemukan. Ketik sesuai nama di daftar.', 'error'); return; }
  }

  const jumlah       = parseInt(document.getElementById('inp-jumlah').value, 10);
  if (!jumlah || jumlah <= 0) { showToast('Masukkan jumlah yang valid.', 'error'); return; }

  const isPenambahan = currentType === 'PENAMBAHAN';
  const noExp        = document.getElementById('chk-no-exp').checked;
  const expDate      = document.getElementById('inp-exp').value || null;

  if (isPenambahan && !noExp && !expDate) {
    showToast('Isi tanggal EXP atau centang "tanpa EXP".', 'error'); return;
  }
  if (!isPenambahan && jumlah > selectedProduct.sisa_stok) {
    showToast(`Melebihi sisa stok (${selectedProduct.sisa_stok}).`, 'error'); return;
  }

  const ref = currentMode === 'HARIAN'
    ? `Hari ${document.getElementById('sel-tanggal').value}`
    : `Minggu ${document.getElementById('sel-minggu').value}`;

  const btn = document.getElementById('btn-submit');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';
  showSpinner(true);

  try {
    const res = await submitTransaksi({
      productId:        selectedProduct.id,
      produk:           selectedProduct.produk,
      tipe:             currentType,
      jumlah,
      inputMode:        currentMode,
      ref,
      expDate:          isPenambahan && !noExp ? expDate : null,
      noExp,
      sisaStokSekarang: selectedProduct.sisa_stok,
    });

    showSpinner(false);
    btn.disabled    = false;
    btn.textContent = isPenambahan ? 'Simpan Penambahan' : 'Simpan Pengurangan';
    showToast(res.message, 'success');

    document.getElementById('inp-jumlah').value = '';
    document.getElementById('inp-exp').value    = '';
    document.getElementById('chk-no-exp').checked = false;
    window.toggleExpInput();

    await loadProducts(true);
    loadLog();
    loadExpiring();

  } catch (e) {
    showSpinner(false);
    btn.disabled    = false;
    btn.textContent = isPenambahan ? 'Simpan Penambahan' : 'Simpan Pengurangan';
    showToast(e.message, 'error');
  }
}

// ============================================================
// EXPIRING
// ============================================================
async function loadExpiring() {
  const el = document.getElementById('expiring-list');
  if (el) el.innerHTML = '<div class="empty">Memuat...</div>';
  try {
    const res = await getExpiringProducts(30);
    if (!res.success) {
      if (el) el.innerHTML = `<div class="state-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div class="state-empty-title">Gagal memuat</div></div>`;
      return;
    }
    const data = res.data;

    if (!data.length) {
      if (el) el.innerHTML = `
        <div class="state-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div class="state-empty-title">Semua produk masih aman</div>
          <span>Tidak ada produk yang expired dalam 30 hari ke depan.</span>
        </div>`;
      // Kosongkan badge
      const badge = document.getElementById('badge-expired');
      if (badge) badge.textContent = '';
      return;
    }

    // Update badge count
    const badge = document.getElementById('badge-expired');
    if (badge) badge.textContent = data.length;

  if (el) el.innerHTML = `
      <div class="table-scroll">
        <table class="exp-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Tgl EXP</th>
              <th>Qty</th>
              <th>Sisa Waktu</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(x => {
              const cls   = x.daysLeft <= 7  ? 'badge-danger'
                          : x.daysLeft <= 30 ? 'badge-warn' : 'badge-ok';
              const label = x.daysLeft < 0  ? 'EXPIRED'
                          : x.daysLeft === 0 ? 'HARI INI'
                          : `${x.daysLeft} hari`;
              return `<tr>
                <td class="exp-produk">${escHtml(x.produk)}</td>
                <td>${formatDate(x.expDate)}</td>
                <td>${x.qty}</td>
                <td><span class="badge ${cls}">${label}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    if (el) el.innerHTML = `<div class="state-empty"><div class="state-empty-title">Gagal memuat data EXP</div></div>`;
  }
}

window.loadExpiring = loadExpiring;

// ============================================================
// LOG
// ============================================================
window.toggleLog = () => {
  const sec    = document.getElementById('log-section');
  const isOpen = sec.classList.toggle('open');
  if (isOpen && !sec.dataset.loaded) loadLog();
};

async function loadLog() {
  const listEl = document.getElementById('log-list');
  listEl.innerHTML = `<div class="state-loading"><div class="spinner spinner-sm"></div><span>Memuat riwayat...</span></div>`;
  try {
    const res = await getLog(50);
    const sec = document.getElementById('log-section');
    if (!res.success || !res.data.length) {
      listEl.innerHTML = `
        <div class="state-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div class="state-empty-title">Belum ada transaksi</div>
        </div>`;
      if (sec) sec.dataset.loaded = '1';
      return;
    }

    // Update count badge
    const countEl = document.getElementById('log-count');
    if (countEl) countEl.textContent = `${res.data.length} transaksi`;

    listEl.innerHTML = `
      <div class="table-scroll">
        <table class="log-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Produk</th>
              <th>Jumlah</th>
              <th>Sisa</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            ${res.data.map(t => {
              const sisa = t.sisa_stok_setelah === null || t.sisa_stok_setelah === undefined ? '-' : t.sisa_stok_setelah;
              return `<tr>
                <td style="color:var(--n400);white-space:nowrap;font-size:.75rem">${formatDateTime(t.created_at)}</td>
                <td>
                  <div class="log-produk-name">${escHtml(t.produk)}</div>
                  ${t.exp_date ? `<div class="exp-chip">EXP: ${formatDate(t.exp_date)}</div>` : ''}
                </td>
                <td>
                  <span class="${t.tipe === 'PENAMBAHAN' ? 'pill-add' : 'pill-reduce'}">
                    ${t.tipe === 'PENAMBAHAN' ? '+' : '−'}${t.jumlah}
                  </span>
                </td>
                <td><span class="sisa-chip">${escHtml(String(sisa))}</span></td>
                <td style="color:var(--n400);font-size:.75rem">${escHtml(t.ref || '')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    if (sec) sec.dataset.loaded = '1';
  } catch (e) {
    listEl.innerHTML = `<div class="state-empty"><div class="state-empty-title">Gagal memuat riwayat</div></div>`;
  }
}

window.loadLog = loadLog;

// ============================================================
// TAB SYSTEM
// ============================================================

let _activeTab    = 'expired';
let _stokLoaded   = false;
let _allStokRows  = [];  // cache for filter

window.switchTab = function(tab) {
  _activeTab = tab;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');

  // Show/hide panes
  ['expired', 'log', 'stok'].forEach(t => {
    const pane = document.getElementById(`pane-${t}`);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
  });

  // Load stok on first click
  if (tab === 'stok' && !_stokLoaded) {
    loadStokTable();
  }
};

window.refreshCurrentTab = function() {
  if (_activeTab === 'expired') loadExpiring();
  else if (_activeTab === 'log') loadLog();
  else if (_activeTab === 'stok') { _stokLoaded = false; loadStokTable(); }
};

// ============================================================
// STOK TABLE
// ============================================================

async function loadStokTable() {
  const el = document.getElementById('stok-list');
  el.innerHTML = `<div class="state-loading"><div class="spinner spinner-sm"></div><span>Memuat data stok...</span></div>`;

  try {
    const res = await getProducts(true);  // force refresh
    if (!res.success) {
      el.innerHTML = `<div class="state-empty"><div class="state-empty-title">Gagal memuat stok</div><span>${escHtml(res.message)}</span></div>`;
      return;
    }

    _allStokRows = res.data;
    _stokLoaded  = true;
    renderStokTable(_allStokRows);

  } catch (e) {
    el.innerHTML = `<div class="state-empty"><div class="state-empty-title">Gagal memuat stok</div><span>${escHtml(e.message)}</span></div>`;
  }
}

function getStokCategory(p) {
  if (p.is_usage)  return 'USAGE';
  if (p.is_weekly) return 'WEEKLY';
  return 'LAINNYA';
}

function renderStokTable(data) {
  const el      = document.getElementById('stok-list');
  const countEl = document.getElementById('stok-count');
  if (countEl) countEl.textContent = `${data.length} produk`;

  if (!data.length) {
    el.innerHTML = `
      <div class="state-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div class="state-empty-title">Tidak ditemukan</div>
        <span>Coba ubah filter pencarian.</span>
      </div>`;
    return;
  }

  // Hitung max sisa untuk skala bar
  const maxSisa = Math.max(...data.map(p => p.sisa_stok), 1);

  el.innerHTML = `
    <div class="table-scroll">
      <table class="stok-table">
        <thead>
          <tr>
            <th class="stok-no">#</th>
            <th>Nama Produk</th>
            <th>Kategori</th>
            <th>Stok Awal</th>
            <th>Sisa Stok</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((p, i) => {
            const cat     = getStokCategory(p);
            const catCls  = cat === 'USAGE' ? 'cat-usage' : cat === 'WEEKLY' ? 'cat-weekly' : 'cat-lainnya';
            const catLbl  = cat;

            const isEmpty = p.sisa_stok <= 0;
            const isLow   = !isEmpty && p.sisa_stok <= 5;
            const numCls  = isEmpty ? 'sisa-empty' : isLow ? 'sisa-low' : 'sisa-ok';
            const barCls  = isEmpty ? 'sisa-bar-empty' : isLow ? 'sisa-bar-low' : 'sisa-bar-ok';
            const barPct  = Math.min(100, Math.round((p.sisa_stok / maxSisa) * 100));

            return `<tr>
              <td class="stok-no">${i + 1}</td>
              <td class="stok-name">${escHtml(p.produk)}</td>
              <td><span class="stok-cat ${catCls}">${catLbl}</span></td>
              <td style="color:var(--n400)">${p.stock_awal}</td>
              <td>
                <div class="sisa-num ${numCls}">${p.sisa_stok}</div>
                <div class="sisa-bar-wrap">
                  <div class="sisa-bar-fill ${barCls}" style="width:${barPct}%"></div>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ============================================================
// FILTER STOK TABLE
// ============================================================

window.filterStokTable = function() {
  const q       = (document.getElementById('stok-search')?.value || '').trim().toLowerCase();
  const catF    = document.getElementById('stok-filter-cat')?.value || '';
  const statusF = document.getElementById('stok-filter-status')?.value || '';

  let data = _allStokRows.slice();

  if (q) {
    data = data.filter(p => p.produk.toLowerCase().includes(q));
  }
  if (catF) {
    data = data.filter(p => getStokCategory(p) === catF);
  }
  if (statusF === 'low') {
    data = data.filter(p => p.sisa_stok > 0 && p.sisa_stok <= 5);
  } else if (statusF === 'empty') {
    data = data.filter(p => p.sisa_stok <= 0);
  }

  renderStokTable(data);
};
