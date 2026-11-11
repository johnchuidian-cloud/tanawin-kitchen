// ---------------------------------------------------------------------------
// INVENTORY EXPORT — a CSV file that opens straight in Excel.
//
//   Current      ITEM, PURCHASE UNIT, UNIT, <today>         today's counts
//   15/30/custom ITEM, PURCHASE UNIT, UNIT, <date>, <date>…  one column per day
//
// Each day's number is what was on hand at the END of that day, built from
// stock_movements the same way the in-app day-by-day list is (dailySeries):
// the day's last movement wins, and quiet days carry the previous number
// forward. Oldest day first, so the columns read left to right like a
// calendar.
// ---------------------------------------------------------------------------

import { supabase } from './supabase.js'
import { fetchAllRows } from './paginate.js'
import { dayKey } from './movements.js'
import { exportUnit } from './inventory.js'
import { categorySortKey, groupName } from './categories.js'

// A year of columns is already more than anyone reads; past that the file is
// mostly empty cells and the request mostly waiting.
export const MAX_EXPORT_DAYS = 366

const round4 = (n) => Math.round(Number(n) * 10000) / 10000

// Local midnight of a YYYY-MM-DD key.
const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayKey = () => dayKey(new Date())

export function daysAgoKey(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dayKey(d)
}

// Every date from `from` to `to`, inclusive.
export function dayKeysBetween(from, to) {
  const keys = []
  const cur = fromKey(from)
  const end = fromKey(to)
  while (cur <= end) {
    keys.push(dayKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return keys
}

// Column header for a day: "Nov 1", plus the year only when the range crosses
// one (so a Dec–Jan export can't be read as one year).
function dateLabel(key, withYear) {
  return fromKey(key).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

// Same order as the Inventory screen: by category, then by name.
function sortForExport(items) {
  return [...items].sort(
    (a, b) =>
      categorySortKey(groupName(a)).localeCompare(categorySortKey(groupName(b))) ||
      a.name.localeCompare(b.name)
  )
}

// Run fn over items, at most `limit` at a time — 80 one-row requests at once
// would queue in the browser anyway, and politely is faster on a weak signal.
async function mapLimit(items, limit, fn) {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

/**
 * Movements inside the range for every item, plus each item's opening balance
 * (its last recorded quantity before the range starts). Without the opening
 * balance, the first days of the range would be blank for anything that
 * wasn't touched on day one.
 */
async function fetchRange(items, from, to) {
  const start = fromKey(from)
  const end = fromKey(to)
  end.setDate(end.getDate() + 1) // exclusive: up to the end of `to`
  const ids = new Set(items.map((i) => i.id))

  const movements = (
    await fetchAllRows(() =>
      supabase
        .from('stock_movements')
        .select('id, ingredient_id, qty_after, occurred_at')
        .gte('occurred_at', start.toISOString())
        .lt('occurred_at', end.toISOString())
        // Unique order: paging on occurred_at alone can drop same-second rows
        // at a page boundary.
        .order('occurred_at', { ascending: true })
        .order('id')
    )
  ).filter((m) => ids.has(m.ingredient_id))

  const openings = {}
  await mapLimit(items, 6, async (item) => {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('qty_after, occurred_at')
      .eq('ingredient_id', item.id)
      .lt('occurred_at', start.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(5)
    if (error) throw error
    // A few rows, not one: a movement can carry no quantity, and the opening
    // balance is the latest one that does.
    openings[item.id] = (data ?? []).find((r) => r.qty_after != null)?.qty_after ?? null
  })

  return { movements, openings }
}

function buildRows(items, keys, { movements, openings }) {
  // ingredient → day → closing quantity (movements arrive oldest first, so the
  // last one written for a day is that day's closing figure).
  const closing = new Map()
  for (const m of movements) {
    if (m.qty_after == null) continue
    if (!closing.has(m.ingredient_id)) closing.set(m.ingredient_id, new Map())
    closing.get(m.ingredient_id).set(dayKey(m.occurred_at), Number(m.qty_after))
  }
  const today = todayKey()

  return sortForExport(items).map((item) => {
    const byDay = closing.get(item.id)
    let running = openings[item.id] == null ? null : Number(openings[item.id])
    const values = keys.map((k) => {
      const c = byDay?.get(k)
      if (c != null) running = c
      // An item with no recorded history at all still has a live number —
      // show it for today rather than leave even that blank.
      if (running == null && k === today) return Number(item.quantity)
      return running
    })
    const u = exportUnit(item)
    return [item.name, u.size, u.unit, ...values]
  })
}

const HEADER = ['ITEM', 'PURCHASE UNIT', 'UNIT']

// Today's counts: one date column, straight from the live numbers.
export function currentRows(items) {
  const header = [...HEADER, dateLabel(todayKey(), false)]
  const rows = sortForExport(items).map((item) => {
    const u = exportUnit(item)
    return [item.name, u.size, u.unit, Number(item.quantity)]
  })
  return [header, ...rows]
}

// One column per day between `from` and `to`, inclusive.
export async function historyRows(items, from, to) {
  const keys = dayKeysBetween(from, to)
  const withYear = from.slice(0, 4) !== to.slice(0, 4)
  const header = [...HEADER, ...keys.map((k) => dateLabel(k, withYear))]
  const data = await fetchRange(items, from, to)
  return [header, ...buildRows(items, keys, data)]
}

/**
 * One CSV cell. Text that starts with = + - @ is prefixed with an apostrophe:
 * item names are typed by people, and Excel would otherwise run a name like
 * "=HYPERLINK(…)" as a formula. Numbers go out raw — no thousands separators,
 * which would split "1,000" into two cells.
 */
function cell(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(round4(v)) : ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

// The byte-order mark makes Excel read the file as UTF-8, so ₱, ñ and the
// Tagalog names come through intact instead of as garbled characters.
export function toCsv(rows) {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked a moment later: some phone browsers read the link after click()
  // returns.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
