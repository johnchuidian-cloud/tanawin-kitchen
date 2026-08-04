import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchIngredients, shortUnit, fmtQty } from '../lib/inventory.js'
import {
  fetchItemHistory,
  dailySeries,
  describeMovement,
  fmtAge,
  KINDS,
} from '../lib/movements.js'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

// "Mon 3 Aug" — and today/yesterday spelled out, since those are the two the
// cooks actually look for.
function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - date) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function StockHistory() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState(null)
  const [selectedId, setSelectedId] = useState(params.get('item') ?? '')
  const [days, setDays] = useState(30)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchIngredients()
      .then((data) => {
        if (!active) return
        setItems(data)
        // Deep-linked from an inventory row, or just the first item.
        if (!data.some((i) => i.id === selectedId)) setSelectedId(data[0]?.id ?? '')
      })
      .catch((e) => active && setError(e.message || 'Could not load stock items.'))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    setLoading(true)
    setError('')
    fetchItemHistory(selectedId, days)
      .then((h) => active && setHistory(h))
      .catch((e) => {
        if (!active) return
        setHistory(null)
        setError(
          e.message?.includes('stock_movements')
            ? 'Stock history isn\'t switched on yet — the database step is still pending.'
            : e.message || 'Could not load this item\'s history.'
        )
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [selectedId, days])

  const selected = items?.find((i) => i.id === selectedId) ?? null
  const unit = selected ? shortUnit(selected.unit) : ''

  const rows = useMemo(
    () => (history ? dailySeries(history, days) : []),
    [history, days]
  )

  // Window totals. Waste is listed separately because it doesn't move stock —
  // adding it to the others would overstate what left the shelf.
  const totals = useMemo(() => {
    const t = { purchase: 0, use: 0, waste: 0, unaccounted: 0, counts: 0 }
    for (const r of rows) {
      for (const m of r.events) {
        const d = Number(m.delta ?? 0)
        if (m.kind === 'purchase') t.purchase += d
        else if (m.kind === 'use') t.use += Math.abs(d)
        else if (m.kind === 'waste') t.waste += Math.abs(d)
        else if (m.kind === 'count') {
          t.counts += 1
          if (d < 0) t.unaccounted += Math.abs(d)
        }
      }
    }
    return t
  }, [rows])

  const countedDays = rows.filter((r) => r.observed).length

  return (
    <>
      <h2 className="title">Stock history</h2>
      <div className="muted">Day by day, for one item at a time</div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items && items.length > 0 ? (
        <>
          <div className="card" style={{ marginTop: 14, paddingBottom: 6 }}>
            <div className="field">
              <label>Stock item</label>
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value)
                  setParams({ item: e.target.value }, { replace: true })
                }}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="meal-filter" style={{ marginBottom: 12 }}>
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  className={`chip ${days === r.days ? 'on' : ''}`}
                  onClick={() => setDays(r.days)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? <div className="muted">Loading history…</div> : null}

          {!loading && selected && history ? (
            <>
              <div className="stats">
                <div className="stat">
                  <div className="num">{fmtQty(selected.quantity)}</div>
                  <div className="lbl">On hand ({unit})</div>
                </div>
                <div className="stat">
                  <div className="num">{countedDays}</div>
                  <div className="lbl">Days counted</div>
                </div>
                <div className="stat">
                  <div className="num">{fmtQty(totals.purchase)}</div>
                  <div className="lbl">Restocked</div>
                </div>
              </div>

              {totals.use > 0 || totals.waste > 0 || totals.unaccounted > 0 ? (
                <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
                  Over these {days} days:
                  {totals.use > 0 ? ` used in dishes ${fmtQty(totals.use)} ${unit};` : ''}
                  {totals.waste > 0 ? ` logged as waste ${fmtQty(totals.waste)} ${unit};` : ''}
                  {totals.unaccounted > 0
                    ? ` ${fmtQty(totals.unaccounted)} ${unit} unaccounted for at counting time.`
                    : ''}
                </div>
              ) : null}

              {rows.every((r) => r.quantity == null) ? (
                <div className="placeholder">
                  No history recorded for {selected.name} yet. It starts building from the next
                  count, restock or dish.
                </div>
              ) : (
                <div className="card">
                  {rows.map((r) => (
                    <div key={r.date}>
                      <div className="row">
                        <span className={`dot ${r.observed ? 'ok' : 'mid'}`}></span>
                        <div className="info">
                          <div className="n">{dayLabel(r.date)}</div>
                          <div className="m">
                            {r.observed
                              ? 'counted'
                              : r.events.length
                                ? 'not counted'
                                : 'no activity — carried forward'}
                          </div>
                        </div>
                        <div className="qty">
                          {r.quantity == null ? '—' : `${fmtQty(r.quantity)} ${unit}`}
                          {r.carried && r.quantity != null ? <small>carried forward</small> : null}
                        </div>
                      </div>
                      {r.events.length ? (
                        <div style={{ padding: '0 4px 10px 21px' }}>
                          {r.events.map((m) => (
                            <div className="m" key={m.id} style={{ marginTop: 4 }}>
                              {KINDS[m.kind]?.icon ?? '•'} {describeMovement(m, unit)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="note">
                Grey days weren't counted — the number is the last one on record carried forward,
                not a fresh check. Last count: {fmtAge(history.movements.filter((m) => m.kind === 'count').slice(-1)[0]?.occurred_at) ?? 'none in this range'}.
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {items && items.length === 0 ? (
        <div className="placeholder">No stock items yet.</div>
      ) : null}
    </>
  )
}
