import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchIngredients, fmtQty, shortUnit } from '../lib/inventory.js'
import { fetchWaste, logWaste, WASTE_REASONS } from '../lib/waste.js'

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const m = Math.floor((Date.now() - then) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' })
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isThisWeek(iso) {
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000
}

export default function WasteLog() {
  const { role, currentUser } = useAuth()
  const [ingredients, setIngredients] = useState(null)
  const [waste, setWaste] = useState(null)
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(WASTE_REASONS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadWaste = () => fetchWaste().then(setWaste).catch(() => {})

  useEffect(() => {
    let active = true
    Promise.all([fetchIngredients(), fetchWaste()])
      .then(([ings, w]) => {
        if (!active) return
        setIngredients(ings)
        if (ings.length) setIngredientId(ings[0].id)
        setWaste(w)
      })
      .catch((e) => active && setError(e.message || 'Could not load the waste log.'))
    return () => {
      active = false
    }
  }, [])

  const selected = ingredients?.find((i) => i.id === ingredientId) ?? null
  const weekCount = waste?.filter((w) => isThisWeek(w.logged_at)).length ?? 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!selected) return
    const value = Number(qty)
    if (qty === '' || Number.isNaN(value) || value <= 0) {
      setError('Enter how much was wasted (more than 0).')
      return
    }
    setSaving(true)
    try {
      await logWaste(selected, value, reason, currentUser.id)
      setSuccess(`Logged — ${fmtQty(value)} ${shortUnit(selected.unit)} of ${selected.name} (${reason}).`)
      setQty('')
      await loadWaste()
    } catch (err) {
      setError(err.message || 'Could not log the waste. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const RecentList = () => (
    <>
      <div className="section-label">Recent</div>
      {waste && waste.length > 0 ? (
        <div className="card">
          {waste.map((w) => (
            <div className="row" key={w.id}>
              <div className="info">
                <div className="n">
                  {w.ingredient?.name ?? 'Unknown'} · {fmtQty(w.quantity)} {shortUnit(w.ingredient?.unit ?? '')}
                </div>
                <div className="m">
                  {w.reason ?? '—'} · by {w.logger?.name ?? '—'} · {timeAgo(w.logged_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="placeholder">No waste logged yet.</div>
      )}
    </>
  )

  return (
    <>
      <h2 className="title">Waste &amp; Spoilage</h2>
      <div className="muted">
        {weekCount} {weekCount === 1 ? 'entry' : 'entries'} this week
      </div>

      {role === 'guest' ? (
        <>
          <div className="guest-banner">👁️ Guest view — you can look, but not log anything.</div>
          {waste ? <RecentList /> : <div className="muted">Loading…</div>}
        </>
      ) : (
        <>
          {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
          {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}

          {!ingredients && !error ? <div className="muted">Loading…</div> : null}

          {ingredients && ingredients.length > 0 ? (
            <form className="card" style={{ marginTop: 14 }} onSubmit={handleSubmit}>
              <div className="field">
                <label>Ingredient</label>
                <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantity wasted{selected ? ` (${shortUnit(selected.unit)})` : ''}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>
              <div className="field">
                <label>Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}>
                  {WASTE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn green" type="submit" disabled={saving}>
                {saving ? 'Logging…' : 'Log waste'}
              </button>
            </form>
          ) : null}

          {waste ? <RecentList /> : null}
        </>
      )}
    </>
  )
}
