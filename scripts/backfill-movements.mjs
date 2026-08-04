/**
 * One-off backfill for migration 11 (stock_movements).
 *
 * The app only started recording movements when migration 11 landed, but the
 * team had already been counting and restocking for weeks — and that history
 * is exactly what the day-by-day view is for. This reconstructs it from two
 * places that were already keeping the numbers:
 *
 *   purchases            → 'purchase' rows (prev_quantity + quantity = qty_after)
 *   activity_log         → 'count' rows (detail.from / detail.to)
 *   purchases.undone_at  → 'undo' rows
 *
 * Safe to re-run: the unique index on (source_table, source_id) means a second
 * pass inserts nothing rather than duplicating history.
 *
 * Run from the repo root, AFTER Lexi has applied supabase/11-stock-tracking.sql:
 *   node scripts/backfill-movements.mjs
 */
import { readFileSync } from 'node:fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const readEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()

const URL_BASE = `${readEnv('VITE_SUPABASE_URL')}/rest/v1`
const KEY = readEnv('VITE_SUPABASE_ANON_KEY')
if (!URL_BASE || !KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

// PostgREST caps every query at 1000 rows — page or silently lose history.
async function getAll(path) {
  const PAGE = 1000
  const out = []
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${URL_BASE}/${path}`, {
      headers: { ...headers, Range: `${from}-${from + PAGE - 1}` },
    })
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

const round4 = (n) => Math.round(Number(n) * 10000) / 10000

const purchases = await getAll(
  'purchases?select=id,ingredient_id,quantity,prev_quantity,purchased_at,recorded_by,undone_at'
)
const activity = await getAll('activity_log?select=id,actor,detail,created_at')

const rows = []

for (const p of purchases) {
  const qty = Number(p.quantity)
  const after = round4(Number(p.prev_quantity ?? 0) + qty)
  rows.push({
    ingredient_id: p.ingredient_id,
    kind: 'purchase',
    delta: qty,
    qty_after: after,
    occurred_at: p.purchased_at,
    actor: p.recorded_by,
    source_table: 'purchases',
    source_id: String(p.id),
    note: 'backfilled',
  })
  if (p.undone_at) {
    rows.push({
      ingredient_id: p.ingredient_id,
      kind: 'undo',
      delta: -qty,
      qty_after: round4(after - qty),
      occurred_at: p.undone_at,
      actor: p.recorded_by,
      source_table: 'purchases_undo',
      source_id: String(p.id),
      note: 'backfilled',
    })
  }
}

for (const a of activity) {
  const d = a.detail
  if (!d || d.type !== 'stock_count' || !d.ingredient_id) continue
  if (d.to == null) continue
  rows.push({
    ingredient_id: d.ingredient_id,
    kind: 'count',
    delta: d.from == null ? null : round4(Number(d.to) - Number(d.from)),
    qty_after: round4(Number(d.to)),
    occurred_at: a.created_at,
    actor: a.actor,
    source_table: 'activity_log',
    source_id: String(a.id),
    note: 'backfilled',
  })
}

rows.sort((x, y) => new Date(x.occurred_at) - new Date(y.occurred_at))
console.log(
  `Prepared ${rows.length} movements ` +
    `(${rows.filter((r) => r.kind === 'purchase').length} restocks, ` +
    `${rows.filter((r) => r.kind === 'count').length} counts, ` +
    `${rows.filter((r) => r.kind === 'undo').length} undos)`
)

// merge-duplicates: re-running skips rows already present rather than failing
// the whole batch on the unique index.
let inserted = 0
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200)
  const res = await fetch(`${URL_BASE}/stock_movements?on_conflict=source_table,source_id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(chunk),
  })
  if (!res.ok) {
    console.error(`Chunk ${i}: HTTP ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  inserted += (await res.json()).length
}

console.log(`Done — ${inserted} movement rows in the ledger.`)
