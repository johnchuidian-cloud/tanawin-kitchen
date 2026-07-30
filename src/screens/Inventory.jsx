import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchIngredients, addIngredient, stockStatus, shortUnit, fmtQty, UNITS } from '../lib/inventory.js'

const DOT = { low: 'lowd', mid: 'mid', ok: 'ok' }
const BLANK = { name: '', unit: 'kg', minThreshold: '' }

export default function Inventory() {
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchIngredients()
      .then((data) => active && setItems(data))
      .catch((e) => active && setError(e.message || 'Could not load inventory.'))
    return () => {
      active = false
    }
  }, [])

  const lowCount = items?.filter((i) => stockStatus(i) === 'low').length ?? 0
  const canAdd = role === 'admin' || role === 'staff'
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const name = form.name.trim()
    if (!name) {
      setError('The item needs a name.')
      return
    }
    const dupe = items?.find((i) => i.name.trim().toLowerCase() === name.toLowerCase())
    if (dupe) {
      setError(`"${dupe.name}" is already in the list — no need to add it again.`)
      return
    }
    setSaving(true)
    try {
      const created = await addIngredient(form, currentUser.id)
      setItems((prev) =>
        [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name))
      )
      setSuccess(`Added ${created.name}. It starts at 0 ${shortUnit(created.unit)} — count or restock it to set stock.`)
      setForm(BLANK)
      setAdding(false)
    } catch (err) {
      setError(err.message || 'Could not add the item. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="title">Inventory</h2>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}

      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items ? (
        <>
          <div className="muted">
            {items.length} ingredient{items.length === 1 ? '' : 's'}
            {lowCount > 0 ? ` · ${lowCount} below threshold` : ''}
          </div>

          {items.length === 0 ? (
            <div className="placeholder">
              No ingredients yet — add your first stock item below.
            </div>
          ) : (
            <div className="card" style={{ marginTop: 14 }}>
              {items.map((i) => {
                const status = stockStatus(i)
                const isLow = status === 'low'
                return (
                  <div className="row" key={i.id}>
                    <span className={`dot ${DOT[status]}`}></span>
                    <div className="info">
                      <div className="n">{i.name}</div>
                      <div className="m">{i.supplier?.name ?? 'No supplier set'}</div>
                    </div>
                    <div className="qty">
                      {fmtQty(i.quantity)} {shortUnit(i.unit)}
                      <small>
                        min {fmtQty(i.min_threshold)} {shortUnit(i.unit)}
                      </small>
                    </div>
                    <span className={`pill ${isLow ? 'low' : 'ok'}`}>{isLow ? 'LOW' : 'OK'}</span>
                  </div>
                )
              })}
            </div>
          )}

          {canAdd ? (
            adding ? (
              <form className="card" onSubmit={handleAdd}>
                <div className="field">
                  <label>Item name</label>
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Squid, Pork (sisig)"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Unit</label>
                  <select value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Reorder below (optional)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={form.minThreshold}
                    onChange={(e) => set('minThreshold', e.target.value)}
                    placeholder="leave blank if unsure"
                  />
                </div>
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? 'Adding…' : 'Add item'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setAdding(false)
                    setForm(BLANK)
                    setError('')
                  }}
                >
                  Cancel
                </button>
                <div className="note">
                  New items start at 0 stock and ₱0 cost — use Count Stock for the on-hand amount,
                  and cost fills in from purchases.
                </div>
              </form>
            ) : (
              <>
                <button className="btn ghost" onClick={() => setAdding(true)}>
                  + Add stock item
                </button>
                <button className="btn" onClick={() => navigate('/count')}>
                  + Enter stock count
                </button>
              </>
            )
          ) : (
            <button className="btn" onClick={() => navigate('/count')}>
              + Enter stock count
            </button>
          )}
        </>
      ) : null}
    </>
  )
}
