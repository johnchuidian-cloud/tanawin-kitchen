import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Wordmark from './Wordmark.jsx'

export default function AppBar() {
  const { currentUser, roleLabel, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Close the menu when tapping outside it.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const name = currentUser?.name ?? 'Account'
  const badge = roleLabel ?? '⚠️ No role'

  return (
    <div className="appbar">
      <div>
        <Wordmark />
        <div className="sub">Kitchen</div>
      </div>

      <div className="role-wrap" ref={wrapRef}>
        <button className="role" onClick={() => setOpen((o) => !o)}>
          {badge}
        </button>
        {open ? (
          <div className="menu">
            <div className="who">
              <div className="n">{name}</div>
              <div className="r">{roleLabel ?? 'No role set'}</div>
            </div>
            <button onClick={logout}>Sign out</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
