/**
 * ==========================================================
 * LOGIKA PRICING DUAL-TIER: ECERAN vs GROSIR
 * ==========================================================
 *
 * Aturan bisnis:
 * 1. Setiap produk punya `retail_price` (wajib) dan `wholesale_price` (opsional).
 * 2. Syarat qty minimal grosir: pakai `product.wholesale_min_qty` jika diisi,
 *    kalau tidak fallback ke `store.wholesale_min_qty` (default toko, mis. 10).
 * 3. Jika qty item di keranjang >= syarat minimal DAN produk punya wholesale_price,
 *    maka harga OTOMATIS berubah ke grosir.
 * 4. Kasir tetap bisa override manual (force eceran walau qty besar, atau
 *    force grosir walau qty belum cukup) lewat toggle di UI.
 * 5. Setiap kali qty di baris keranjang berubah, tier dihitung ulang KECUALI
 *    baris tersebut sedang dalam mode override manual.
 */

/**
 * Tentukan syarat qty minimal grosir untuk sebuah produk.
 */
export function getWholesaleMinQty(product, store) {
  if (product?.wholesale_min_qty != null) return Number(product.wholesale_min_qty)
  if (store?.wholesale_min_qty != null) return Number(store.wholesale_min_qty)
  return 10 // fallback default aplikasi
}

/**
 * Hitung tier harga yang seharusnya dipakai (otomatis, tanpa override).
 * Return: 'grosir' | 'eceran'
 */
export function resolveAutoTier(product, qty, store) {
  const hasWholesale = product?.wholesale_price != null && Number(product.wholesale_price) > 0
  if (!hasWholesale) return 'eceran'

  const minQty = getWholesaleMinQty(product, store)
  return Number(qty) >= minQty ? 'grosir' : 'eceran'
}

/**
 * Hitung harga satuan final untuk 1 baris item keranjang.
 *
 * @param {object} product - row produk dari database
 * @param {number} qty - jumlah yang dibeli
 * @param {object} store - row toko (untuk default wholesale_min_qty)
 * @param {'auto'|'eceran'|'grosir'} manualOverride - mode override dari toggle kasir
 * @returns {{ unitPrice: number, tier: 'eceran'|'grosir', lineTotal: number, minQtyForWholesale: number }}
 */
export function calculateLinePrice(product, qty, store, manualOverride = 'auto') {
  const minQtyForWholesale = getWholesaleMinQty(product, store)
  let tier

  if (manualOverride === 'grosir' && product?.wholesale_price) {
    tier = 'grosir'
  } else if (manualOverride === 'eceran') {
    tier = 'eceran'
  } else {
    tier = resolveAutoTier(product, qty, store)
  }

  const unitPrice = tier === 'grosir'
    ? Number(product.wholesale_price)
    : Number(product.retail_price)

  const lineTotal = round2(unitPrice * Number(qty))

  return { unitPrice, tier, lineTotal, minQtyForWholesale }
}

/**
 * Hitung ulang seluruh keranjang: subtotal, total margin, dan detail per baris.
 * cartItems: [{ product, qty, manualOverride }]
 */
export function calculateCartTotals(cartItems, store) {
  let subtotal = 0
  let totalCost = 0

  const lines = cartItems.map((item) => {
    const priceInfo = calculateLinePrice(item.product, item.qty, store, item.manualOverride)
    const costLine = round2(Number(item.product.cost_price || 0) * Number(item.qty))
    subtotal += priceInfo.lineTotal
    totalCost += costLine

    return {
      ...item,
      ...priceInfo,
      costLine,
    }
  })

  subtotal = round2(subtotal)
  totalCost = round2(totalCost)
  const estimatedMargin = round2(subtotal - totalCost)

  return { lines, subtotal, totalCost, estimatedMargin }
}

/**
 * Hitung kembalian dari uang tunai yang dibayarkan.
 */
export function calculateChange(total, paidAmount) {
  const change = round2(Number(paidAmount) - Number(total))
  return change > 0 ? change : 0
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * Format angka ke Rupiah, contoh: 15000 -> "Rp15.000"
 */
export function formatRupiah(num) {
  return 'Rp' + Number(num || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })
}
