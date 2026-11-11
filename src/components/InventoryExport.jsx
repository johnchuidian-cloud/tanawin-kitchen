import { useState } from 'react'
import {
  currentRows,
  historyRows,
  toCsv,
  downloadCsv,
  todayKey,
  daysAgoKey,
  dayKeysBetween,
  MAX_EXPORT_DAYS,
} from '../lib/export.js'

const RANGES = [
  { key: 'current', label: 'Current' },
  { key: '15', label: '15 days' },
  { key: '30', label: '30 days' },
  { key: 'custom', label: 'Custom' },
]

/**
 * Download the inventory as a CSV (opens in Excel). `items` is the active
 * list — archived items are left out, same as the main Inventory view.
 */
export default function InventoryExport({ items, onClose }) {
  const today = todayKey()
  const [range, setRange] = useState('current')
  const [from, setFrom] = useState(daysAgoKey(6))
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // Validate here, in words a person can act on. A blank or reversed date
  // reaching the query would fail with an error nobody could read.
  const customProblem = () => {
    if (!from || !to) return 'Pick both a start and an end date.'
    if (from > to) return 'The start date is after the end date.'
    if (to > today) return "The end date can't be in the future."
    if (dayKeysBetween(from, to).length > MAX_EXPORT_DAYS)
      return `That's more than ${MAX_EXPORT_DAYS} days. Pick a shorter range.`
    return null
  }

  const run = async () => {
    setError('')
    setDone('')
    if (!items.length) {
      setError('There are no items to export.')
      return
    }
    let start
    let end = today
    if (range === 'custom') {
      const problem = customProblem()
      if (problem) {
        setError(problem)
        return
      }
      start = from
      end = to
    } else if (range !== 'current') {
      start = daysAgoKey(Number(range) - 1) // "15 days" = today and the 14 before it
    }

    setBusy(true)
    try {
      const rows = range === 'current' ? currentRows(items) : await historyRows(items, start, end)
      const name =
        range === 'current'
          ? `tanawin-inventory-${today}.csv`
          : `tanawin-inventory-${start}-to-${end}.csv`
      downloadCsv(name, toCsv(rows))
      const days = rows[0].length - 3
      setDone(
        `Downloaded ${name} — ${items.length} item${items.length === 1 ? '' : 's'}` +
          (range === 'current' ? ', today’s counts.' : `, ${days} day${days === 1 ? '' : 's'}.`)
      )
    } catch (e) {
      setError(e.message || 'Could not build the file. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="edit-panel export-panel">
      <div className="export-title">⬇️ Export inventory</div>
      <div className="meal-filter" role="radiogroup" aria-label="What to export">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={range === r.key}
            className={`chip ${range === r.key ? 'on' : ''}`}
            onClick={() => {
              setRange(r.key)
              setError('')
              setDone('')
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === 'custom' ? (
        <div className="export-dates">
          <div className="field">
            <label htmlFor="export-from">From</label>
            <input id="export-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="export-to">To</label>
            <input id="export-to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      ) : null}

      <div className="note" style={{ marginTop: 4, marginBottom: 10 }}>
        {range === 'current'
          ? 'One row per item with today’s count.'
          : 'One row per item, one column per day — the count at the end of each day. Days nobody counted repeat the last known number.'}{' '}
        Opens in Excel or Google Sheets.
      </div>

      {error ? <div className="error">{error}</div> : null}
      {done ? <div className="success">{done}</div> : null}

      <div className="appr-actions">
        <button className="btn green" type="button" disabled={busy} onClick={run}>
          {busy ? 'Preparing…' : 'Download file'}
        </button>
        <button className="btn ghost" type="button" disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
