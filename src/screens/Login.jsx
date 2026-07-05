import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Wordmark from '../components/Wordmark.jsx'

const ROLE_AVATAR = { admin: '👑', staff: '👷', guest: '👁️' }
const ROLE_DESC = { admin: 'Admin', staff: 'Staff', guest: 'View only' }

function Brand() {
  return (
    <div className="brand">
      <img src="/tanawin-icon.jpg" alt="Tanawin" className="brand-icon" />
      <Wordmark />
      <div className="sub">Kitchen · Tanawin B&amp;B</div>
    </div>
  )
}

export default function Login() {
  const { users, loadState, retry, login } = useAuth()
  const [selectedName, setSelectedName] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const pickUser = (name) => {
    setSelectedName(name)
    setPin('')
    setError('')
  }

  const tryPin = (value) => {
    const user = login(selectedName, value)
    if (!user) {
      setError('PIN incorrect — try again')
      setPin('')
    }
    // On success the app gate re-renders to the home screen automatically.
  }

  const onPinChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(v)
    setError('')
    if (v.length === 4) setTimeout(() => tryPin(v), 100) // auto-submit at 4 digits
  }

  return (
    <div className="auth">
      <Brand />

      {/* No name picked yet → show the user list */}
      {!selectedName ? (
        <div>
          <div className="who-label">Who's using the app?</div>

          {loadState === 'loading' && users.length === 0 ? (
            <div className="card">Loading users…</div>
          ) : null}

          {loadState === 'error' ? (
            <div className="card">
              <div className="error">Couldn't connect. Check your internet.</div>
              <button className="btn" onClick={retry}>
                Try again
              </button>
            </div>
          ) : null}

          {users.map((u) => (
            <button key={u.id} className="user-btn" onClick={() => pickUser(u.name)}>
              <span className={`avatar ${u.role}`}>{ROLE_AVATAR[u.role] ?? '👤'}</span>
              <span>
                <span className="un">{u.name}</span>
                <span className="ur">{ROLE_DESC[u.role] ?? u.role}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        /* Name picked → PIN pad */
        <div className="card">
          <button className="link-btn" onClick={() => setSelectedName(null)}>
            ← Pick someone else
          </button>
          <div className="welcome">Hi {selectedName}</div>
          <div className="welcome-sub">Enter your 4-digit PIN</div>
          <input
            className="pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoFocus
            value={pin}
            onChange={onPinChange}
            placeholder="• • • •"
          />
          {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
        </div>
      )}
    </div>
  )
}
