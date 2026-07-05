import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// PIN-based auth, mirroring the Tanawin Finance app: no Supabase Auth.
// The kitchen_users table (name + role + pin) is loaded with the anon key,
// the PIN is checked client-side, and the logged-in user id is kept in
// sessionStorage (refresh = stay in this tab; close tab = logged out).
const AuthContext = createContext(null)

const SESSION_KEY = 'tanawin-kitchen.userId'

export const ROLE_LABEL = {
  admin: '👑 Admin',
  staff: '👷 Staff',
  guest: '👁️ Guest',
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([])
  const [loadState, setLoadState] = useState('loading') // loading | ready | error
  const [userId, setUserId] = useState(() => sessionStorage.getItem(SESSION_KEY))

  const loadUsers = async () => {
    setLoadState('loading')
    const { data, error } = await supabase
      .from('kitchen_users')
      .select('id, name, role, pin')
      .order('role', { ascending: true })
    if (error) {
      console.error('Could not load users:', error)
      setLoadState('error')
      return
    }
    setUsers(data ?? [])
    setLoadState('ready')
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const currentUser = users.find((u) => u.id === userId) ?? null

  const login = (name, pin) => {
    const user = users.find(
      (u) => u.name.toLowerCase() === name.toLowerCase() && u.pin === pin
    )
    if (user) {
      sessionStorage.setItem(SESSION_KEY, user.id)
      setUserId(user.id)
    }
    return user ?? null
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setUserId(null)
  }

  const value = {
    users,
    loadState,
    retry: loadUsers,
    currentUser,
    role: currentUser?.role ?? null,
    roleLabel: currentUser ? ROLE_LABEL[currentUser.role] : null,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
