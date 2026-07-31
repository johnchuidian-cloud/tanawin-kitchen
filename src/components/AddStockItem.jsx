import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { addIngredient, learnAlias, UNITS, MEAL_TAGS, shortUnit } from '../lib/inventory.js'
import { findExisting, englishSuggestion } from '../lib/ingredient-match.js'

const BLANK = { name: '', unit: 'kg', quantity: '', minThreshold: '', mealTag: '' }

/**
 * Add a stock item from anywhere — the Inventory page or straight out of an
 * ingredient dropdown. Guards against duplicates first: if the typed name
 * already exists under any spelling (including Tagalog), it offers the
 * existing item instead and remembers the spelling as an alias.
 *
 * onAdded(ingredient)   — a new item was created
 * onPicked(ingredient)  — the user chose an existing item instead (optional;
 *                         dropdowns use this to select it right away)
 */
export default function AddStockItem({ items, onAdded, onPicked, onCancel }) {
  const { currentUser } = useAuth()
  const [form, setForm] = useState(BLANK)
  const [dupe, setDupe] = useState(null) // { match, reason }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'name') {
      setDupe(null)
      setError('')
    }
  }

  const suggestion = englishSuggestion(form.name)

  const create = async () => {
    setSaving(true)
    setError('')
    try {
      const created = await addIngredient(form, currentUser.id)
      onAdded?.(created)
    } catch (err) {
      setError(err.message || 'Could not add the item. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const name = form.name.trim()
    if (!name) {
      setError('The item needs a name.')
      return
    }
    const hit = findExisting(name, items)
    if (hit && !dupe) {
      setDupe(hit) // ask before creating a near-duplicate
      return
    }
    await create()
  }

  // "Use the existing item" — teach it this spelling, then hand it back.
  const useExisting = async () => {
    setSaving(true)
    try {
      const updated = await learnAlias(dupe.match, form.name.trim(), currentUser.id)
      onPicked ? onPicked(updated) : onAdded?.(updated)
    } catch (err) {
      setError(err.message || 'Could not use that item. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    // Deliberately not a <form>: this renders inside other forms
    // (ingredient dropdowns), and nested forms are invalid HTML.
    <div onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit() } }}>
      {error ? <div className="error">{error}</div> : null}

      <div className="field">
        <label>Item name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Squid, Pork (sisig)"
          autoFocus
        />
      </div>

      {/* Same item, different spelling/language? Offer it before duplicating. */}
      {dupe ? (
        <div className="dupe-warn">
          <div className="dupe-title">
            "{form.name.trim()}" is {dupe.reason}.
          </div>
          <div className="dupe-sub">
            {dupe.match.name} — {shortUnit(dupe.match.unit)}
            {dupe.match.aliases?.length ? ` · also known as ${dupe.match.aliases.join(', ')}` : ''}
          </div>
          <div className="appr-actions">
            <button className="btn green" type="button" disabled={saving} onClick={useExisting}>
              {saving ? '…' : `Use ${dupe.match.name}`}
            </button>
            <button className="btn ghost" type="button" disabled={saving} onClick={create}>
              Add as new anyway
            </button>
          </div>
        </div>
      ) : null}

      {!dupe && suggestion ? (
        <div className="note" style={{ marginTop: 0, marginBottom: 13 }}>
          💡 The list uses English names — you could call this <b>{suggestion}</b>. Either is fine;
          both spellings will find it later.
        </div>
      ) : null}

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
        <label>Stock on hand now (optional)</label>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={form.quantity}
          onChange={(e) => set('quantity', e.target.value)}
          placeholder={`how many ${shortUnit(form.unit)} you have right now`}
        />
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

      {!dupe ? (
        <button className="btn" type="button" disabled={saving} onClick={handleSubmit}>
          {saving ? 'Adding…' : 'Add item'}
        </button>
      ) : null}
      <button type="button" className="btn ghost" onClick={onCancel}>
        Cancel
      </button>
      <div className="note">
        Leave stock blank to start at 0 — you can always Count Stock later. Cost fills in from
        purchases.
      </div>
    </div>
  )
}
