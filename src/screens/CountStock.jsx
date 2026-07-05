import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  fetchIngredients,
  saveStockCount,
  shortUnit,
  fmtQty,
} from '../lib/inventory.js'

export default function CountStock() {
  const { role, currentUser } = useAuth()
  const [items, setItems] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    fetchIngredients()
      .then((data) => {
        if (!active) return
        setItems(data)
        if (data.length) setSelectedId(data[0].id)
      })
      .catch((e) => active && setError(e.message || 'Could not load ingredients.'))
    return () => {
      active = false
    }
  }, [])

  const selected = items?.find((i) => i.id === selectedId) ?? null

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!selected) return
    const value = Number(qty)
    if (qty === '' || Number.isNaN(value) || value < 0) {
      setError('Enter a valid quantity (0 or more).')
      return
    }
    setSaving(true)
    try {
      await saveStockCount(selected, value, currentUser.id)
      // Reflect the new count locally so the "current" hint stays accurate.
      setItems((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, quantity: value } : i))
      )
      setSuccess(`Saved — ${selected.name} is now ${fmtQty(value)} ${shortUnit(selected.unit)}.`)
      setQty('')
    } catch (err) {
      setError(err.message || 'Could not save the count. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // Guests are read-only everywhere.
  if (role === 'guest') {
    return (
      <>
        <h2 className="title">Count Stock</h2>
        <div className="guest-banner">👁️ Guest view — you can look, but not log or edit anything.</div>
      </>
    )
  }

  return (
    <>
      <h2 className="title">Count Stock</h2>
      <div className="muted">Log the quantity you counted — no approval needed.</div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}

      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items && items.length === 0 ? (
        <div className="placeholder">No ingredients to count yet.</div>
      ) : null}

      {items && items.length > 0 ? (
        <form className="card" style={{ marginTop: 14 }} onSubmit={handleSave}>
          <div className="field">
            <label>Ingredient</label>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setQty('')
                setSuccess('')
                setError('')
              }}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div className="note" style={{ marginTop: 0, marginBottom: 13 }}>
              Currently on record: <b>{fmtQty(selected.quantity)} {shortUnit(selected.unit)}</b>
            </div>
          ) : null}

          <div className="field">
            <label>Counted quantity{selected ? ` (${shortUnit(selected.unit)})` : ''}</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value)
                setSuccess('')
                setError('')
              }}
              placeholder={selected ? `e.g. ${fmtQty(selected.min_threshold)}` : 'e.g. 5'}
            />
          </div>

          <button className="btn green" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save count'}
          </button>
          <div className="note">
            This is logged with your name and time, but doesn't need Lexi's approval.
          </div>
        </form>
      ) : null}
    </>
  )
}
