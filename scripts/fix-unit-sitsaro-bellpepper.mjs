/**
 * One-off: switch Sitsaro and Bell pepper from kilos to grams.
 *
 * Both were added in kg, then re-counted by a cook as "500" and "250" — grams
 * typed into a kilo field — and corrected back to 0.5 and 0.25 kg. The values
 * are right, but the cook plainly thinks in grams for these two, so counting
 * them in kg invites the same mistake again. Confirmed with Lexi.
 *
 * The quantity is converted with the unit (0.5 kg -> 500 g): the app never
 * does this automatically, because only a person can know whether "2" meant
 * kilos or grams. Here a person has said.
 *
 * Recorded as a 'correction' movement, NOT a count — the same food is on the
 * shelf before and after, and it must never read as stock appearing.
 *
 *   node scripts/fix-unit-sitsaro-bellpepper.mjs
 */
import { readFileSync } from 'node:fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const readEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()
const BASE = `${readEnv('VITE_SUPABASE_URL')}/rest/v1`
const KEY = readEnv('VITE_SUPABASE_ANON_KEY')
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const TARGETS = ['Sitsaro', 'Bell pepper']

const get = async (path) => {
  const res = await fetch(`${BASE}/${path}`, { headers })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`)
  return res.json()
}

// Whoever is recorded as having made the corrections — so the ledger entry
// isn't attributed to nobody.
const [lexi] = await get('kitchen_users?name=eq.Lexi&select=id')

for (const name of TARGETS) {
  const [item] = await get(`ingredients?name=eq.${encodeURIComponent(name)}&select=id,name,unit,quantity`)
  if (!item) {
    console.error(`${name}: not found — skipped`)
    continue
  }
  if (item.unit !== 'kg') {
    console.log(`${name}: already in ${item.unit} — nothing to do`)
    continue
  }

  const grams = Math.round(Number(item.quantity) * 1000 * 10000) / 10000
  console.log(`${name}: ${item.quantity} kg -> ${grams} g`)

  const upd = await fetch(`${BASE}/ingredients?id=eq.${item.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ unit: 'g', quantity: grams }),
  })
  if (!upd.ok) throw new Error(`${name} update: HTTP ${upd.status} ${await upd.text()}`)

  const mv = await fetch(`${BASE}/stock_movements`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ingredient_id: item.id,
      kind: 'correction',
      delta: null, // no stock changed hands; only the measurement did
      qty_after: grams,
      actor: lexi?.id ?? null,
      note: `Unit changed from kg to g (${item.quantity} kg is the same as ${grams} g)`,
    }),
  })
  if (!mv.ok) throw new Error(`${name} movement: HTTP ${mv.status} ${await mv.text()}`)

  const log = await fetch(`${BASE}/activity_log`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: `Stock item updated — ${item.name} (unit kg → g, ${item.quantity} → ${grams})`,
      actor: lexi?.id ?? null,
      detail: { type: 'ingredient_update', ingredient_id: item.id },
    }),
  })
  if (!log.ok) console.warn(`${name}: activity log failed (non-fatal)`)
}

console.log('Done.')
