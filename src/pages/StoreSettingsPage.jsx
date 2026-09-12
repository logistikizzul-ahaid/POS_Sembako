import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

/**
 * Halaman pengaturan profil toko (Admin only).
 * Data di sini ditampilkan dinamis di Header dan struk cetak.
 */
export default function StoreSettingsPage() {
  const { store, setStore } = useAuth()
  const [form, setForm] = useState({
    name: store?.name || '',
    address: store?.address || '',
    phone_whatsapp: store?.phone_whatsapp || '',
    logo_url: store?.logo_url || '',
    receipt_note: store?.receipt_note || '',
    receipt_paper_size: store?.receipt_paper_size || '80mm',
    wholesale_min_qty: store?.wholesale_min_qty || 10,
  })
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const fileName = `${store.id}/logo-${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('store-logos').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('store-logos').getPublicUrl(fileName)
      setForm((f) => ({ ...f, logo_url: data.publicUrl }))
    }
    setUploadingLogo(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('stores')
      .update(form)
      .eq('id', store.id)
      .select()
      .single()
    if (!error) setStore(data)
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">Pengaturan Profil Toko</h1>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 space-y-4">
        <Field label="Nama Toko">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
        </Field>

        <Field label="Alamat">
          <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" rows={2} />
        </Field>

        <Field label="No. HP / WhatsApp">
          <input value={form.phone_whatsapp} onChange={(e) => setForm({ ...form, phone_whatsapp: e.target.value })} className="input" />
        </Field>

        <Field label="Logo Toko">
          <div className="flex items-center gap-3">
            {form.logo_url && <img src={form.logo_url} className="h-12 w-12 rounded object-cover" alt="logo" />}
            <input type="file" accept="image/*" onChange={handleLogoUpload} />
            {uploadingLogo && <span className="text-sm text-gray-400">Mengunggah...</span>}
          </div>
        </Field>

        <Field label="Catatan Struk (footer)">
          <textarea value={form.receipt_note} onChange={(e) => setForm({ ...form, receipt_note: e.target.value })} className="input" rows={2} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ukuran Kertas Struk">
            <select value={form.receipt_paper_size} onChange={(e) => setForm({ ...form, receipt_paper_size: e.target.value })} className="input">
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
            </select>
          </Field>
          <Field label="Syarat Qty Minimal Grosir (default)">
            <input type="number" value={form.wholesale_min_qty} onChange={(e) => setForm({ ...form, wholesale_min_qty: e.target.value })} className="input" />
          </Field>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-brand-600 text-white font-semibold py-2 rounded disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>

      <style>{`.input { width:100%; border:1px solid #d1d5db; border-radius:0.5rem; padding:0.5rem 0.75rem; margin-top:0.25rem; }`}</style>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm text-gray-600">{label}{children}</label>
}
