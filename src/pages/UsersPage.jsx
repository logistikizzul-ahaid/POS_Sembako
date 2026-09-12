import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

/**
 * Kelola akun pengguna (Admin only).
 * CATATAN: Pembuatan user baru di Supabase idealnya lewat Supabase Edge Function
 * (admin.createUser dengan service_role key) karena anon key tidak boleh membuat user
 * langsung dengan role tertentu. Di sini disediakan form untuk MENGUBAH role/status
 * user yang sudah ada di tabel `users` (dibuat manual dulu di Supabase Auth dashboard,
 * lalu insert row profil di tabel `users`).
 */
export default function UsersPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('store_id', profile.store_id)
      .order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function updateRole(id, role) {
    await supabase.from('users').update({ role }).eq('id', id)
    loadUsers()
  }

  async function toggleActive(id, isActive) {
    await supabase.from('users').update({ is_active: !isActive }).eq('id', id)
    loadUsers()
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Kelola Pengguna</h1>

      <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-lg mb-4">
        Untuk menambah akun baru: buat user di <b>Supabase Dashboard → Authentication → Add User</b>,
        lalu tambahkan baris di tabel <code>users</code> dengan <code>id</code> yang sama, <code>store_id</code>,
        <code> full_name</code>, dan <code>role</code>.
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={4}>Memuat...</td></tr>}
            {!loading && users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.full_name}</td>
                <td className="p-3">
                  <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} className="border rounded px-2 py-1">
                    <option value="kasir">Kasir</option>
                    <option value="kepala_toko">Kepala Toko</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="p-3">{u.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td className="p-3 text-right">
                  <button onClick={() => toggleActive(u.id, u.is_active)} className="text-brand-600 hover:underline">
                    {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
