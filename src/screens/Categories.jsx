import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchIngredients, setIngredientCategory } from '../lib/inventory.js'
import {
  useCategoryList,
  loadCategories,
  effectiveCategories,
  groupName,
  categoryIcon,
  categoryNameError,
  saveCategoryList,
  renameCategory,
  removeCategory,
  CATEGORY_ICONS,
  CUSTOM_ICON,
  MAX_CATEGORY_LENGTH,
  UNSORTED,
} from '../lib/categories.js'

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()
const countText = (n) => `${n} item${n === 1 ? '' : 's'}`

// Module level, like every form part in this app: declared inside the screen
// it would be rebuilt on each render and lose focus mid-tap.
function IconPicker({ value, onChange }) {
  return (
    <div className="icon-grid" role="radiogroup" aria-label="Icon">
      {CATEGORY_ICONS.map((ico) => (
        <button
          key={ico}
          type="button"
          role="radio"
          aria-checked={value === ico}
          className={value === ico ? 'on' : ''}
          onClick={() => onChange(ico)}
        >
          {ico}
        </button>
      ))}
    </div>
  )
}

/**
 * The category list: what's in each group, plus — for the owner — renaming,
 * reordering, adding and removing categories. Staff can move items between
 * groups (they already can from an item's Edit form); guests can look.
 */
