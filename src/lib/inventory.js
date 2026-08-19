import { supabase } from './supabase.js'
import { logActivity } from './activity.js'
import { recordMovement } from './movements.js'

// Which meal a stock item is mainly used for. Loose grouping for the team —
// nothing enforces it.
export const MEAL_TAGS = [
  { key: 'breakfast', label: 'Breakfast', short: '🌅 Breakfast' },
  { key: 'lunch_dinner', label: 'Lunch/Dinner', short: '🍽️ Lunch/Dinner' },
  { key: 'both', label: 'Both', short: '🌅🍽️ Both' },
]
export const mealShort = (tag) => MEAL_TAGS.find((m) => m.key === tag)?.short ?? null

const INGREDIENT_COLS =
  'id, name, unit, quantity, min_threshold, cost_per_unit, meal_tag, aliases, supplier_id, supplier:suppliers(name)'

/**
 * Columns added by later migrations, OLDEST FIRST:
 *   shelf_life_days — migration 11
 *   archived_at     — migration 12
 *   notes           — migration 13
 *
 * Asking PostgREST for a column that doesn't exist fails the WHOLE query, so
 * these are dropped one at a time from the end until the read succeeds. An
 * all-or-nothing fallback looked simpler and was wrong: adding `notes` made
 * every request fail on a database that had 11 and 12 applied, which silently
 * took archiving and shelf life down with it — and, worse, made archived
 * items reappear in the main list because archived_at came back missing.
 */
const OPTIONAL_COLS = ['shelf_life_days', 'archived_at', 'notes']

// Remembered after the first successful read so the retries happen once per
// session rather than on every screen.
let workingCols = null

// Teach an existing item another spelling ("sibuyas" → Onion) so nobody
// creates a duplicate next time. Non-fatal: the action it accompanies has
// already succeeded.
export async function learnAlias(ingredient, spelling, actorId) {
  const clean = (spelling || '').trim()
  if (!clean) return ingredient
  const existing = ingredient.aliases ?? []
  if (existing.some((a) => a.toLowerCase() === clean.toLowerCase())) return ingredient
  const aliases = [...existing, clean]
  const { data, error } = await supabase
    .from('ingredients')
    .update({ aliases })
    .eq('id', ingredient.id)
    .select(INGREDIENT_COLS)
    .single()
  if (error) {
    console.warn('Could not save alias:', error.message)
    return ingredient
  }
  await logActivity(`Stock item alias added — "${clean}" → ${ingredient.name}`, actorId, {
    type: 'ingredient_alias',
    ingredient_id: ingredient.id,
  })
  return data
}

// Read all ingredients with their supplier name (if linked), sorted by name.
// Archived items are left out everywhere by default — that's the point of
// archiving — except where seeing them is the whole idea (their own history,
// and the Inventory screen's "show archived" view).
export async function fetchIngredients({ includeArchived = false } = {}) {
  // Richest set first, then progressively fewer optional columns.
  const candidates = workingCols
    ? [workingCols]
    : [...Array(OPTIONAL_COLS.length + 1)].map((_, i) => OPTIONAL_COLS.slice(0, OPTIONAL_COLS.length - i))

  let lastError = null
  for (const cols of candidates) {
    const select = [INGREDIENT_COLS, ...cols].join(', ')
    let q = supabase.from('ingredients').select(select).order('name')
    // Only filter on a column we're actually asking for, or the filter itself
    // becomes the thing that fails.
    if (!includeArchived && cols.includes('archived_at')) q = q.is('archived_at', null)
    const { data, error } = await q
    if (!error) {
      workingCols = cols
      return data ?? []
    }
    lastError = error
  }
  throw lastError
}

