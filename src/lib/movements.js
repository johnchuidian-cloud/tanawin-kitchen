import { supabase } from './supabase.js'

// ---------------------------------------------------------------------------
// STOCK MOVEMENT HISTORY
//
// `ingredients.quantity` is the live number; stock_movements is the history
// behind it. Every path that changes on-hand stock appends one row here, so
// the app can show a day-by-day record per item and how long it's been since
// anyone touched something.
//
// Two sources of truth, deliberately kept apart:
//   - cooking a dish DEDUCTS stock  → what we EXPECT to be there
//   - a physical count OBSERVES it  → what actually IS there
// A count's `delta` is the gap between the two. Treating that gap as "more
// usage" would double-count every dish already logged, so it's reported as
// unaccounted-for stock instead — which is the spoilage signal worth seeing.
// ---------------------------------------------------------------------------

export const KINDS = {
  add: { label: 'Added', icon: '✨' },
  purchase: { label: 'Restocked', icon: '📦' },
  count: { label: 'Counted', icon: '📋' },
  use: { label: 'Cooked', icon: '🍳' },
  waste: { label: 'Waste', icon: '🗑️' },
  undo: { label: 'Restock undone', icon: '↩️' },
}

const round4 = (n) => Math.round(Number(n) * 10000) / 10000

/**
 * Append one movement. Non-fatal by design: the stock change it describes has
 * already happened, and losing a history row must never roll that back or
 * show the user an error for something that did work. Same rule as the
 * activity log.
 */
export async function recordMovement({
  ingredientId,
  kind,
  delta = null,
  qtyAfter = null,
  actorId = null,
  recipeId = null,
  servings = null,
  sourceTable = null,
  sourceId = null,
  note = null,
  occurredAt = null,
}) {
  const row = {
    ingredient_id: ingredientId,
    kind,
    delta: delta == null ? null : round4(delta),
    qty_after: qtyAfter == null ? null : round4(qtyAfter),
    actor: actorId,
    recipe_id: recipeId,
    servings,
    source_table: sourceTable,
    source_id: sourceId ? String(sourceId) : null,
    note,
  }
  if (occurredAt) row.occurred_at = occurredAt
  const { error } = await supabase.from('stock_movements').insert(row)
  if (error) console.error('stock_movements insert failed:', error.message)
}

// ---------------------------------------------------------------------------
// Ages — "counted 4d ago", "restocked yesterday"
// ---------------------------------------------------------------------------

/**
 * Latest movement per item per kind, from the stock_item_status view. One
 * small query (a few hundred rows at most) instead of paging the whole
 * ledger down to a phone.
 *
 * Returns { [ingredientId]: { count: {at, qtyAfter}, purchase: {...}, … } }.
 */
export async function fetchItemStatus() {
  const { data, error } = await supabase
    .from('stock_item_status')
    .select('ingredient_id, kind, occurred_at, qty_after')
  if (error) {
    // The view is missing until the migration runs — the rest of the screen
    // still works, it just shows no ages.
    console.warn('stock_item_status read failed (no ages shown):', error.message)
    return {}
  }
  const map = {}
  for (const r of data ?? []) {
    map[r.ingredient_id] ??= {}
    map[r.ingredient_id][r.kind] = { at: r.occurred_at, qtyAfter: r.qty_after }
  }
  return map
}

// Whole days elapsed, counted from midnight so "yesterday" means yesterday's
// date rather than "more than 24 hours ago".
export function daysSince(iso) {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((startOf(new Date()) - startOf(then)) / 86400000)
}

export function fmtAge(iso) {
  const d = daysSince(iso)
  if (d == null) return null
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 14) return `${d} days ago`
  if (d < 60) return `${Math.round(d / 7)} weeks ago`
  return `${Math.round(d / 30)} months ago`
}

/**
 * The one-line age summary under an inventory row. Deliberately plain
 * language with no colour or warning: Lexi chose "show the age, let the cook
 * decide" over the app flagging things as spoiled — it can't see inside the
 * container, so it shouldn't pretend to know.
 */
