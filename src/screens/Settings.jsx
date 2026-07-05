import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchSettings, setSetting, SETTING_STAFF_DIRECT_RESTOCK } from '../lib/settings.js'

export default function Settings() {
  const { role } = useAuth()
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchSettings()
      .then((s) => active && setSettings(s))
      .catch(() => active && setSettings({}))
    return () => {
      active = false
    }
  }, [])

  const staffDirect = settings?.[SETTING_STAFF_DIRECT_RESTOCK] === true

  const toggleStaffDirect = async () => {
    const next = !staffDirect
    setError('')
    setSaving(true)
    setSettings((s) => ({ ...s, [SETTING_STAFF_DIRECT_RESTOCK]: next })) // optimistic
    try {
      await setSetting(SETTING_STAFF_DIRECT_RESTOCK, next)
    } catch (err) {
      setSettings((s) => ({ ...s, [SETTING_STAFF_DIRECT_RESTOCK]: !next })) // revert
      setError(err.message || "Couldn't save — is the settings table set up?")
    } finally {
      setSaving(false)
    }
  }

  if (role !== 'admin') {
    return (
      <>
        <h2 className="title">Settings</h2>
        <div className="guest-banner">Settings are admin-only.</div>
      </>
    )
  }

  return (
    <>
      <h2 className="title">Settings</h2>
      <div className="muted">Controls that apply to the whole team.</div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {!settings && !error ? <div className="muted">Loading…</div> : null}

      {settings ? (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>Restocking</div>
          <div className="toggle-row">
            <div style={{ paddingRight: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Let staff restock without approval</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {staffDirect
                  ? 'On — staff restocks apply immediately. You can still see and undo them.'
                  : 'Off — staff restocks wait for your approval before taking effect.'}
              </div>
            </div>
            <button
              type="button"
              className={`switch ${staffDirect ? 'on' : ''}`}
              onClick={toggleStaffDirect}
              disabled={saving}
              aria-label="Toggle staff direct restock"
            />
          </div>
          <div className="note">
            This only affects <b>restocks / purchases</b>. Recipe and ingredient edits by staff still
            always route to you for approval.
          </div>
        </>
      ) : null}
    </>
  )
}
