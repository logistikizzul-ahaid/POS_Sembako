import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatRupiah } from '../../utils/pricing'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Pencarian produk cepat untuk kasir: cari by nama, SKU, atau barcode.
 * Mendukung input dari scanner barcode (yang berperilaku seperti keyboard + Enter).
 */
export default function ProductSearch({ onSelectProduct }) {
  const { profile } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', profile.store_id)
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.eq.${query}`)
        .limit(15)

      if (!error) setResults(data || [])
      setLoading(false)
    }, 250) // debounce

    return () => clearTimeout(timeout)
  }, [query, profile])

  function handleKeyDown(e) {
    // Scanner barcode biasanya kirim Enter setelah scan.
    // Jika hasil exact match barcode ada tepat 1, langsung pilih.
    if (e.key === 'Enter' && results.length === 1) {
      onSelectProduct(results[0])
      setQuery('')
      setResults([])
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Cari produk / scan barcode... (nama, SKU, atau barcode)"
        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {loading && <div className="absolute right-4 top-4 text-sm text-gray-400">Mencari...</div>}

      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelectProduct(p)
                setQuery('')
                setResults([])
              }}
              className="w-full text-left px-4 py-3 hover:bg-brand-50 flex justify-between items-center border-b last:border-b-0"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">
                  Stok: {p.stock_qty} {p.unit} {p.sku ? `· SKU: ${p.sku}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-brand-700">{formatRupiah(p.retail_price)}</div>
                {p.wholesale_price && (
                  <div className="text-xs text-gray-500">
                    Grosir: {formatRupiah(p.wholesale_price)}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