export function ageSummary(status, ingredient) {
  if (!status) return null
  const bits = []
  const counted = fmtAge(status.count?.at)
  if (counted) bits.push(`counted ${counted}`)
  // 'add' covers an item created with starting stock — for a brand-new item
  // that's the only restock-ish event there is.
  const stockedAt = status.purchase?.at ?? status.add?.at
  const stocked = fmtAge(stockedAt)
  if (stocked) bits.push(`restocked ${stocked}`)
  const shelf = ingredient?.shelf_life_days
  if (shelf && stockedAt) bits.push(`keeps ~${shelf}d`)
  return bits.length ? bits.join(' · ') : null
}

// ---------------------------------------------------------------------------
// One item's history
// ---------------------------------------------------------------------------

const MOVEMENT_COLS =
  'id, kind, delta, qty_after, occurred_at, servings, note, ' +
  'actor:kitchen_users(name), recipe:recipes(name)'

/**
 * Every movement for one item within the window, plus the last movement
 * BEFORE it — without that opening balance the first days of the window
 * would have no quantity to carry forward.
 */
export async function fetchItemHistory(ingredientId, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)
  const sinceIso = since.toISOString()

  const [inWindow, opening] = await Promise.all([
    supabase
      .from('stock_movements')
      .select(MOVEMENT_COLS)
      .eq('ingredient_id', ingredientId)
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: true })
      .limit(1000),
    supabase
      .from('stock_movements')
      .select('qty_after, occurred_at')
      .eq('ingredient_id', ingredientId)
      .lt('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })
      .limit(1),
  ])
  if (inWindow.error) throw inWindow.error
  return {
    movements: inWindow.data ?? [],
    openingQty: opening.data?.[0]?.qty_after ?? null,
    since,
  }
}

const dayKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`
}

/**
 * The day-by-day running record Lexi asked for: one row per date, newest
 * first, showing what was on hand at the end of that day.
 *
 * Days with no movement carry the previous day's number forward and are
 * marked `carried` — the app must not draw a flat line and let it be mistaken
 * for someone having checked. Counting has been bursty in practice (52 items
 * one day, then one the next), so most days are carried.
 */
export function dailySeries({ movements, openingQty, since }, days = 30) {
  const byDay = new Map()
  for (const m of movements) {
    const k = dayKey(m.occurred_at)
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k).push(m)
  }

  const rows = []
  let running = openingQty
  const cursor = new Date(since)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  while (cursor <= today) {
    const k = dayKey(cursor)
    const events = byDay.get(k) ?? []
    // The last movement of the day is the day's closing quantity — earlier
    // ones are steps on the way there.
    const closing = events.length ? events[events.length - 1].qty_after : null
    if (closing != null) running = closing

    const counted = events.some((e) => e.kind === 'count')
    rows.push({
      date: k,
      quantity: running,
      carried: !events.length,
      counted,
      events,
      // Only a count is an observation. Everything else is bookkeeping the
      // app did to itself.
      observed: counted,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return rows.slice(-days).reverse()
}

/**
 * Plain-English line for one movement. Counts get the extra clause, because
 * "counted 3 kg" alone hides the interesting part — whether it matched.
 */
export function describeMovement(m, unitLabel) {
  const who = m.actor?.name ? ` · ${m.actor.name}` : ''
  const qty = (n) => `${Math.abs(Number(n)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unitLabel}`

  if (m.kind === 'count') {
    const d = Number(m.delta ?? 0)
    let gap = ''
    if (d < 0) gap = ` — ${qty(d)} less than expected`
    else if (d > 0) gap = ` — ${qty(d)} more than expected`
    return `Counted ${qty(m.qty_after)}${gap}${who}`
  }
  if (m.kind === 'use') {
    const dish = m.recipe?.name ? ` for ${m.recipe.name}` : ''
    const svg = m.servings ? ` ×${m.servings}` : ''
    return `Cooked${dish}${svg} — used ${qty(m.delta)}${who}`
  }
  if (m.kind === 'purchase') return `Restocked +${qty(m.delta)}${who}`
  if (m.kind === 'undo') return `Restock undone −${qty(m.delta)}${who}`
  if (m.kind === 'waste') return `Waste logged ${qty(m.delta)} (stock unchanged until the next count)${who}`
  if (m.kind === 'add') return `Item added with ${qty(m.qty_after)}${who}`
  return `${m.kind} ${qty(m.delta ?? 0)}${who}`
}
