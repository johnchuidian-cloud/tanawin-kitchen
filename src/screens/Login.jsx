import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Wordmark from '../components/Wordmark.jsx'
import { resetPinWithRecoveryCode } from '../lib/staff.js'
import Avatar from '../components/Avatars.jsx'

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
  // Admin forgot-PIN failsafe (code generated in Manage staff)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const selectedUser = selectedName
    ? users.find((u) => u.name.toLowerCase() === selectedName.toLowerCase())
    : undefined

  const pickUser = (name) => {
    setSelectedName(name)
    setPin('')
    setError('')
    setRecoveryMode(false)
    setRecoveryCode('')
    setNewPin('')
    setNotice('')
  }

  const handleRecoverySubmit = async () => {
    if (!selectedUser || recoveryBusy) return
    if (!recoveryCode.trim()) {
      setError('Enter your recovery code.')
      return
    }
    setRecoveryBusy(true)
    setError('')
    const res = await resetPinWithRecoveryCode(selectedUser, recoveryCode, newPin)
    setRecoveryBusy(false)
    if (!res.ok) {
      setError(res.reason ?? "Couldn't reset the PIN.")
      return
    }
    await retry() // refresh the user list so the new PIN is live for login
    setRecoveryMode(false)
    setRecoveryCode('')
    setNewPin('')
    setPin('')
    setNotice(
      'PIN updated — enter your new PIN to sign in. Your recovery code is used up; generate a fresh one in Manage staff.'
    )
  }

  const tryPin = async (value) => {
    const user = await login(selectedName, value)
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
              <Avatar name={u.name} role={u.role} className={`avatar ${u.role}`} />
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
          {recoveryMode ? (
            <>
              <button
                className="link-btn"
                onClick={() => {
                  setRecoveryMode(false)
                  setError('')
                }}
              >
                ← Back to PIN entry
              </button>
              <div className="welcome">Reset your PIN</div>
              <div className="welcome-sub">
                Enter the recovery code you generated in Manage staff, then choose a new PIN.
              </div>
              <div className="field">
                <label>Recovery code</label>
                <input
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={recoveryCode}
                  onChange={(e) => {
                    setRecoveryCode(e.target.value.toUpperCase())
                    setError('')
                  }}
                  placeholder="XXXX-XXXX-XXXX"
                  style={{ textAlign: 'center', letterSpacing: '.15em' }}
                />
              </div>
              <div className="field">
                <label>New 4-digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                    setError('')
                  }}
                  placeholder="• • • •"
                  style={{ textAlign: 'center', letterSpacing: '.5em' }}
                />
              </div>
              {error ? <div className="error">{error}</div> : null}
              <button className="btn" disabled={recoveryBusy} onClick={handleRecoverySubmit}>
                {recoveryBusy ? 'Checking…' : '🔑 Set new PIN'}
              </button>
              <div className="note">The code is used up once it works — generate a fresh one afterwards.</div>
            </>
          ) : (
            <>
              <button className="link-btn" onClick={() => setSelectedName(null)}>
                ← Pick someone else
              </button>
              <div className="welcome">Hi {selectedName}</div>
              <div className="welcome-sub">Enter your 4-digit PIN</div>
              {notice ? <div className="success">{notice}</div> : null}
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
              {selectedUser?.role === 'admin' ? (
                <button
                  className="link-btn"
                  style={{ marginTop: 12, marginBottom: 0 }}
                  onClick={() => {
                    setRecoveryMode(true)
                    setError('')
                    setNotice('')
                  }}
                >
                  Forgot your PIN? Use your recovery code
                </button>
              ) : (
                <div className="note" style={{ textAlign: 'center' }}>
                  Forgot your PIN? Ask Lexi to reset it.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
