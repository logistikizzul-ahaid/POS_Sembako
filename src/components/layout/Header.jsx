import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Header() {
  const { store, profile, logout, hasRole } = useAuth()
  const location = useLocation()

  const navItem = (to, label, minRole = 'kasir') => {
    if (!hasRole(minRole)) return null
    const active = location.pathname === to
    return (
      <Link
        to={to}
        className={`px-3 py-2 rounded-lg text-sm font-medium ${
          active ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <header className="h-16 bg-white shadow flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {store?.logo_url ? (
          <img src={store.logo_url} alt="logo" className="h-8 w-8 rounded object-cover" />
        ) : (
          <div className="h-8 w-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
            {store?.name?.[0] || 'T'}
          </div>
        )}
        <span className="font-bold text-gray-800">{store?.name || 'Toko Sembako'}</span>
      </div>

      <nav className="flex gap-1">
        {navItem('/', 'Kasir', 'kasir')}
        {navItem('/produk', 'Produk', 'kepala_toko')}
        {navItem('/laporan', 'Laporan', 'kepala_toko')}
        {navItem('/pengguna', 'Pengguna', 'admin')}
        {navItem('/pengaturan', 'Pengaturan Toko', 'admin')}
      </nav>

      <div className="flex items-center gap-3">
        <div className="text-sm text-right">
          <div className="font-medium">{profile?.full_name}</div>
          <div className="text-xs text-gray-400 capitalize">{profile?.role?.replace('_', ' ')}</div>
        </div>
        <button onClick={logout} className="text-sm text-red-600 hover:underline">
          Keluar
        </button>
      </div>
    </header>
  )
}