export default function Categories() {
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const isAdmin = role === 'admin'
  const canMove = role === 'admin' || role === 'staff'
  useCategoryList() // re-render when the list changes

  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null) // which category is expanded
  const [mode, setMode] = useState(null) // 'rename' | 'remove' | null, for `open`
  const [nameInput, setNameInput] = useState('')
  const [iconInput, setIconInput] = useState(CUSTOM_ICON)
  const [moveTo, setMoveTo] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let active = true
    // Fresh read: someone else may have changed the list since this phone
    // loaded it.
    loadCategories({ fresh: true })
    fetchIngredients()
      .then((data) => active && setItems(data))
      .catch((e) => active && setError(e.message || 'Could not load the stock list.'))
    return () => {
      active = false
    }
  }, [])

  const hasCategory = (items ?? []).some((i) => 'category' in i)
  const cats = effectiveCategories(items)
  const countOf = (name) => (items ?? []).filter((i) => groupName(i) === name).length
  const unsortedCount = countOf(UNSORTED)
  const rows = [...cats, ...(unsortedCount ? [{ name: UNSORTED, icon: categoryIcon(UNSORTED), unsorted: true }] : [])]
  const moveOptions = [...cats.map((c) => c.name), UNSORTED]

  const resetPanel = () => {
    setMode(null)
    setNameInput('')
    setMoveTo('')
  }

  const toggle = (name) => {
    setOpen(open === name ? null : name)
    resetPanel()
    setAdding(false)
    setError('')
    setSuccess('')
  }

  // Every change goes through here: one at a time, with the stock list and
  // the category list re-read afterwards so the screen shows what's saved.
  const run = async (fn, done) => {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await fn()
      setItems(await fetchIngredients())
      setSuccess(done)
      resetPanel()
      return true
    } catch (e) {
      setError(e.message || 'That didn’t save. Check the connection and try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const moveCategory = (name, step) => {
    const idx = cats.findIndex((c) => c.name === name)
    const to = idx + step
    if (idx < 0 || to < 0 || to >= cats.length) return
    const next = [...cats]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    run(() => saveCategoryList(next, currentUser.id, `order changed (${name} moved ${step < 0 ? 'up' : 'down'})`), `${name} moved ${step < 0 ? 'up' : 'down'}.`)
  }

  const startRename = (c) => {
    setMode('rename')
    setNameInput(c.name)
    setIconInput(c.icon)
    setError('')
    setSuccess('')
  }

  const mergeTarget = (c) =>
    mode === 'rename' ? cats.find((o) => o.name !== c.name && sameName(o.name, nameInput)) : null

  const saveRename = async (e, c) => {
    e.preventDefault()
    const err = categoryNameError(nameInput)
    if (err) return setError(err)
    const name = nameInput.trim().replace(/\s+/g, ' ')
    const merge = mergeTarget(c)
    if (name === c.name) {
      if (iconInput === c.icon) return resetPanel()
      return run(
        () => saveCategoryList(cats.map((o) => (o.name === c.name ? { ...o, icon: iconInput } : o)), currentUser.id, `${c.name} icon changed`),
        `${c.name} updated.`
      )
    }
    // The icon change applies to the renamed entry; on a merge the target
    // keeps its own.
    const list = merge ? cats : cats.map((o) => (o.name === c.name ? { ...o, icon: iconInput } : o))
    const ok = await run(
      () => renameCategory(list, c.name, name, currentUser.id),
      merge ? `${c.name} merged into ${merge.name}.` : `Renamed to ${name}.`
    )
    if (ok) setOpen(merge ? merge.name : name)
  }

  const startRemove = (c) => {
    setMode('remove')
    const other = cats.find((o) => o.name !== c.name && sameName(o.name, 'Other'))
    setMoveTo(other ? other.name : UNSORTED)
    setError('')
    setSuccess('')
  }

  const confirmRemove = async (c) => {
    const target = moveTo === UNSORTED ? null : moveTo
    const ok = await run(
      () => removeCategory(cats, c.name, target, currentUser.id),
      countOf(c.name) ? `${c.name} removed — its items are now in ${moveTo}.` : `${c.name} removed.`
    )
    if (ok) setOpen(null)
  }

  const startAdd = () => {
    setAdding(true)
    setOpen(null)
    resetPanel()
    setNameInput('')
    setIconInput(CUSTOM_ICON)
    setError('')
    setSuccess('')
  }

  const saveAdd = async (e) => {
    e.preventDefault()
    const err = categoryNameError(nameInput)
    if (err) return setError(err)
    const name = nameInput.trim().replace(/\s+/g, ' ')
    const existing = cats.find((c) => sameName(c.name, name))
    if (existing) return setError(`${existing.name} is already a category.`)
    // New ones go just above Other, so the leftovers stay last.
    const otherIdx = cats.findIndex((c) => sameName(c.name, 'Other'))
    const next = [...cats]
    next.splice(otherIdx < 0 ? next.length : otherIdx, 0, { name, icon: iconInput })
    const ok = await run(() => saveCategoryList(next, currentUser.id, `${name} added`), `${name} added. Move items into it below, or from an item’s Edit form.`)
    if (ok) {
      setAdding(false)
      setOpen(name)
    }
  }

  const moveItem = (item, target) =>
    run(
      () => setIngredientCategory(item, target === UNSORTED ? null : target, currentUser.id),
      `${item.name} moved to ${target}.`
    )

  return (
    <>
      <div className="title-row">
        <h2 className="title">Categories</h2>
        <button className="mini-btn" onClick={() => navigate('/inventory')}>
          📦 Inventory
        </button>
      </div>
      <div className="muted">
        Tap a category to see what’s in it.
        {isAdmin ? ' You can rename, reorder or remove categories, or add your own.' : ''}
      </div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}
      {!items && !error ? <div className="muted" style={{ marginTop: 12 }}>Loading…</div> : null}

      {items && !hasCategory ? (
        <div className="placeholder">
          Categories need a one-time database step first (migration 14). Until then, Inventory is
          sorted A–Z.
        </div>
      ) : null}

      {items && hasCategory ? (
        <>
          <div className="card" style={{ marginTop: 14 }}>
            {rows.map((c, idx) => {
              const n = countOf(c.name)
              const isOpen = open === c.name
              const inCat = isOpen
                ? items.filter((i) => groupName(i) === c.name).sort((a, b) => a.name.localeCompare(b.name))
                : []
              return (
                <div key={c.name}>
                  <button
                    className="row cat-row"
                    aria-expanded={isOpen}
                    onClick={() => toggle(c.name)}
                  >
                    <span className="cat-ico" aria-hidden="true">{c.icon}</span>
                    <span className="info">
                      <span className="n">{c.name}</span>
                      <span className="m">{n ? countText(n) : 'Empty'}</span>
                    </span>
                    <span className="cat-chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                  </button>

                  {isOpen ? (
                    <div className="edit-panel">
                      {n ? (
                        <button
                          className="btn ghost"
                          style={{ marginTop: 0 }}
                          onClick={() => navigate(`/inventory?cat=${encodeURIComponent(c.name)}`)}
                        >
                          Open in Inventory
                        </button>
                      ) : null}

                      {/* Owner's controls. Not for the unsorted pile: it's
                          where items without a category land, not a category. */}
                      {isAdmin && !c.unsorted && mode === null ? (
                        <div className="cat-tools">
                          <button className="mini-btn" disabled={busy || idx === 0} onClick={() => moveCategory(c.name, -1)} aria-label={`Move ${c.name} up`}>
                            ↑ Up
                          </button>
                          <button className="mini-btn" disabled={busy || idx === cats.length - 1} onClick={() => moveCategory(c.name, 1)} aria-label={`Move ${c.name} down`}>
                            ↓ Down
                          </button>
                          <button className="mini-btn" disabled={busy} onClick={() => startRename(c)}>
                            ✏️ Rename
                          </button>
                          <button className="mini-btn" disabled={busy} onClick={() => startRemove(c)}>
                            🗑️ Remove
                          </button>
                        </div>
                      ) : null}

                      {isAdmin && mode === 'rename' ? (
                        <form onSubmit={(e) => saveRename(e, c)}>
                          <div className="field">
                            <label>Name</label>
                            <input
                              value={nameInput}
                              onChange={(e) => setNameInput(e.target.value)}
                              maxLength={MAX_CATEGORY_LENGTH}
                              autoFocus
                            />
                          </div>
                          {mergeTarget(c) ? (
                            <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
                              {mergeTarget(c).name} already exists.{' '}
                              {n
                                ? `Saving puts these ${countText(n)} into ${mergeTarget(c).name} and removes ${c.name}.`
                                : `${c.name} is empty, so saving just removes it.`}
                            </div>
                          ) : (
                            <div className="field">
                              <label>Icon</label>
                              <IconPicker value={iconInput} onChange={setIconInput} />
                            </div>
                          )}
                          <div className="appr-actions">
                            <button className="btn green" type="submit" disabled={busy}>
                              {busy ? 'Saving…' : mergeTarget(c) ? `Merge into ${mergeTarget(c).name}` : 'Save'}
                            </button>
                            <button className="btn ghost" type="button" disabled={busy} onClick={resetPanel}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {isAdmin && mode === 'remove' ? (
                        <div>
                          {n ? (
                            <div className="field">
                              <label>Move its {countText(n)} to</label>
                              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                                {moveOptions
                                  .filter((o) => o !== c.name)
                                  .map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          ) : (
                            <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
                              Nothing is in {c.name}, so nothing moves.
                            </div>
                          )}
                          <div className="appr-actions">
                            <button className="btn" disabled={busy} onClick={() => confirmRemove(c)}>
                              {busy ? 'Removing…' : `Remove ${c.name}`}
                            </button>
                            <button className="btn ghost" disabled={busy} onClick={resetPanel}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {mode === null ? (
                        inCat.length ? (
                          <div className="cat-items">
                            {inCat.map((i) => (
                              <div key={i.id} className="cat-item">
                                <span className="cat-item-name">{i.name}</span>
                                {canMove ? (
                                  <select
                                    value={c.name}
                                    disabled={busy}
                                    aria-label={`Move ${i.name} to another category`}
                                    onChange={(e) => moveItem(i, e.target.value)}
                                  >
                                    {moveOptions.map((o) => (
                                      <option key={o} value={o}>
                                        {o === c.name ? `✓ ${o}` : `→ ${o}`}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="note" style={{ marginTop: 8 }}>
                            Nothing in here yet.
                            {canMove ? ' Move items in from another category, or pick it in an item’s Edit form.' : ''}
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {isAdmin ? (
            adding ? (
              <form className="card" onSubmit={saveAdd}>
                <div className="field">
                  <label>New category name</label>
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={MAX_CATEGORY_LENGTH}
                    placeholder="e.g. Bakery, Cleaning, Baking supplies"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Icon</label>
                  <IconPicker value={iconInput} onChange={setIconInput} />
                </div>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Adding…' : 'Add category'}
                </button>
                <button className="btn ghost" type="button" disabled={busy} onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button className="btn ghost" onClick={startAdd}>
                + Add category
              </button>
            )
          ) : null}
        </>
      ) : null}
    </>
  )
}
