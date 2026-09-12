import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatRupiah } from '../utils/pricing'
import { useAuth } from '../contexts/AuthContext'

const emptyForm = {
  id: null,
  name: '',
  sku: '',
  barcode: '',
  unit: 'pcs',
  cost_price: '',
  retail_price: '',
  wholesale_price: '',
  wholesale_min_qty: '',
  stock_qty: '',
  min_stock_alert: 5,
}

/**
 * Halaman kelola katalog produk (akses: Kepala Toko & Admin).
 * Mendukung input dual-tier pricing (eceran & grosir) + syarat qty grosir per produk.
 */
export default function ProductsPage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', profile.store_id)
      .order('name')
    setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadProducts() }, [])

  function openNew() {
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(p) {
    setForm({ ...p })
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    const payload = {
      store_id: profile.store_id,
      name: form.name,
      sku: form.sku || null,
      barcode: form.barcode || null,
      unit: form.unit,
      cost_price: Number(form.cost_price) || 0,
      retail_price: Number(form.retail_price),
      wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
      wholesale_min_qty: form.wholesale_min_qty ? Number(form.wholesale_min_qty) : null,
      stock_qty: Number(form.stock_qty) || 0,
      min_stock_alert: Number(form.min_stock_alert) || 5,
    }

    if (form.id) {
      await supabase.from('products').update(payload).eq('id', form.id)
    } else {
      await supabase.from('products').insert(payload)
    }

    setShowForm(false)
    loadProducts()
  }

  async function handleDeactivate(id) {
    if (!confirm('Nonaktifkan produk ini?')) return
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    loadProducts()
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Katalog Produk</h1>
        <button onClick={openNew} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium">
          + Tambah Produk
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Stok</th>
              <th className="p-3">Harga Eceran</th>
              <th className="p-3">Harga Grosir</th>
              <th className="p-3">Min. Qty Grosir</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={6}>Memuat...</td></tr>}
            {!loading && products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.name}</td>
                <td className={`p-3 ${p.stock_qty <= p.min_stock_alert ? 'text-red-600 font-semibold' : ''}`}>
                  {p.stock_qty} {p.unit}
                </td>
                <td className="p-3">{formatRupiah(p.retail_price)}</td>
                <td className="p-3">{p.wholesale_price ? formatRupiah(p.wholesale_price) : '-'}</td>
                <td className="p-3">{p.wholesale_min_qty || '- (default toko)'}</td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(p)} className="text-brand-600 hover:underline">Edit</button>
                  <button onClick={() => handleDeactivate(p.id)} className="text-red-500 hover:underline">Nonaktifkan</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{form.id ? 'Edit' : 'Tambah'} Produk</h2>

            <Field label="Nama Produk">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU"><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" /></Field>
              <Field label="Barcode"><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input" /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Satuan"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" /></Field>
              <Field label="Stok"><input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} className="input" /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Harga Modal"><input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className="input" /></Field>
              <Field label="Harga Eceran*"><input required type="number" value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} className="input" /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-amber-50 p-3 rounded-lg">
              <Field label="Harga Grosir (opsional)"><input type="number" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} className="input" /></Field>
              <Field label="Min. Qty Grosir (kosongkan = default toko)"><input type="number" value={form.wholesale_min_qty} onChange={(e) => setForm({ ...form, wholesale_min_qty: e.target.value })} className="input" /></Field>
            </div>

            <div className="flex gap-2 pt-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded border">Batal</button>
              <button type="submit" className="flex-1 py-2 rounded bg-brand-600 text-white font-semibold">Simpan</button>
            </div>
          </form>
        </div>
      )}

      <style>{`.input { width:100%; border:1px solid #d1d5db; border-radius:0.5rem; padding:0.5rem 0.75rem; margin-top:0.25rem; }`}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block text-sm text-gray-600">
      {label}
      {children}
    </label>
  )
}
