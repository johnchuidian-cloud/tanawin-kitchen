import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { updateUser, addUser, generateRecoveryCode, validPin } from '../lib/staff.js'
import Avatar from '../components/Avatars.jsx'

const ROLE_DESC = { admin: 'Admin', staff: 'Staff', guest: 'View only' }

export default function ManageStaff() {
  const { role, users, currentUser, retry } = useAuth()
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [adding, setAdding] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', role: 'staff', pin: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')

  if (role !== 'admin') {
    return (
      <>
        <h2 className="title">Manage staff</h2>
        <div className="guest-banner">This screen is admin-only.</div>
      </>
    )
  }

  const startEdit = (u) => {
    setEditingId(u.id)
    setName(u.name)
    setPin('')
    setError('')
    setSuccess('')
  }

  const pinTakenBy = (value, exceptId) =>
    users.find((u) => u.id !== exceptId && u.pin === value)

  const handleSave = async (u) => {
    setError('')
    setSuccess('')
    if (pin && !validPin(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (pin && pinTakenBy(pin, u.id)) {
      setError('That PIN is already used by someone else — pick another.')
      return
    }
    setBusy(true)
    try {
      const changed = await updateUser(u, { name, pin: pin || undefined }, currentUser.id)
      await retry() // refresh the shared user list
      setEditingId(null)
      setSuccess(changed ? `Saved — ${name.trim() || u.name} updated.` : 'No changes to save.')
    } catch (err) {
      setError(err.message || 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!newUser.name.trim()) {
      setError('A name is required.')
      return
    }
    if (!validPin(newUser.pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (pinTakenBy(newUser.pin, null)) {
      setError('That PIN is already used by someone else — pick another.')
      return
    }
    setBusy(true)
    try {
      const created = await addUser(newUser, currentUser.id)
      await retry()
      setAdding(false)
      setNewUser({ name: '', role: 'staff', pin: '' })
      setSuccess(`Added ${created.name}.`)
    } catch (err) {
      setError(err.message || 'Could not add. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleGenerateRecovery = async () => {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const code = await generateRecoveryCode(currentUser.id)
      setRecoveryCode(code)
    } catch (err) {
      setError(err.message || 'Could not generate a code. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2 className="title">Manage staff</h2>
      <div className="muted">Names and PINs. PINs are never shown — only changed.</div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}

      <div className="card" style={{ marginTop: 14 }}>
        {users.map((u) => (
          <div key={u.id}>
            <div className="row">
              <Avatar name={u.name} role={u.role} className="avatar-sm" />
              <div className="info">
                <div className="n">{u.name}{u.id === currentUser.id ? ' (you)' : ''}</div>
                <div className="m">{ROLE_DESC[u.role] ?? u.role}</div>
              </div>
              {editingId === u.id ? null : (
                <button className="mini-btn" onClick={() => startEdit(u)}>Edit</button>
              )}
            </div>
            {editingId === u.id ? (
              <div className="edit-panel">
                <div className="field">
                  <label>Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label>New PIN (leave blank to keep current)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="• • • •"
                  />
                </div>
                <div className="appr-actions">
                  <button className="btn green" disabled={busy} onClick={() => handleSave(u)}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn ghost" disabled={busy} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {adding ? (
        <form className="card" onSubmit={handleAdd}>
          <div className="field">
            <label>Name</label>
            <input
              value={newUser.name}
              onChange={(e) => setNewUser((s) => ({ ...s, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value }))}
            >
              <option value="staff">Staff</option>
              <option value="guest">Guest (view only)</option>
            </select>
          </div>
          <div className="field">
            <label>4-digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newUser.pin}
              onChange={(e) =>
                setNewUser((s) => ({ ...s, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))
              }
              placeholder="• • • •"
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add person'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>+ Add person</button>
      )}

      <div className="section-label" style={{ marginTop: 20 }}>Forgot-PIN failsafe (for you)</div>
      {recoveryCode ? (
        <div className="card">
          <div className="recovery-code">{recoveryCode}</div>
          <div className="note" style={{ marginTop: 10 }}>
            ✍️ <b>Write this down somewhere safe now</b> — it will never be shown again. If you
            forget your PIN, the login screen's "Forgot your PIN?" link asks for this code. It
            works once, then you generate a fresh one here.
          </div>
        </div>
      ) : (
        <>
          <button className="btn ghost" disabled={busy} onClick={handleGenerateRecovery}>
            {busy ? 'Generating…' : '🔑 Generate recovery code'}
          </button>
          <div className="note">
            If you (the admin) forget your PIN, this code is the only way back in without
            technical help. Generating a new one replaces any previous code. Staff who forget
            their PIN just ask you — you can reset it above.
          </div>
        </>
      )}
    </>
  )
}
