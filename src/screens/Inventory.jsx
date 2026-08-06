import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AddStockItem from '../components/AddStockItem.jsx'
import {
  fetchIngredients,
  updateIngredient,
  ingredientUsage,
  describeUsage,
  archiveIngredient,
  unarchiveIngredient,
  deleteIngredient,
  stockStatus,
  shortUnit,
  fmtQty,
  UNITS,
  MEAL_TAGS,
  mealShort,
} from '../lib/inventory.js'
import { fetchItemStatus, ageSummary } from '../lib/movements.js'

const DOT = { low: 'lowd', mid: 'mid', ok: 'ok' }
const BLANK = { name: '', unit: 'kg', minThreshold: '', mealTag: '', aliases: '', shelfLife: '' }

/**
 * Shared fields for the add and edit forms.
 *
 * MUST stay at module level. Declared inside Inventory() it was a brand-new
 * component type on every render, so React threw the inputs away and rebuilt
 * them after each keystroke — losing the caret, and letting the name field's
 * autoFocus drag the cursor back up to "Item name" mid-typing.
 */
function Fields({ ingredient, form, set, autoFocusName }) {
  return (
    <>
      <div className="field">
        <label>Item name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Squid, Pork (sisig)"
          autoFocus={autoFocusName}
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
          updates on the next purchase. Any recipe still written in {ingredient.unit} will show its
          cost as “—” until you update it too.
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
      {ingredient && 'shelf_life_days' in ingredient ? (
        <div className="field">
          <label>Keeps for about (days, optional)</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={form.shelfLife}
            onChange={(e) => set('shelfLife', e.target.value)}
            placeholder="leave blank if unsure"
          />
        </div>
      ) : null}
      <div className="field">
        <label>Also known as (comma separated)</label>
        <input
          value={form.aliases}
          onChange={(e) => set('aliases', e.target.value)}
          placeholder="e.g. sibuyas, onions"
        />
      </div>
    </>
  )
}

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
  const [status, setStatus] = useState({})
  const [showArchived, setShowArchived] = useState(false)
  const [usage, setUsage] = useState(null) // what the open item would lose
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let active = true
    fetchIngredients({ includeArchived: true })
      .then((data) => active && setItems(data))
      .catch((e) => active && setError(e.message || 'Could not load inventory.'))
    // Ages are a nice-to-have: if the history table isn't there yet, the list
    // renders exactly as it always did.
    fetchItemStatus()
      .then((s) => active && setStatus(s))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const canEdit = role === 'admin' || role === 'staff'
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const archivedCount = (items ?? []).filter((i) => i.archived_at).length
  const shown = (items ?? [])
    .filter((i) => (showArchived ? i.archived_at : !i.archived_at))
    .filter((i) => !mealFilter || i.meal_tag === mealFilter || i.meal_tag === 'both')
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
      aliases: (i.aliases ?? []).join(', '),
      shelfLife: i.shelf_life_days == null ? '' : String(i.shelf_life_days),
    })
    setError('')
    setSuccess('')
    // Look up what a delete would destroy, so the panel can offer the right
    // option rather than a delete that fails or quietly takes history with it.
    setUsage(null)
    setConfirmDelete(false)
    ingredientUsage(i.id)
      .then((u) => setUsage(u))
      .catch(() => setUsage(null))
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setForm(BLANK)
    setError('')
    setUsage(null)
    setConfirmDelete(false)
  }

  const runAction = async (fn, ingredient, done) => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await fn(ingredient, currentUser.id)
      const fresh = await fetchIngredients({ includeArchived: true })
      setItems(fresh)
      setSuccess(done)
      cancel()
    } catch (err) {
      setError(err.message || 'That didn\'t work. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const dupeCheck = (name, exceptId) =>
    (items ?? []).find(
      (i) => i.id !== exceptId && i.name.trim().toLowerCase() === name.toLowerCase()
    )

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
            {archivedCount > 0 || showArchived ? (
              <button
                className={`chip ${showArchived ? 'on' : ''}`}
                onClick={() => {
                  setShowArchived((v) => !v)
                  cancel()
                }}
              >
                📥 Archived ({archivedCount})
              </button>
            ) : null}
          </div>

          {shown.length === 0 ? (
            <div className="placeholder">
              {mealFilter ? 'No items tagged for this meal yet.' : 'No ingredients yet — add your first stock item below.'}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 6 }}>
              {shown.map((i) => {
                const level = stockStatus(i)
                const isLow = level === 'low'
                const tag = mealShort(i.meal_tag)
                const age = ageSummary(status[i.id], i)
                return (
                  <div key={i.id}>
                    <div className="row">
                      <span className={`dot ${DOT[level]}`}></span>
                      <div className="info">
                        <div className="n">{i.name}</div>
                        <div className="m">
                          {i.supplier?.name ?? 'No supplier set'}
                          {tag ? ` · ${tag}` : ''}
                        </div>
                        {/* Plain, uncoloured: the app reports the age, the cook
                            decides what it means. */}
                        {age ? <div className="m">{age}</div> : null}
                      </div>
                      {editingId === i.id ? null : (
                        <>
                          <div className="qty">
                            {fmtQty(i.quantity)} {shortUnit(i.unit)}
                            <small>
                              min {fmtQty(i.min_threshold)} {shortUnit(i.unit)}
                            </small>
                          </div>
                          {i.archived_at ? (
                            <span className="pill">ARCHIVED</span>
                          ) : (
                            <span className={`pill ${isLow ? 'low' : 'ok'}`}>{isLow ? 'LOW' : 'OK'}</span>
                          )}
                          <button
                            className="mini-btn"
                            title="Stock history"
                            onClick={() => navigate(`/history?item=${i.id}`)}
                          >
                            📈
                          </button>
                          {canEdit && i.archived_at ? (
                            <button
                              className="mini-btn"
                              disabled={saving}
                              onClick={() =>
                                runAction(unarchiveIngredient, i, `${i.name} is back in your list.`)
                              }
                            >
                              Restore
                            </button>
                          ) : null}
                          {canEdit && !i.archived_at ? (
                            <button className="mini-btn" onClick={() => startEdit(i)}>
                              Edit
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                    {editingId === i.id ? (
                      <form className="edit-panel" onSubmit={(e) => handleUpdate(e, i)}>
                        {/* No autoFocus on edit: opening the panel to change a
                            reorder level shouldn't jump to the name field. */}
                        <Fields ingredient={i} form={form} set={set} autoFocusName={false} />
                        <div className="appr-actions">
                          <button className="btn green" type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn ghost" type="button" disabled={saving} onClick={cancel}>
                            Cancel
                          </button>
                        </div>

                        {/* Removing an item. Archive is the normal way out;
                            deleting is only offered when there's genuinely
                            nothing attached to lose.

                            Hidden entirely until migration 12 has run —
                            archived_at absent means the buttons would just
                            throw, and a button that always fails is worse
                            than no button. */}
                        {'archived_at' in i ? (
                        <>
                        <div className="note" style={{ marginTop: 12 }}>
                          {usage == null ? (
                            'Checking what this item has attached…'
                          ) : usage.isEmpty ? (
                            <>
                              Nothing is attached to {i.name} yet — no purchases, no history. It can
                              be removed completely, or archived if you might use it later.
                            </>
                          ) : (
                            <>
                              {i.name} has {describeUsage(usage)} attached. Archiving hides it from
                              your lists and every dropdown but keeps all of that, and you can bring
                              it back. Deleting would destroy it, so that isn't offered.
                            </>
                          )}
                        </div>
                        <div className="appr-actions">
                          <button
                            className="btn ghost"
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              runAction(
                                archiveIngredient,
                                i,
                                `${i.name} archived — find it under "Archived" if you need it back.`
                              )
                            }
                          >
                            📥 Archive
                          </button>
                          {role === 'admin' && usage?.isEmpty ? (
                            confirmDelete ? (
                              <button
                                className="btn"
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  runAction(deleteIngredient, i, `${i.name} deleted.`)
                                }
                              >
                                Really delete?
                              </button>
                            ) : (
                              <button
                                className="btn ghost"
                                type="button"
                                disabled={saving}
                                onClick={() => setConfirmDelete(true)}
                              >
                                🗑️ Delete
                              </button>
                            )
                          ) : null}
                        </div>
                        </>
                        ) : null}
                      </form>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {canEdit ? (
            adding ? (
              <div className="card">
                <AddStockItem
                  items={items}
                  onAdded={(created) => {
                    setItems((prev) =>
                      (prev.some((i) => i.id === created.id)
                        ? prev.map((i) => (i.id === created.id ? created : i))
                        : [...prev, created]
                      ).sort((a, b) => a.name.localeCompare(b.name))
                    )
                    setSuccess(`Saved — ${created.name}.`)
                    cancel()
                  }}
                  onCancel={cancel}
                />
              </div>
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
