import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError('Email atau password salah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-xl font-bold mb-6 text-center">POS Toko Sembako</h1>

        <label className="text-sm text-gray-600">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 mb-4 mt-1"
        />

        <label className="text-sm text-gray-600">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 mb-4 mt-1"
        />

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white font-semibold py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Masuk...' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
