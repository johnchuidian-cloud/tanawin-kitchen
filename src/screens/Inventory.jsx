import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AddStockItem from '../components/AddStockItem.jsx'
import InventoryExport from '../components/InventoryExport.jsx'
import { CategoryField, PackSizeField } from '../components/CategoryPackFields.jsx'
import {
  fetchIngredients,
  updateIngredient,
  ingredientUsage,
  describeUsage,
  archiveIngredient,
  unarchiveIngredient,
  deleteIngredient,
  stockLevel,
  unitLabel,
  visibleNote,
  fmtQty,
  UNITS,
} from '../lib/inventory.js'
import {
  groupName,
  categoryIcon,
  categorySortKey,
  railLabel,
  resolveFormCategory,
  useCategoryList,
} from '../lib/categories.js'
import { fetchItemStatus, ageSummary } from '../lib/movements.js'
import StockChart from '../components/StockChart.jsx'

// Read aloud by screen readers in place of the row colour, so the stock level
// isn't carried by colour alone.
const LEVEL_TEXT = { low: 'Low stock', out: 'Out of stock' }
const BLANK = {
  name: '',
  unit: 'kg',
  minThreshold: '',
  aliases: '',
  shelfLife: '',
  notes: '',
  category: '',
  newCategory: '',
  packSize: '',
  packUnit: 'g',
}

/**
 * Shared fields for the add and edit forms.
 *
 * MUST stay at module level. Declared inside Inventory() it was a brand-new
 * component type on every render, so React threw the inputs away and rebuilt
 * them after each keystroke — losing the caret, and letting the name field's
 * autoFocus drag the cursor back up to "Item name" mid-typing.
 */
