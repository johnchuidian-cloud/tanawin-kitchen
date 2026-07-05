import { supabase } from './supabase.js'

// Finance categories that represent food/ingredient purchases worth pulling
// into Kitchen. (Finance and Kitchen share the same Supabase project, so this
// is a direct READ of Finance's entries table — Kitchen never writes to it.)
export const FOOD_CATEGORIES = ['Kitchen', 'Breakfast', 'Lunch/Dinner', 'Staff Meals', 'Coffee']

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Canonical key for a Finance item name ("Sili pula" -> "silipula") — the
// lookup key for remembered item -> ingredient mappings.
export const itemKey = normalize

// Remembered mappings: itemKey -> ingredient uuid, or null meaning "this item
// is not an ingredient" (e.g. Transpo). Non-fatal on failure: the import list
// still works without them, just with less auto-matching.
export async function fetchItemMaps() {
  const { data, error } = await supabase.from('finance_item_map').select('item_key, ingredient_id')
  if (error) {
    console.warn('finance_item_map read failed (no remembered matches):', error.message)
    return {}
  }
  const map = {}
  for (const r of data ?? []) map[r.item_key] = r.ingredient_id
  return map
}

// Remember a mapping (upsert). Pass ingredientId = null to remember the item
// as "not an ingredient". Non-fatal: the import/dismiss it accompanies has
// already succeeded.
export async function saveItemMap(key, ingredientId, actorId) {
  if (!key) return
  const { error } = await supabase.from('finance_item_map').upsert({
    item_key: key,
    ingredient_id: ingredientId,
    created_by: actorId ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) console.warn('finance_item_map save failed:', error.message)
}

// Forget a remembered mapping (used by "restore" on auto-skipped items).
export async function forgetItemMap(key) {
  const { error } = await supabase.from('finance_item_map').delete().eq('item_key', key)
  if (error) throw error
}

// Best-guess Kitchen ingredient for a free-text Finance item name.
export function suggestIngredient(itemName, ingredients) {
  const n = normalize(itemName)
  if (!n) return null
  let m = ingredients.find((i) => normalize(i.name) === n)
  if (m) return m
  m = ingredients.find((i) => {
    const ni = normalize(i.name)
    return ni.includes(n) || n.includes(ni)
  })
  if (m) return m
  const first = normalize((itemName || '').split(/\s+/)[0])
  if (first.length >= 3) {
    m = ingredients.find((i) => normalize(i.name).includes(first))
    if (m) return m
  }
  return null
}

// PostgREST silently caps any query at 1000 rows — a truncated read of the
// reconciliation table would make handled entries look unhandled (double-import
// risk), so page through with .range() until a short page.
async function fetchAllHandledIds() {
  const PAGE = 1000
  const ids = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('finance_reconciliations')
      .select('finance_entry_id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data ?? []) ids.push(r.finance_entry_id)
    if (!data || data.length < PAGE) break
  }
  return ids
}

// Finance food purchases from the last ~60 days that Kitchen hasn't yet
// handled (synced or dismissed). Filtered against Kitchen's own reconciliation
// table so nothing shows — or imports — twice.
export async function fetchFinanceImports() {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [entriesRes, handledIds] = await Promise.all([
    supabase
      .from('entries')
      .select('id, date, vendor, item, qty, total, category')
      .in('category', FOOD_CATEGORIES)
      .gte('date', since)
      .order('date', { ascending: false })
      .limit(1000),
    fetchAllHandledIds(),
  ])
  if (entriesRes.error) throw entriesRes.error
  const handled = new Set(handledIds)
  return (entriesRes.data ?? []).filter((e) => !handled.has(String(e.id)))
}

// Record (Kitchen-side only) that a Finance entry has been synced or dismissed.
export async function markReconciled(financeEntryId, status, extra, actorId) {
  const { error } = await supabase.from('finance_reconciliations').upsert({
    finance_entry_id: String(financeEntryId),
    status,
    ingredient_id: extra?.ingredientId ?? null,
    handled_by: actorId ?? null,
    handled_at: new Date().toISOString(),
  })
  if (error) throw error
}
