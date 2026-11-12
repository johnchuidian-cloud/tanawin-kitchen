import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { addIngredient, learnAlias, UNITS, shortUnit } from '../lib/inventory.js'
import { findExisting, englishSuggestion } from '../lib/ingredient-match.js'
import { CategoryField, PackSizeField } from './CategoryPackFields.jsx'
import { resolveFormCategory } from '../lib/categories.js'

const BLANK = {
  name: '',
  unit: 'kg',
  quantity: '',
  minThreshold: '',
  notes: '',
  category: '',
  newCategory: '',
  packSize: '',
  packUnit: 'g',
}

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
  // Category + pack size only once migration 14 has run — checked against the
  // list we were handed rather than assumed.
  const hasCategory = (items ?? []).some((i) => 'category' in i)

  const create = async () => {
    setError('')
    const cat = hasCategory ? resolveFormCategory(form, items) : { category: null }
    if (cat.error) {
      setError(cat.error)
      return
    }
    if (hasCategory && form.packSize !== '' && !(Number(form.packSize) > 0)) {
      setError('The pack size should be a number above 0, or left blank.')
      return
    }
    setSaving(true)
    try {
      const created = await addIngredient(
        hasCategory ? { ...form, category: cat.category } : { ...form, category: null, packSize: '' },
        currentUser.id
      )
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

      {hasCategory ? <CategoryField form={form} set={set} items={items} /> : null}
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
      {hasCategory ? <PackSizeField form={form} set={set} /> : null}
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
      {/* Only offered once migration 13 has run — checked against the list we
          were handed rather than assumed. */}
      {(items ?? []).some((i) => 'notes' in i) ? (
        <div className="field">
          <label>Note (optional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={hasCategory ? 'e.g. sold by the tray of 30' : 'e.g. 1 pack = 250 g'}
          />
        </div>
      ) : null}

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
