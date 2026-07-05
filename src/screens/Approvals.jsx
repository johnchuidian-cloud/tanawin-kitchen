import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchApprovals, resolveApproval } from '../lib/approvals.js'

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' })
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Approvals() {
  const { role, currentUser } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () =>
    fetchApprovals()
      .then(setItems)
      .catch((e) => setError(e.message || 'Could not load approvals.'))

  useEffect(() => {
    load()
  }, [])

  const pending = items?.filter((a) => a.status === 'pending') ?? []
  const resolved = items?.filter((a) => a.status !== 'pending').slice(0, 8) ?? []

  const resolve = async (a, decision) => {
    setBusyId(a.id)
    setError('')
    try {
      await resolveApproval(a, decision, currentUser.id)
      await load()
    } catch (e) {
      setError(e.message || 'Could not resolve this request.')
    } finally {
      setBusyId(null)
    }
  }

  if (role === 'guest') {
    return (
      <>
        <h2 className="title">Approvals</h2>
        <div className="guest-banner">👁️ Guest view — approvals are admin-only.</div>
      </>
    )
  }

  return (
    <>
      <h2 className="title">Approvals</h2>
      <div className="muted">
        {pending.length} {pending.length === 1 ? 'change' : 'changes'} awaiting sign-off
      </div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items ? (
        <>
          {pending.length === 0 ? (
            <div className="placeholder">Nothing awaiting approval right now.</div>
          ) : (
            <div style={{ marginTop: 14 }}>
              {pending.map((a) => (
                <div className="card approval" key={a.id}>
                  <div className="n" style={{ fontWeight: 700, fontSize: '14.5px' }}>{a.summary}</div>
                  <div className="who">
                    Requested by {a.requester?.name ?? '—'} · {timeAgo(a.requested_at)}
                  </div>
                  {role === 'admin' ? (
                    <div className="appr-actions">
                      <button
                        className="btn green"
                        disabled={busyId === a.id}
                        onClick={() => resolve(a, 'approved')}
                      >
                        {busyId === a.id ? '…' : 'Approve'}
                      </button>
                      <button
                        className="btn ghost"
                        disabled={busyId === a.id}
                        onClick={() => resolve(a, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="note">Only Lexi can approve or reject.</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolved.length > 0 ? (
            <>
              <div className="section-label" style={{ marginTop: 18 }}>Recent decisions</div>
              <div className="card">
                {resolved.map((a) => (
                  <div className="row" key={a.id}>
                    <span className={`dot ${a.status === 'approved' ? 'ok' : 'lowd'}`}></span>
                    <div className="info">
                      <div className="n">{a.summary}</div>
                      <div className="m">
                        {a.status === 'approved' ? 'Approved' : 'Rejected'}
                        {a.resolver?.name ? ` by ${a.resolver.name}` : ''}
                        {a.resolved_at ? ` · ${timeAgo(a.resolved_at)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </>
  )
}
