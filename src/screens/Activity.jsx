import { useEffect, useState } from 'react'
import { fetchActivity } from '../lib/activity.js'

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

// Colour the row dot by the kind of action.
function dotFor(type) {
  if (!type) return 'ok'
  if (type.includes('reject')) return 'lowd'
  if (type.includes('waste') || type.includes('request')) return 'mid'
  return 'ok'
}

export default function Activity() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchActivity()
      .then((d) => active && setItems(d))
      .catch((e) => active && setError(e.message || 'Could not load the activity log.'))
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <h2 className="title">Activity Log</h2>
      <div className="muted">Every action, free or approved</div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items ? (
        items.length === 0 ? (
          <div className="placeholder">No activity yet.</div>
        ) : (
          <div className="card" style={{ marginTop: 14 }}>
            {items.map((a) => (
              <div className="row" key={a.id}>
                <span className={`dot ${dotFor(a.detail?.type)}`}></span>
                <div className="info">
                  <div className="n">{a.action}</div>
                  <div className="m">
                    {a.actor?.name ?? '—'} · {timeAgo(a.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </>
  )
}
