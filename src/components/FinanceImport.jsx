import { useEffect, useMemo, useState } from 'react'
import {
  fetchFinanceImports,
  markReconciled,
  suggestIngredient,
  fetchItemMaps,
  saveItemMap,
  forgetItemMap,
  itemKey,
} from '../lib/finance.js'
import { applyPurchaseDirect, submitPurchase } from '../lib/approvals.js'
import { fmtQty, shortUnit } from '../lib/inventory.js'
import { peso } from '../lib/recipes.js'

function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// The read-only Finance reconciliation list. Finance entries are grouped by
// date (one market run = one group), searchable, and item -> ingredient
// matches are remembered: once "Repolyo" is imported as Cabbage, every future
// Repolyo comes pre-matched; once "Transpo" is dismissed, future ones land in
// the auto-skipped section for one-tap bulk dismissal. Kitchen never writes
// to Finance.
export default function FinanceImport({ ingredients, direct, currentUser, onChange }) {
  const [entries, setEntries] = useState(null)
  const [maps, setMaps] = useState({}) // itemKey -> ingredient uuid | null ("not an ingredient")
  const [choice, setChoice] = useState({}) // financeEntryId -> ingredientId
  const [query, setQuery] = useState('')
  const [openDates, setOpenDates] = useState(() => new Set())
  const [skippedOpen, setSkippedOpen] = useState(false)
  const [busyId, setBusyId] = useState(null) // entry id, or 'skip-all'
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([fetchFinanceImports(), fetchItemMaps()])
      .then(([list, m]) => {
        if (!active) return
        setEntries(list)
        setMaps(m)
        // Pre-pick: remembered mapping first, fuzzy suggestion second.
        const c = {}
        for (const e of list) {
          const k = itemKey(e.item)
          if (m[k]) c[e.id] = m[k]
          else if (m[k] !== null) {
            const s = suggestIngredient(e.item, ingredients)
            if (s) c[e.id] = s.id
          }
        }
        setChoice(c)
        // Most recent market run starts expanded, the rest collapsed.
        const firstDate = list.find((e) => m[itemKey(e.item)] !== null)?.date
        if (firstDate) setOpenDates(new Set([firstDate]))
      })
      .catch((e) => active && setError(e.message || 'Could not read Finance purchases.'))
    return () => {
      active = false
    }
  }, [ingredients])

  const remove = (id) => setEntries((list) => list.filter((e) => e.id !== id))

  // Split into the active review list and the auto-skipped ("remembered as
  // not an ingredient") pile.
  const { groups, skipped, activeCount } = useMemo(() => {
    if (!entries) return { groups: [], skipped: [], activeCount: 0 }
    const skipped = entries.filter((e) => maps[itemKey(e.item)] === null)
    const q = query.trim().toLowerCase()
    const active = entries.filter(
      (e) =>
        maps[itemKey(e.item)] !== null &&
        (!q || (e.item || '').toLowerCase().includes(q) || (e.vendor || '').toLowerCase().includes(q))
    )
    const byDate = new Map()
    for (const e of active) {
      if (!byDate.has(e.date)) byDate.set(e.date, [])
      byDate.get(e.date).push(e)
    }
    const groups = [...byDate.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.reduce((s, e) => s + Number(e.total || 0), 0),
    }))
    return { groups, skipped, activeCount: active.length }
  }, [entries, maps, query])

  const toggleDate = (date) =>
    setOpenDates((s) => {
      const next = new Set(s)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })

  const handleImport = async (entry) => {
    const ingId = choice[entry.id]
    const ing = ingredients.find((i) => i.id === ingId)
    if (!ing) return
    setBusyId(entry.id)
    setError('')
    setMsg('')
    const purchase = {
      ingredientId: ing.id,
      supplierId: null,
      quantity: Number(entry.qty),
      totalCost: Number(entry.total),
      ingredientName: ing.name,
      supplierName: entry.vendor,
      unit: ing.unit,
      source: 'finance_pull',
    }
    const summary =
      `Restock (from Finance) — ${ing.name} +${fmtQty(entry.qty)} ${shortUnit(ing.unit)} for ${peso(entry.total)}` +
      (entry.vendor ? ` from ${entry.vendor}` : '')
    try {
      if (direct) await applyPurchaseDirect(purchase, currentUser.id)
      else await submitPurchase(purchase, summary, currentUser.id)
      await markReconciled(entry.id, 'synced', { ingredientId: ing.id }, currentUser.id)
      const k = itemKey(entry.item)
      await saveItemMap(k, ing.id, currentUser.id) // remember for next time
      setMaps((m) => ({ ...m, [k]: ing.id }))
      // Pre-fill any other entries of the same item still in the list.
      setChoice((c) => {
        const next = { ...c }
        for (const e of entries) if (itemKey(e.item) === k && !next[e.id]) next[e.id] = ing.id
        return next
      })
      remove(entry.id)
      setMsg(
        direct
          ? `Imported ${entry.item} as ${ing.name} — remembered for next time.`
          : `Sent ${entry.item} (${ing.name}) to Lexi for approval — match remembered.`
      )
      onChange?.()
    } catch (err) {
      setError(err.message || 'Could not import. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDismiss = async (entry) => {
    setBusyId(entry.id)
    setError('')
    setMsg('')
    try {
      await markReconciled(entry.id, 'dismissed', {}, currentUser.id)
      const k = itemKey(entry.item)
      await saveItemMap(k, null, currentUser.id) // remember: not an ingredient
      setMaps((m) => ({ ...m, [k]: null }))
      remove(entry.id)
      setMsg(`"${entry.item}" dismissed — future ones will be auto-skipped.`)
    } catch (err) {
      setError(err.message || 'Could not dismiss. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDismissAllSkipped = async () => {
    setBusyId('skip-all')
    setError('')
    try {
      for (const e of skipped) await markReconciled(e.id, 'dismissed', {}, currentUser.id)
      setEntries((list) => list.filter((e) => maps[itemKey(e.item)] !== null))
      setMsg(`Cleared ${skipped.length} known non-ingredient ${skipped.length === 1 ? 'item' : 'items'}.`)
    } catch (err) {
      setError(err.message || 'Could not clear them all — some may remain.')
    } finally {
      setBusyId(null)
    }
  }

  const handleRestore = async (entry) => {
    const k = itemKey(entry.item)
    setBusyId(entry.id)
    setError('')
    try {
      await forgetItemMap(k)
      setMaps((m) => {
        const next = { ...m }
        delete next[k]
        return next
      })
    } catch (err) {
      setError(err.message || 'Could not restore. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="note" style={{ marginTop: 0, marginBottom: 11 }}>
        ✓ Reading purchases recorded in Tanawin Finance. Match each to an ingredient to import it,
        or dismiss it — Kitchen never writes back to Finance. Matches are remembered.
      </div>

      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}
      {!entries && !error ? <div className="muted">Loading Finance purchases…</div> : null}

      {entries ? (
        <>
          {activeCount > 3 || query ? (
            <input
              className="import-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${activeCount} items…`}
            />
          ) : null}

          {skipped.length > 0 ? (
            <div className="card skip-card">
              <button type="button" className="group-head" onClick={() => setSkippedOpen((o) => !o)}>
                <span>
                  {skippedOpen ? '▾' : '▸'} Auto-skipped · {skipped.length} known non-ingredient{' '}
                  {skipped.length === 1 ? 'item' : 'items'}
                </span>
              </button>
              {skippedOpen ? (
                <>
                  {skipped.map((e) => (
                    <div className="row" key={e.id}>
                      <div className="info">
                        <div className="n">{e.item}</div>
                        <div className="m">
                          {e.vendor || '—'} · {shortDate(e.date)} · {peso(e.total)}
                        </div>
                      </div>
                      <button
                        className="mini-btn"
                        disabled={busyId === e.id}
                        onClick={() => handleRestore(e)}
                        title="Forget this — it IS an ingredient"
                      >
                        ↺ Restore
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn ghost"
                    disabled={busyId === 'skip-all'}
                    onClick={handleDismissAllSkipped}
                  >
                    {busyId === 'skip-all' ? 'Clearing…' : `Dismiss all ${skipped.length}`}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {activeCount === 0 && skipped.length === 0 ? (
            <div className="placeholder">All caught up — no Finance purchases to review.</div>
          ) : null}
          {activeCount === 0 && query ? (
            <div className="placeholder">No items match "{query}".</div>
          ) : null}

          {groups.map((g) => {
            const open = query.trim() !== '' || openDates.has(g.date)
            return (
              <div key={g.date}>
                <button type="button" className="group-head standalone" onClick={() => toggleDate(g.date)}>
                  <span>
                    {open ? '▾' : '▸'} {shortDate(g.date)} · {g.items.length}{' '}
                    {g.items.length === 1 ? 'item' : 'items'}
                  </span>
                  <span className="group-total">{peso(g.total)}</span>
                </button>
                {open
                  ? g.items.map((e) => {
                      const k = itemKey(e.item)
                      const remembered = !!maps[k]
                      return (
                        <div className="card" key={e.id}>
                          <div
                            className="row"
                            style={{ padding: '0 0 8px', borderBottom: '1px dashed var(--line)' }}
                          >
                            <div className="info">
                              <div className="n">
                                {e.item || '(no item name)'}
                                {remembered ? <span className="tag-remembered">✓ remembered</span> : null}
                              </div>
                              <div className="m">
                                {fmtQty(e.qty)} · {e.vendor || 'unknown vendor'} · {e.category}
                              </div>
                            </div>
                            <div className="qty">{peso(e.total)}</div>
                          </div>

                          <div className="field" style={{ marginTop: 11, marginBottom: 10 }}>
                            <label>Import as ingredient</label>
                            <select
                              value={choice[e.id] ?? ''}
                              onChange={(ev) => setChoice((c) => ({ ...c, [e.id]: ev.target.value }))}
                            >
                              <option value="">Choose…</option>
                              {ingredients.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="appr-actions">
                            <button
                              className="btn green"
                              disabled={busyId === e.id || !choice[e.id]}
                              onClick={() => handleImport(e)}
                            >
                              {busyId === e.id ? '…' : direct ? 'Import' : 'Send for approval'}
                            </button>
                            <button
                              className="btn ghost"
                              disabled={busyId === e.id}
                              onClick={() => handleDismiss(e)}
                            >
                              Not an ingredient
                            </button>
                          </div>
                        </div>
                      )
                    })
                  : null}
              </div>
            )
          })}
        </>
      ) : null}
    </>
  )
}
