import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// Urutan hak akses, dipakai untuk pengecekan "minimal role X"
const ROLE_LEVEL = { kasir: 1, kepala_toko: 2, admin: 3 }

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // row dari tabel `users` (role, store_id, dll)
  const [store, setStore] = useState(null)     // row dari tabel `stores`
  const [loading, setLoading] = useState(true)

  async function loadProfileAndStore(userId) {
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userErr || !userRow) {
      setProfile(null)
      setStore(null)
      return
    }
    setProfile(userRow)

    if (userRow.store_id) {
      const { data: storeRow } = await supabase
        .from('stores')
        .select('*')
        .eq('id', userRow.store_id)
        .single()
      setStore(storeRow || null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfileAndStore(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfileAndStore(session.user.id)
      else {
        setProfile(null)
        setStore(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  // Cek apakah role user saat ini memenuhi level minimal yang dibutuhkan
  function hasRole(minRole) {
    if (!profile) return false
    return ROLE_LEVEL[profile.role] >= ROLE_LEVEL[minRole]
  }

  function isExactRole(...roles) {
    if (!profile) return false
    return roles.includes(profile.role)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    store,
    setStore, // dipakai StoreSettingsPage saat update profil toko
    loading,
    login,
    logout,
    hasRole,
    isExactRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
