import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { verifyPin } from '../lib/pin.js'

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

  // Only the FIRST load shows the loading gate — later refreshes (after a PIN
  // change etc.) keep the current list on screen so mounted screens don't get
  // unmounted mid-flow.
  const loadedOnce = useRef(false)

  const loadUsers = async () => {
    if (!loadedOnce.current) setLoadState('loading')
    const { data, error } = await supabase
      .from('kitchen_users')
      .select('id, name, role, pin')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Could not load users:', error)
      if (!loadedOnce.current) setLoadState('error')
      return
    }
    loadedOnce.current = true
    // Admin first, then staff, guest last (like Finance); stable sort keeps
    // people in the order they were added within each role.
    const rank = { admin: 0, staff: 1, guest: 2 }
    setUsers((data ?? []).slice().sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9)))
    setLoadState('ready')
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const currentUser = users.find((u) => u.id === userId) ?? null

  // Async: stored PINs are SHA-256 digests (legacy plaintext rows still
  // verify until migrated) — see lib/pin.js.
  const login = async (name, pin) => {
    const candidates = users.filter((u) => u.name.toLowerCase() === name.toLowerCase())
    for (const user of candidates) {
      if (await verifyPin(pin, user.pin)) {
        sessionStorage.setItem(SESSION_KEY, user.id)
        setUserId(user.id)
        return user
      }
    }
    return null
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
