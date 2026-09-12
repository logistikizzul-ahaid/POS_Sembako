import { calculateCartTotals, formatRupiah } from '../../utils/pricing'

/**
 * Menampilkan keranjang belanja kasir.
 * Setiap baris menunjukkan tier harga yang sedang aktif (Eceran/Grosir)
 * dan tombol toggle manual untuk override oleh kasir.
 */
export default function Cart({ cartItems, setCartItems, store }) {
  const { lines, subtotal, estimatedMargin } = calculateCartTotals(cartItems, store)

  function updateQty(index, qty) {
    const newQty = Math.max(0, Number(qty) || 0)
    setCartItems((prev) => {
      const copy = [...prev]
      if (newQty === 0) {
        copy.splice(index, 1)
      } else {
        copy[index] = { ...copy[index], qty: newQty }
      }
      return copy
    })
  }

  function toggleTier(index, forcedTier) {
    setCartItems((prev) => {
      const copy = [...prev]
      const current = copy[index]
      // Klik lagi pada tier yang sama = kembali ke auto
      const newOverride = current.manualOverride === forcedTier ? 'auto' : forcedTier
      copy[index] = { ...current, manualOverride: newOverride }
      return copy
    })
  }

  function removeItem(index) {
    setCartItems((prev) => prev.filter((_, i) => i !== index))
  }

  if (lines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Keranjang masih kosong. Cari produk di atas untuk memulai transaksi.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto divide-y">
        {lines.map((line, idx) => (
          <div key={idx} className="py-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{line.product.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  value={line.qty}
                  onChange={(e) => updateQty(idx, e.target.value)}
                  className="w-16 border rounded px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-500">{line.product.unit}</span>

                {/* Toggle manual eceran/grosir - hanya tampil jika produk punya harga grosir */}
                {line.product.wholesale_price && (
                  <div className="flex gap-1 ml-2 text-xs">
                    <button
                      onClick={() => toggleTier(idx, 'eceran')}
                      className={`px-2 py-0.5 rounded-full border ${
                        line.tier === 'eceran'
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      Eceran
                    </button>
                    <button
                      onClick={() => toggleTier(idx, 'grosir')}
                      className={`px-2 py-0.5 rounded-full border ${
                        line.tier === 'grosir'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      Grosir (≥{line.minQtyForWholesale})
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="font-semibold">{formatRupiah(line.lineTotal)}</div>
              <div className="text-xs text-gray-500">{formatRupiah(line.unitPrice)}/{line.product.unit}</div>
            </div>

            <button
              onClick={() => removeItem(idx)}
              className="text-red-500 hover:text-red-700 text-sm px-2"
              title="Hapus item"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="border-t pt-3 mt-2 space-y-1">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Estimasi Margin</span>
          <span>{formatRupiah(estimatedMargin)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold">
          <span>Total</span>
          <span className="text-brand-700">{formatRupiah(subtotal)}</span>
        </div>
      </div>
    </div>
  )
}
