import { useEffect, useMemo, useState } from 'react'
import {
  fetchItemHistory,
  fetchLastUnitChange,
  describeUnitChange,
  dailySeries,
  describeMovement,
  KINDS,
} from '../lib/movements.js'
import { shortUnit, fmtQty } from '../lib/inventory.js'

const RANGES = [7, 14, 30]

// Plot geometry, in viewBox units. The SVG scales to its container, so this is
// the shape of the chart rather than its size — same drawing on a 360px phone
// and a laptop.
const W = 320
const H = 150
const PAD = { top: 10, right: 8, bottom: 22, left: 34 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// "6 Aug"
function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Quantity on hand, day by day, for one stock item.
 *
 * Read-only: it draws history that already exists and records nothing.
 *
 * What it must not do, and why:
 *  - never mark a day nobody counted. The line joins carried-forward days so
 *    the shape reads, but a dot on an uncounted day claims knowledge we don't
 *    have. Counting is bursty here.
 *  - never draw through a unit change (see fetchLastUnitChange).
 *  - never start the y-axis anywhere but zero, or small swings look dramatic
 *    to someone deciding what to buy.
 */
export default function StockChart({ ingredient }) {
  const [days, setDays] = useState(14)
  const [history, setHistory] = useState(null)
  const [unitChange, setUnitChange] = useState(null)
  const [clamped, setClamped] = useState(false)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setSelected(null)
    ;(async () => {
      const change = await fetchLastUnitChange(ingredient.id).catch(() => null)
      if (!active) return

      // Option C: start the window after the most recent unit change rather
      // than drawing two different units as one series.
      let effDays = days
      let didClamp = false
      if (change) {
        const since = Math.round((midnight(new Date()) - midnight(new Date(change.created_at))) / 86400000) + 1
        if (since < days) {
          effDays = Math.max(since, 1)
          didClamp = true
        }
      }

      let h = null
      try {
        h = await fetchItemHistory(ingredient.id, effDays)
      } catch {
        h = null
      }
      if (!active) return
      // The opening balance predates the unit change, so it's in the old unit —
      // drop it rather than plotting one wrong first point.
      if (h && didClamp) h = { ...h, openingQty: null }
      setUnitChange(change)
      setClamped(didClamp)
      setHistory(h)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [ingredient.id, days])

  // Oldest first for drawing; dailySeries hands back newest first.
  // Leading days with nothing on record are dropped, so the axis starts at the
  // item's first movement. Drawing an axis back to a date before this item was
  // ever tracked invites reading the empty stretch as "stock didn't move".
  const rows = useMemo(() => {
    if (!history) return []
    const all = dailySeries(history, 999).slice().reverse()
    const first = all.findIndex((r) => r.quantity != null)
    return first <= 0 ? all : all.slice(first)
  }, [history])

  const unit = shortUnit(ingredient.unit)
  const withData = rows.filter((r) => r.quantity != null)
  const daysWithMovement = rows.filter((r) => r.events.length).length
  const threshold = Number(ingredient.min_threshold) || 0

  const maxY = Math.max(...withData.map((r) => Number(r.quantity)), threshold, 1)
  const top = maxY * 1.1
  const x = (i) => PAD.left + (rows.length <= 1 ? PLOT_W / 2 : (i / (rows.length - 1)) * PLOT_W)
  const y = (v) => PAD.top + PLOT_H - (Number(v) / top) * PLOT_H

  const line = withData.length
    ? rows
        .map((r, i) => (r.quantity == null ? null : `${x(i)},${y(r.quantity)}`))
        .filter(Boolean)
        .join(' ')
    : ''

  // At most three x labels, so 30 days still reads on a phone.
  const labelIdx = rows.length <= 1 ? [0] : [0, Math.floor((rows.length - 1) / 2), rows.length - 1]
  const selectedRow = selected ? rows.find((r) => r.date === selected) : null

  return (
    <div className="stock-chart">
      <div className="meal-filter" style={{ marginTop: 0 }}>
        {RANGES.map((d) => (
          <button key={d} className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
        {ingredient.archived_at ? <span className="pill">ARCHIVED</span> : null}
      </div>

      {loading ? <div className="muted" style={{ padding: '10px 2px' }}>Loading…</div> : null}

      {/* Fewer than two days with anything recorded isn't a chart — an empty
          frame reads as broken software. */}
      {!loading && daysWithMovement < 2 ? (
        <div className="note" style={{ marginTop: 0 }}>
          Not enough history yet to draw a trend for {ingredient.name}
          {clamped ? ' since its unit changed' : ''}. Stock tracking began 30 July 2026 — this fills
          in as the item gets counted.
        </div>
      ) : null}

      {!loading && daysWithMovement >= 2 ? (
        <>
          <svg
            className="stock-chart-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${ingredient.name}: quantity on hand over the last ${rows.length} days, in ${unit}`}
          >
            {/* gridlines + y labels: zero and top only */}
            {[0, top].map((v) => (
              <g key={v}>
                <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#E6D8C9" strokeWidth="1" />
                <text x={PAD.left - 4} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#6E6759">
                  {fmtQty(v === 0 ? 0 : Math.round(v * 100) / 100)}
                </text>
              </g>
            ))}

            {/* reorder level — the number the cook actually acts on */}
            {threshold > 0 && threshold <= top ? (
              <>
                <line
                  x1={PAD.left}
                  y1={y(threshold)}
                  x2={W - PAD.right}
                  y2={y(threshold)}
                  stroke="#B14C2E"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  opacity="0.75"
                />
                <text x={W - PAD.right} y={y(threshold) - 3} textAnchor="end" fontSize="8" fill="#B14C2E">
                  reorder {fmtQty(threshold)}
                </text>
              </>
            ) : null}

            <polyline points={line} fill="none" stroke="#9A3518" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {rows.map((r, i) =>
              r.quantity == null || !r.events.length ? null : r.observed ? (
                // a count is the only real observation — hollow ring
                <circle key={r.date} cx={x(i)} cy={y(r.quantity)} r="3.6" fill="#FBF6EF" stroke="#B14C2E" strokeWidth="2" />
              ) : (
                <circle key={r.date} cx={x(i)} cy={y(r.quantity)} r="2.8" fill="#9A3518" />
              )
            )}

            {labelIdx.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={H - 6}
                textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}
                fontSize="9"
                fill="#6E6759"
              >
                {shortDate(rows[i].date)}
              </text>
            ))}

            {/* One tap area over the whole plot, snapping to the nearest day.
                Per-day columns are only ~8px wide at 30 days on a phone — far
                under a thumb — and leave dead zones between them. This way any
                tap in the plot lands on the closest day. */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={PLOT_W}
              height={PLOT_H}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                const box = e.currentTarget.getBoundingClientRect()
                const frac = (e.clientX - box.left) / box.width
                const i = Math.max(0, Math.min(rows.length - 1, Math.round(frac * (rows.length - 1))))
                setSelected(rows[i].date === selected ? null : rows[i].date)
              }}
            />
            {/* marks which day the tap landed on */}
            {selected && rows.some((r) => r.date === selected) ? (
              <line
                x1={x(rows.findIndex((r) => r.date === selected))}
                y1={PAD.top}
                x2={x(rows.findIndex((r) => r.date === selected))}
                y2={PAD.top + PLOT_H}
                stroke="#6E6759"
                strokeWidth="1"
                opacity="0.45"
              />
            ) : null}
          </svg>

          <div className="chart-legend">
            <span><span className="lg-ring" /> counted</span>
            <span><span className="lg-dot" /> restock or dish</span>
            <span>flat line = not counted that day</span>
          </div>

          {selectedRow ? (
            <div className="note" style={{ marginTop: 0 }}>
              <b>{shortDate(selectedRow.date)}</b> —{' '}
              {selectedRow.quantity == null ? 'nothing on record' : `${fmtQty(selectedRow.quantity)} ${unit}`}
              {selectedRow.events.length ? (
                selectedRow.events.map((m) => (
                  <div key={m.id} style={{ marginTop: 4 }}>
                    {KINDS[m.kind]?.icon ?? '•'} {describeMovement(m, unit)}
                  </div>
                ))
              ) : (
                <div style={{ marginTop: 4 }}>Not counted — carried forward from the day before.</div>
              )}
            </div>
          ) : (
            <div className="muted" style={{ padding: '2px 2px 0' }}>Tap the chart to see a day.</div>
          )}
        </>
      ) : null}

      {!loading && clamped && unitChange ? (
        <div className="note" style={{ marginTop: 8 }}>
          Showing only since {shortDate(unitChange.created_at.slice(0, 10))}, when this item's unit
          changed{describeUnitChange(unitChange) ? ` (${describeUnitChange(unitChange)})` : ''}.
          Earlier counts were recorded in the old unit, so drawing them on the same line would show
          a jump that never happened.
        </div>
      ) : null}
    </div>
  )
}
