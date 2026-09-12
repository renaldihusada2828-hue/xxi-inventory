// ============================================================
// transactions.js — Transaction logic (penambahan / pengurangan)
// Includes FEFO consume logic
// ============================================================
import { supabase, handleError } from './supabase.js';
import { invalidateCache } from './products.js';

// ============================================================
// SUBMIT TRANSAKSI
// ============================================================

/**
 * Proses satu transaksi penambahan atau pengurangan.
 * Semua validasi & FEFO dijalankan di sini.
 */
export async function submitTransaksi(payload) {
  const {
    productId,
    produk,
    tipe,
    jumlah,
    inputMode,
    ref,
    expDate,   // string YYYY-MM-DD, nullable
    noExp,
    sisaStokSekarang,
  } = payload;

  const isPenambahan = tipe === 'PENAMBAHAN';

  // ---- Validasi jumlah ----
  if (!jumlah || jumlah <= 0) throw new Error('Jumlah harus angka positif.');

  // ---- Validasi EXP untuk penambahan ----
  if (isPenambahan && !noExp) {
    if (!expDate) throw new Error('Tanggal EXP wajib diisi.');
    const exp = new Date(expDate);
    const today = new Date(); today.setHours(0,0,0,0);
    if (exp < today) throw new Error('Tanggal EXP tidak boleh sudah lewat.');
  }

  // ---- Validasi stok sebelum pengurangan ----
  if (!isPenambahan && jumlah > sisaStokSekarang) {
    throw new Error(`Stok tidak mencukupi. Sisa saat ini: ${sisaStokSekarang}`);
  }

  // ---- Hitung sisa stok baru ----
  const sisaBaru = isPenambahan
    ? sisaStokSekarang + jumlah
    : sisaStokSekarang - jumlah;

  if (sisaBaru < 0) throw new Error('Stok tidak mencukupi setelah kalkulasi.');

  // ---- Update sisa_stok di products ----
  const { error: updateErr } = await supabase
    .from('products')
    .update({ sisa_stok: sisaBaru })
    .eq('id', productId);
  if (updateErr) throw new Error(handleError(updateErr));

  // ---- Catat log transaksi ----
  const { error: logErr } = await supabase
    .from('transactions')
    .insert({
      tipe,
      produk,
      jumlah,
      input_mode:        inputMode,
      ref,
      exp_date:          isPenambahan && !noExp ? expDate : null,
      sisa_stok_setelah: sisaBaru,
    });
  if (logErr) throw new Error(handleError(logErr));

  // ---- FEFO: Tambah batch EXP ----
  if (isPenambahan && !noExp) {
    await addExpirationBatch(produk, jumlah, expDate);
  }

  // ---- FEFO: Consume batch EXP ----
  if (!isPenambahan) {
    await consumeExpirationBatches(produk, jumlah);
  }

  // Invalidate cache produk
  invalidateCache();

  return {
    success: true,
    message: isPenambahan ? 'Penambahan berhasil disimpan.' : 'Pengurangan berhasil disimpan.',
    sisaBaru,
  };
}


// ============================================================
// EXPIRATION — TAMBAH BATCH
// ============================================================

export async function addExpirationBatch(produk, qty, expDate) {
  // Generate ID: EXP-XXXXXX
  const { count } = await supabase
    .from('expiration_batches')
    .select('*', { count: 'exact', head: true });

  const nextNum = (count || 0) + 1;
  const id = 'EXP-' + String(nextNum).padStart(6, '0');

  const { error } = await supabase
    .from('expiration_batches')
    .insert({ id, produk, exp_date: expDate, qty_awal: qty, qty_tersisa: qty });
  if (error) console.error('[addExpirationBatch]', error);
}


// ============================================================
// FEFO — CONSUME BATCHES (expired first)
// ============================================================

export async function consumeExpirationBatches(produk, jumlah) {
  // Ambil semua batch aktif produk ini, urutkan FEFO (exp_date ASC)
  const { data: batches, error } = await supabase
    .from('expiration_batches')
    .select('id, qty_tersisa, exp_date')
    .ilike('produk', produk)
    .gt('qty_tersisa', 0)
    .order('exp_date', { ascending: true });

  if (error || !batches?.length) return;

  let remaining = jumlah;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take    = Math.min(batch.qty_tersisa, remaining);
    const newQty  = batch.qty_tersisa - take;
    remaining    -= take;

    await supabase
      .from('expiration_batches')
      .update({ qty_tersisa: newQty })
      .eq('id', batch.id);
  }
}


// ============================================================
// GET LOG
// ============================================================

export async function getLog(limit = 50) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, created_at, tipe, produk, jumlah, input_mode, ref, exp_date, sisa_stok_setelah')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 500));

  if (error) return { success: false, message: handleError(error) };
  return { success: true, data: data || [] };
}


// ============================================================
// GET EXPIRING PRODUCTS
// ============================================================

export async function getExpiringProducts(days = 30) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const maxDate  = new Date(today);
  maxDate.setDate(maxDate.getDate() + days);
  const maxISO   = maxDate.toISOString().split('T')[0];
  const todayISO = today.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('expiration_batches')
    .select('id, produk, exp_date, qty_tersisa')
    .lte('exp_date', maxISO)
    .gt('qty_tersisa', 0)
    .order('exp_date', { ascending: true });

  if (error) return { success: false, message: handleError(error) };

  const result = (data || []).map(r => {
    const exp      = new Date(r.exp_date + 'T00:00:00');
    const diffMs   = exp - today;
    const daysLeft = Math.floor(diffMs / 86400000);
    let status;
    if (daysLeft < 0)      status = 'EXPIRED';
    else if (daysLeft === 0) status = 'EXPIRED HARI INI';
    else if (daysLeft <= 7)  status = '≤ 7 HARI';
    else                     status = 'SEGERA EXPIRED';

    return {
      id:       r.id,
      produk:   r.produk,
      expDate:  r.exp_date,
      qty:      r.qty_tersisa,
      daysLeft,
      status,
    };
  });

  return { success: true, data: result };
}


// ============================================================
// GET ALL EXPIRATION BATCHES
// ============================================================

export async function getAllExpirationBatches() {
  const { data, error } = await supabase
    .from('expiration_batches')
    .select('*')
    .order('exp_date', { ascending: true });

  if (error) return { success: false, message: handleError(error) };
  return { success: true, data: data || [] };
}