// Edit a stock item: name, unit, reorder level, meal tag. NOTE: changing the
// unit does NOT convert the on-hand quantity or the cost-per-unit — the UI
// warns about this, since only a human knows whether "2" kg meant "2000" g.
export async function updateIngredient(ingredient, fields, actorId) {
  const patch = {
    name: fields.name.trim(),
    unit: fields.unit,
    min_threshold: fields.minThreshold === '' ? 0 : Number(fields.minThreshold),
    meal_tag: fields.mealTag || null,
    aliases: (fields.aliases ?? '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  }
  // Only send these if the columns are actually there — the ingredient we
  // were handed came from fetchIngredients, which drops them pre-migration.
  if ('shelf_life_days' in ingredient) {
    patch.shelf_life_days =
      fields.shelfLife === '' || fields.shelfLife == null ? null : Number(fields.shelfLife)
  }
  if ('notes' in ingredient) {
    patch.notes = (fields.notes ?? '').trim() || null
  }
  const { data, error } = await supabase
    .from('ingredients')
    .update(patch)
    .eq('id', ingredient.id)
    // Same column set the list was read with, so the updated row comes back
    // shaped like its neighbours.
    .select([INGREDIENT_COLS, ...(workingCols ?? [])].join(', '))
    .single()
  if (error) throw error
  const bits = []
  if (patch.name !== ingredient.name) bits.push(`renamed from ${ingredient.name}`)
  if (patch.unit !== ingredient.unit) bits.push(`unit ${ingredient.unit} → ${patch.unit}`)
  if (Number(patch.min_threshold) !== Number(ingredient.min_threshold))
    bits.push(`min ${ingredient.min_threshold} → ${patch.min_threshold}`)
  if ((patch.meal_tag ?? null) !== (ingredient.meal_tag ?? null))
    bits.push(`meal ${patch.meal_tag ?? 'none'}`)
  await logActivity(
    `Stock item updated — ${patch.name}${bits.length ? ` (${bits.join('; ')})` : ''}`,
    actorId,
    { type: 'ingredient_update', ingredient_id: ingredient.id }
  )
  return data
}

// Stock status vs. the ingredient's min_threshold:
//   low  — at or below threshold (needs restocking)
//   mid  — within 50% above threshold (getting low)
//   ok   — comfortably stocked
export function stockStatus(ing) {
  if (ing.quantity <= ing.min_threshold) return 'low'
  if (ing.quantity <= ing.min_threshold * 1.5) return 'mid'
  return 'ok'
}

// Compact unit label for the tight quantity column (pieces → pc, packs → pk).
const UNIT_SHORT = { pieces: 'pc', packs: 'pk' }
export function shortUnit(unit) {
  return UNIT_SHORT[unit] ?? unit
}

// Trim trailing zeros: 2.50 → "2.5", 22 → "22".
export function fmtQty(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// Common stocking units, for the add-item picker.
export const UNITS = ['kg', 'g', 'L', 'ml', 'pieces', 'packs', 'bottle', 'box', 'can', 'carton', 'gallon', 'stick', 'tub']

// Add a new stock item to the catalog. Staff AND admin may do this directly
// (per Lexi/John): a new item starts at qty 0 / cost ₱0, so it has no
// financial impact — counts and purchases still follow their own rules.
export async function addIngredient({ name, unit, minThreshold, mealTag, quantity, notes }, actorId) {
  const onHand = quantity === '' || quantity == null ? 0 : Number(quantity)
  const row = {
    name: name.trim(),
    unit,
    quantity: Number.isFinite(onHand) && onHand > 0 ? onHand : 0,
    min_threshold: Number(minThreshold) || 0,
    cost_per_unit: 0,
    meal_tag: mealTag || null,
  }
  // Sent only when there's something to send: the add form hides the field
  // until migration 13 has run, so this can't reach a column that isn't there.
  if (notes?.trim()) row.notes = notes.trim()
  const { data, error } = await supabase
    .from('ingredients')
    .insert(row)
    .select(INGREDIENT_COLS)
    .single()
  if (error) throw error
  await logActivity(
    `Stock item added — ${data.name} (${unit})` +
      (data.quantity > 0 ? `, starting stock ${fmtQty(data.quantity)} ${shortUnit(unit)}` : ''),
    actorId,
    { type: 'ingredient_add', ingredient_id: data.id }
  )
  // Recorded even at zero: it's the item's opening balance, and without it
  // the history has nothing to carry forward from.
  await recordMovement({
    ingredientId: data.id,
    kind: 'add',
    delta: data.quantity,
    qtyAfter: data.quantity,
    actorId,
    sourceTable: 'ingredients',
    sourceId: data.id,
  })
  return data
}

/**
 * What this item would take with it if it were really deleted. Deleting an
 * ingredient CASCADES — verified against the live database — so its purchase
 * records (real money, pulled from the Expenses app), its stock history and
 * its remembered Finance matches all go too.
 *
 * Counts are read with a HEAD request so nothing but the totals comes back.
 */
export async function ingredientUsage(ingredientId) {
  const count = async (table, column = 'ingredient_id') => {
    const { count: n, error } = await supabase
      .from(table)
      .select(column, { count: 'exact', head: true })
      .eq(column, ingredientId)
    if (error) {
      // Unknown means "can't promise it's safe" — treated as blocking below.
      console.warn(`usage check failed on ${table}:`, error.message)
      return null
    }
    return n ?? 0
  }
  const [purchases, movements, recipeLines, waste, financeMatches] = await Promise.all([
    count('purchases'),
    count('stock_movements'),
    count('recipe_ingredients'),
    count('waste_log'),
    count('finance_item_map'),
  ])
  const known = [purchases, movements, recipeLines, waste, financeMatches]
  return {
    purchases,
    movements,
    recipeLines,
    waste,
    financeMatches,
    // Safe to delete only when every check came back, and came back zero.
    isEmpty: known.every((n) => n === 0),
  }
}

// Plain-English list of what a delete would destroy: "4 purchase records, 5
// history entries". Empty when there's nothing to lose.
export function describeUsage(u) {
  const bits = []
  if (u.purchases) bits.push(`${u.purchases} purchase record${u.purchases === 1 ? '' : 's'}`)
  if (u.movements) bits.push(`${u.movements} history entr${u.movements === 1 ? 'y' : 'ies'}`)
  if (u.recipeLines) bits.push(`${u.recipeLines} recipe line${u.recipeLines === 1 ? '' : 's'}`)
  if (u.waste) bits.push(`${u.waste} waste entr${u.waste === 1 ? 'y' : 'ies'}`)
  if (u.financeMatches)
    bits.push(`${u.financeMatches} remembered Finance match${u.financeMatches === 1 ? '' : 'es'}`)
  return bits.join(', ')
}

// Retire an item: it vanishes from Inventory and every dropdown, and nothing
// is destroyed. Reversible — that's why this is the normal way to remove one.
export async function archiveIngredient(ingredient, actorId) {
  const { error } = await supabase
    .from('ingredients')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', ingredient.id)
  if (error) throw error
  await logActivity(`Stock item archived — ${ingredient.name}`, actorId, {
    type: 'ingredient_archive',
    ingredient_id: ingredient.id,
  })
}

export async function unarchiveIngredient(ingredient, actorId) {
  const { error } = await supabase
    .from('ingredients')
    .update({ archived_at: null })
    .eq('id', ingredient.id)
  if (error) throw error
  await logActivity(`Stock item restored — ${ingredient.name}`, actorId, {
    type: 'ingredient_unarchive',
    ingredient_id: ingredient.id,
  })
}

/**
 * Really delete — only ever offered for an item with no history whatsoever,
 * so the cascade has nothing to take. The usage check is repeated here rather
 * than trusted from the screen: the button may have been sitting there a
 * while, and this is the irreversible one.
 */
export async function deleteIngredient(ingredient, actorId) {
  const usage = await ingredientUsage(ingredient.id)
  if (!usage.isEmpty) {
    throw new Error(
      `${ingredient.name} now has history attached (${describeUsage(usage)}). ` +
        `Archive it instead — deleting would destroy that.`
    )
  }
  const { error } = await supabase.from('ingredients').delete().eq('id', ingredient.id)
  if (error) throw error
  await logActivity(`Stock item deleted — ${ingredient.name} (no history)`, actorId, {
    type: 'ingredient_delete',
  })
}

// Record a physical stock recount: set the ingredient's quantity to the
// counted value and log it to the audit trail. Staff may do this directly —
// no approval needed (it's an observation, not a structural/cost change).
export async function saveStockCount(ingredient, newQty, actorId) {
  const { error } = await supabase
    .from('ingredients')
    .update({ quantity: newQty })
    .eq('id', ingredient.id)
  if (error) throw error
  await logActivity(
    `Stock counted — ${ingredient.name} ${fmtQty(newQty)} ${shortUnit(ingredient.unit)}`,
    actorId,
    {
      type: 'stock_count',
      ingredient_id: ingredient.id,
      from: ingredient.quantity,
      to: newQty,
    }
  )
  // delta here is counted-minus-expected, not consumption: purchases and
  // cooked dishes have already moved `quantity` on their own. What's left is
  // the unaccounted gap.
  await recordMovement({
    ingredientId: ingredient.id,
    kind: 'count',
    delta: Number(newQty) - Number(ingredient.quantity),
    qtyAfter: newQty,
    actorId,
  })
}
