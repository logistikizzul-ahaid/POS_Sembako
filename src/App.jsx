import { Routes, Route } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/layout/Header'

import LoginPage from './pages/LoginPage'
import POSPage from './pages/POSPage'
import ProductsPage from './pages/ProductsPage'
import StoreSettingsPage from './pages/StoreSettingsPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      {children}
    </div>
  )
}

export default function App() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute minRole="kasir">
            <AppLayout><POSPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/produk"
        element={
          <ProtectedRoute minRole="kepala_toko">
            <AppLayout><ProductsPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/laporan"
        element={
          <ProtectedRoute minRole="kepala_toko">
            <AppLayout><ReportsPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pengguna"
        element={
          <ProtectedRoute minRole="admin">
            <AppLayout><UsersPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pengaturan"
        element={
          <ProtectedRoute minRole="admin">
            <AppLayout><StoreSettingsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