function Fields({ ingredient, form, set, autoFocusName, hasShelfLife, hasNotes, hasCategory, items }) {
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
      {ingredient && form.unit !== ingredient.unit ? (
        <div className="note" style={{ marginTop: 0, marginBottom: 13 }}>
          ⚠️ Changing {ingredient.unit} → {form.unit} does <b>not</b> convert the on-hand quantity (
          {fmtQty(ingredient.quantity)}) or the cost. Do a fresh Count Stock afterwards, and the cost
          updates on the next purchase. Any recipe still written in {ingredient.unit} will show its
          cost as “—” until you update it too.
        </div>
      ) : null}
      {hasCategory ? <PackSizeField form={form} set={set} /> : null}
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
      {hasShelfLife ? (
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
      {hasNotes ? (
        <div className="field">
          <label>Note (optional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={
              hasCategory
                ? 'e.g. sold by the tray of 30 · big pack ~1kg, small ~400g'
                : 'e.g. 1 pack = 250 g · sold by the tray of 30 · big pack ~1kg'
            }
          />
          <div className="note" style={{ marginTop: 6 }}>
            {hasCategory
              ? 'For anything the pack size can’t say on its own. '
              : 'Handy for pack sizes, since every product is different. '}
            Whoever counts this item sees it on the Count Stock screen.
          </div>
        </div>
      ) : null}
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
  const [status, setStatus] = useState({})
  const [showArchived, setShowArchived] = useState(false)
  const [usage, setUsage] = useState(null) // what the open item would lose
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Only one chart is ever mounted — 77 of them would be unreadable on a phone
  // and would hammer the database on every Inventory load.
  const [chartId, setChartId] = useState(null)
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  // One ref per group heading (category, or letter before migration 14), so
  // the jump bar can scroll to it.
  const groupRefs = useRef({})
  // Re-groups once the owner's category list (order, icons) has loaded.
  useCategoryList()
  // ?cat=Proteins — opened from the Categories screen: scroll to that group
  // once the list is on screen, then never again for this visit.
  const [params] = useSearchParams()
  const jumpCat = params.get('cat')
  const jumped = useRef(false)

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

  // Which optional columns this database actually has. Derived from the LIST
  // rather than the individual row: a freshly added item comes back with the
  // narrow column set, and gating per-row made its fields vanish until reload.
  const has = (col) => (items ?? []).some((i) => col in i)
  const hasNotes = has('notes')
  const hasShelfLife = has('shelf_life_days')
  const hasArchiving = has('archived_at')
  const hasCategory = has('category')

  const archivedCount = (items ?? []).filter((i) => i.archived_at).length

  // Aliases are searched too, so the Tagalog name a cook actually thinks in
  // ("sibuyas") finds the item that's filed in English ("Onion").
  const q = search.trim().toLowerCase()
  const matches = (i) =>
    !q ||
    i.name.toLowerCase().includes(q) ||
    (i.aliases ?? []).some((a) => a.toLowerCase().includes(q))

  // Grouped by food category once migration 14 is in; until then, by first
  // letter exactly as before.
  const letterOf = (i) => (/^[a-z]/i.test(i.name) ? i.name[0].toUpperCase() : '#')
  const groupOf = hasCategory ? groupName : letterOf

  const shown = (items ?? [])
    .filter((i) => (showArchived ? i.archived_at : !i.archived_at))
    .filter(matches)
    .sort((a, b) =>
      hasCategory
        ? categorySortKey(groupOf(a)).localeCompare(categorySortKey(groupOf(b))) ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)
    )
  const levelCount = (lvl) => (showArchived ? 0 : shown.filter((i) => stockLevel(i) === lvl).length)
  const lowCount = levelCount('low')
  const outCount = levelCount('out')
  const groupSize = shown.reduce((m, i) => m.set(groupOf(i), (m.get(groupOf(i)) ?? 0) + 1), new Map())

  // The jump bar. With categories it lists only the groups that are actually
  // on screen; before migration 14 it's the A–Z rail, absent letters greyed.
  const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
  const railItems = hasCategory
    ? [...groupSize.keys()].map((g) => ({ key: g, label: railLabel(g), name: g, enabled: true }))
    : [...(groupSize.has('#') ? ['#'] : []), ...ALPHABET].map((l) => ({
        key: l,
        label: l,
        name: l,
        enabled: groupSize.has(l),
      }))
  // The rail is for scanning a long list. While searching, or on a short one,
  // it's just clutter — and with the export panel open it would sit on top of
  // the panel's buttons.
  const showRail = !q && shown.length > 15 && !exporting

  const jumpTo = (group) => {
    const el = groupRefs.current[group]
    if (!el) return
    // Jump instantly for anyone who's asked for less motion — a long smooth
    // scroll across 70-odd rows is exactly the kind of movement that setting
    // exists to avoid.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (!items || !jumpCat || jumped.current) return
    jumped.current = true
    // After this render has attached the group refs.
    requestAnimationFrame(() => jumpTo(jumpCat))
    // jumpTo only reads a ref; re-running on its identity would re-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, jumpCat])

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
      aliases: (i.aliases ?? []).join(', '),
      shelfLife: i.shelf_life_days == null ? '' : String(i.shelf_life_days),
      notes: i.notes ?? '',
      category: i.category ?? '',
      newCategory: '',
      packSize: i.pack_size == null ? '' : String(i.pack_size),
      packUnit: i.pack_unit ?? 'g',
    })
    setError('')
    setSuccess('')
    // Look up what a delete would destroy, so the panel can offer the right
    // option rather than a delete that fails or quietly takes history with it.
    setUsage(null)
    setConfirmDelete(false)
    // Tagged with the item it belongs to: opening one item and then another
    // before the first check returns could otherwise offer Delete for an item
    // that actually has history. (deleteIngredient re-checks server-side, so
    // this was never destructive — but the button shouldn't lie.)
    ingredientUsage(i.id)
      .then((u) => setUsage({ id: i.id, ...u }))
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
      const updated = await updateIngredient(ingredient, { ...form, category: cat.category }, currentUser.id)
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
      <div className="title-row">
        <h2 className="title">Inventory</h2>
        <div className="title-actions">
          {items && hasCategory ? (
            <button className="mini-btn" onClick={() => navigate('/categories')}>
              🗂️ Categories
            </button>
          ) : null}
          {items && canEdit && !exporting ? (
            <button className="mini-btn" onClick={() => setExporting(true)}>
              ⬇️ Export
            </button>
          ) : null}
        </div>
      </div>

      {exporting ? (
        <InventoryExport items={(items ?? []).filter((i) => !i.archived_at)} onClose={() => setExporting(false)} />
      ) : null}

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}

      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items ? (
        <>
          <div className="inv-search">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setEditingId(null)
                setChartId(null)
              }}
              placeholder="Search items…"
              aria-label="Search stock items"
            />
            {search ? (
              <button className="inv-search-clear" aria-label="Clear search" onClick={() => setSearch('')}>
                ×
              </button>
            ) : null}
          </div>

          <div className="muted">
            {shown.length} {showArchived ? 'archived ' : ''}ingredient{shown.length === 1 ? '' : 's'}
            {lowCount > 0 ? ` · ${lowCount} low` : ''}
            {outCount > 0 ? ` · ${outCount} out of stock` : ''}
            {q ? ` · matching “${search.trim()}”` : ''}
          </div>

          {/* The Breakfast / Lunch-Dinner filter used to sit here; stock is
              kept for every meal, so it went (2026-11-13). */}
          {archivedCount > 0 || showArchived ? (
            <div className="meal-filter">
              <button
                className={`chip ${showArchived ? 'on' : ''}`}
                onClick={() => {
                  setShowArchived((v) => !v)
                  cancel()
                }}
              >
                📥 Archived ({archivedCount})
              </button>
            </div>
          ) : null}

          {/* Jump bar. Hugs the right edge of the 480px app frame rather than
              the viewport, so on a laptop it stays beside the list. */}
          {showRail ? (
            <nav
              className={`az-rail ${hasCategory ? 'cat-rail' : ''}`}
              aria-label={hasCategory ? 'Jump to category' : 'Jump to letter'}
            >
              {railItems.map((r) => (
                <button
                  key={r.key}
                  disabled={!r.enabled}
                  onClick={() => jumpTo(r.key)}
                  aria-label={`Jump to ${r.name}`}
                  title={r.name}
                >
                  {r.label}
                </button>
              ))}
            </nav>
          ) : null}

          {shown.length === 0 ? (
            <div className="placeholder">
              {/* An empty ARCHIVED view once read "No ingredients yet", which
                  looks like the whole inventory has vanished. */}
              {q
                ? `Nothing matches “${search.trim()}”. Try part of the name, or the name you'd normally say for it.`
                : showArchived
                  ? 'Nothing archived. Items you retire show up here, and you can bring them back any time.'
                  : 'No ingredients yet — add your first stock item below.'}
            </div>
          ) : (
            <div className="card inv-card" style={{ marginTop: 6 }}>
              {/* Column labels for the four columns below. Decorative: each
                  row's cells say what they are on their own. */}
              <div className="inv-row inv-cols" aria-hidden="true">
                <span>Item</span>
                <span>Unit</span>
                <span className="r">Count</span>
                <span />
              </div>
              {shown.map((i, idx) => {
                const group = groupOf(i)
                const startsGroup = idx === 0 || groupOf(shown[idx - 1]) !== group
                // Archived items aren't stock any more, so they get no colour.
                const level = i.archived_at ? 'ok' : stockLevel(i)
                const age = ageSummary(status[i.id], i)
                const note = visibleNote(i)
                const editing = editingId === i.id
                const min = Number(i.min_threshold)
                return (
                  <div key={i.id}>
                    {startsGroup ? (
                      <div
                        className="letter-head"
                        ref={(el) => {
                          groupRefs.current[group] = el
                        }}
                      >
                        {hasCategory ? (
                          <>
                            {categoryIcon(group)} {group}
                            <span className="group-count"> · {groupSize.get(group)}</span>
                          </>
                        ) : (
                          group
                        )}
                      </div>
                    ) : null}
                    <div className={`row inv-row lvl-${level} ${editing ? 'editing' : ''}`}>
                      <div className="info">
                        <div className="n">
                          {i.name}
                          {LEVEL_TEXT[level] ? <span className="sr-only"> — {LEVEL_TEXT[level]}</span> : null}
                        </div>
                        <div className="m">
                          {i.supplier?.name ?? 'No supplier set'}
                        </div>
                        {/* Plain, uncoloured: the app reports the age, the cook
                            decides what it means. */}
                        {age ? <div className="m">{age}</div> : null}
                        {note ? <div className="m">📝 {note}</div> : null}
                      </div>
                      {editing ? null : (
                        <>
                          <div className="inv-unit">{unitLabel(i)}</div>
                          <div className="qty">
                            {fmtQty(i.quantity)}
                            {/* Only when a reorder level is set — "min 0" on
                                every row was noise. */}
                            {min > 0 ? <small>min {fmtQty(min)}</small> : null}
                          </div>
                          <div className="inv-actions">
                          <button
                            className={`mini-btn ${chartId === i.id ? 'on' : ''}`}
                            title="Stock chart"
                            aria-label={`Stock chart for ${i.name}`}
                            onClick={() => {
                              setChartId(chartId === i.id ? null : i.id)
                              setEditingId(null)
                            }}
                          >
                            📈
                          </button>
                          {canEdit && i.archived_at ? (
                            <button
                              className="mini-btn"
                              disabled={saving}
                              onClick={async () => {
                                await runAction(
                                  unarchiveIngredient,
                                  i,
                                  `${i.name} is back in your list.`
                                )
                                // Show the list it just came back to, rather
                                // than leaving them in an emptier Archived view.
                                setShowArchived(false)
                              }}
                            >
                              Restore
                            </button>
                          ) : null}
                          {canEdit && !i.archived_at ? (
                            <button className="mini-btn" onClick={() => startEdit(i)}>
                              Edit
                            </button>
                          ) : null}
                          </div>
                        </>
                      )}
                    </div>
                    {chartId === i.id ? (
                      <div className="edit-panel">
                        <StockChart ingredient={i} />
                        <button className="btn ghost" onClick={() => navigate(`/history?item=${i.id}`)}>
                          Day-by-day list
                        </button>
                      </div>
                    ) : null}
                    {editingId === i.id ? (
                      <form className="edit-panel" onSubmit={(e) => handleUpdate(e, i)}>
                        {/* No autoFocus on edit: opening the panel to change a
                            reorder level shouldn't jump to the name field. */}
                        <Fields
                          ingredient={i}
                          form={form}
                          set={set}
                          autoFocusName={false}
                          hasShelfLife={hasShelfLife}
                          hasNotes={hasNotes}
                          hasCategory={hasCategory}
                          items={items}
                        />
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
                        {hasArchiving ? (
                        <>
                        <div className="note" style={{ marginTop: 12 }}>
                          {usage?.id !== i.id ? (
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
                          {role === 'admin' && usage?.id === i.id && usage.isEmpty ? (
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
