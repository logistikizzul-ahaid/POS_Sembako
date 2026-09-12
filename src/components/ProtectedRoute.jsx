import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Bungkus route dengan komponen ini untuk membatasi akses berdasarkan role.
 * Contoh: <ProtectedRoute minRole="kepala_toko"><ProductsPage /></ProtectedRoute>
 *
 * Hierarki role: kasir (1) < kepala_toko (2) < admin (3)
 * minRole = level minimal yang dibutuhkan untuk mengakses halaman ini.
 */
export default function ProtectedRoute({ children, minRole = 'kasir' }) {
  const { session, profile, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Memuat...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Akun ini belum terhubung ke profil toko manapun. Hubungi Admin.
      </div>
    )
  }

  if (!hasRole(minRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    )
  }

  return children
}
