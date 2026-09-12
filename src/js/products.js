// ============================================================
// products.js — Product data layer
// ============================================================
import { supabase, handleError } from './supabase.js';

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000; // 30 detik

/**
 * Ambil semua produk aktif, dengan cache ringan.
 */
export async function getProducts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cache && now - _cacheTime < CACHE_TTL) {
    return { success: true, data: _cache };
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, produk, ket_orderan, ket_barang, stock_awal, sisa_stok, is_weekly, is_usage, urutan')
    .eq('aktif', true)
    .order('urutan', { ascending: true });

  if (error) return { success: false, message: handleError(error) };

  _cache = data || [];
  _cacheTime = now;
  return { success: true, data: _cache };
}

export function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

/**
 * Update sisa_stok produk berdasarkan id.
 */
export async function updateSisaStok(id, newSisa) {
  const { error } = await supabase
    .from('products')
    .update({ sisa_stok: newSisa })
    .eq('id', id);
  if (error) throw new Error(handleError(error));
}
