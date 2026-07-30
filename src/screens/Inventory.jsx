import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  fetchIngredients,
  addIngredient,
  updateIngredient,
  stockStatus,
  shortUnit,
  fmtQty,
  UNITS,
  MEAL_TAGS,
  mealShort,
} from '../lib/inventory.js'

const DOT = { low: 'lowd', mid: 'mid', ok: 'ok' }
const BLANK = { name: '', unit: 'kg', minThreshold: '', mealTag: '' }

export default function Inventory() {
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [mealFilter, setMealFilter] = useState('')

  useEffect(() => {
    let active = true
    fetchIngredients()
      .then((data) => active && setItems(data))
      .catch((e) => active && setError(e.message || 'Could not load inventory.'))
    return () => {
      active = false
    }
  }, [])

  const canEdit = role === 'admin' || role === 'staff'
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const shown = (items ?? []).filter(
    (i) => !mealFilter || i.meal_tag === mealFilter || i.meal_tag === 'both'
  )
  const lowCount = shown.filter((i) => stockStatus(i) === 'low').length

  const startAdd = () => {
    setAdding(true)
    setEditingId(null)
    setForm(BLANK)
    setError('')
    setSuccess('')
  }

  const startEdit = (i) => {
    setEditingId(i.id)
    setAdding(false)
    setForm({
      name: i.name ?? '',
      unit: i.unit ?? 'kg',
      minThreshold: i.min_threshold == null ? '' : String(i.min_threshold),
      mealTag: i.meal_tag ?? '',
    })
    setError('')
    setSuccess('')
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setForm(BLANK)
    setError('')
  }

  const dupeCheck = (name, exceptId) =>
    (items ?? []).find(
      (i) => i.id !== exceptId && i.name.trim().toLowerCase() === name.toLowerCase()
    )

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const name = form.name.trim()
    if (!name) {
      setError('The item needs a name.')
      return
    }
    const dupe = dupeCheck(name, null)
    if (dupe) {
      setError(`"${dupe.name}" is already in the list — no need to add it again.`)
      return
    }
    setSaving(true)
    try {
      const created = await addIngredient(form, currentUser.id)
      setItems((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)))
      setSuccess(
        `Added ${created.name}. It starts at 0 ${shortUnit(created.unit)} — count or restock it to set stock.`
      )
      cancel()
    } catch (err) {
      setError(err.message || 'Could not add the item. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e, ingredient) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const name = form.name.trim()
    if (!name) {
      setError('The item needs a name.')
      return
    }
    const dupe = dupeCheck(name, ingredient.id)
    if (dupe) {
      setError(`"${dupe.name}" already exists — pick a different name.`)
      return
    }
    setSaving(true)
    try {
      const updated = await updateIngredient(ingredient, form, currentUser.id)
      setItems((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)).sort((a, b) => a.name.localeCompare(b.name))
      )
      setSuccess(`Saved — ${updated.name} updated.`)
      cancel()
    } catch (err) {
      setError(err.message || 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // Shared fields for the add and edit forms.
  const Fields = ({ ingredient }) => (
    <>
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
      {ingredient && form.unit !== ingredient.unit ? (
        <div className="note" style={{ marginTop: 0, marginBottom: 13 }}>
          ⚠️ Changing {ingredient.unit} → {form.unit} does <b>not</b> convert the on-hand quantity (
          {fmtQty(ingredient.quantity)}) or the cost. Do a fresh Count Stock afterwards, and the cost
          updates on the next purchase.
        </div>
      ) : null}
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
      <div className="field">
        <label>Mainly used for (optional)</label>
        <select value={form.mealTag} onChange={(e) => set('mealTag', e.target.value)}>
          <option value="">— not set —</option>
          {MEAL_TAGS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  return (
    <>
      <h2 className="title">Inventory</h2>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}

      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items ? (
        <>
          <div className="muted">
            {shown.length} ingredient{shown.length === 1 ? '' : 's'}
            {lowCount > 0 ? ` · ${lowCount} below threshold` : ''}
            {mealFilter ? ' · filtered' : ''}
          </div>

          {/* Meal filter — "both" items always show */}
          <div className="meal-filter">
            <button
              className={`chip ${!mealFilter ? 'on' : ''}`}
              onClick={() => setMealFilter('')}
            >
              All
            </button>
            {MEAL_TAGS.filter((m) => m.key !== 'both').map((m) => (
              <button
                key={m.key}
                className={`chip ${mealFilter === m.key ? 'on' : ''}`}
                onClick={() => setMealFilter(m.key)}
              >
                {m.short}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="placeholder">
              {mealFilter ? 'No items tagged for this meal yet.' : 'No ingredients yet — add your first stock item below.'}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 6 }}>
              {shown.map((i) => {
                const status = stockStatus(i)
                const isLow = status === 'low'
                const tag = mealShort(i.meal_tag)
                return (
                  <div key={i.id}>
                    <div className="row">
                      <span className={`dot ${DOT[status]}`}></span>
                      <div className="info">
                        <div className="n">{i.name}</div>
                        <div className="m">
                          {i.supplier?.name ?? 'No supplier set'}
                          {tag ? ` · ${tag}` : ''}
                        </div>
                      </div>
                      {editingId === i.id ? null : (
                        <>
                          <div className="qty">
                            {fmtQty(i.quantity)} {shortUnit(i.unit)}
                            <small>
                              min {fmtQty(i.min_threshold)} {shortUnit(i.unit)}
                            </small>
                          </div>
                          <span className={`pill ${isLow ? 'low' : 'ok'}`}>{isLow ? 'LOW' : 'OK'}</span>
                          {canEdit ? (
                            <button className="mini-btn" onClick={() => startEdit(i)}>
                              Edit
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                    {editingId === i.id ? (
                      <form className="edit-panel" onSubmit={(e) => handleUpdate(e, i)}>
                        <Fields ingredient={i} />
                        <div className="appr-actions">
                          <button className="btn green" type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn ghost" type="button" disabled={saving} onClick={cancel}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {canEdit ? (
            adding ? (
              <form className="card" onSubmit={handleAdd}>
                <Fields />
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? 'Adding…' : 'Add item'}
                </button>
                <button type="button" className="btn ghost" onClick={cancel}>
                  Cancel
                </button>
                <div className="note">
                  New items start at 0 stock and ₱0 cost — use Count Stock for the on-hand amount,
                  and cost fills in from purchases.
                </div>
              </form>
            ) : (
              <>
                <button className="btn ghost" onClick={startAdd}>
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
