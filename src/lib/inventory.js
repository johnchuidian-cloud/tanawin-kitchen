import { supabase } from './supabase.js'
import { logActivity } from './activity.js'

// Which meal a stock item is mainly used for. Loose grouping for the team —
// nothing enforces it.
export const MEAL_TAGS = [
  { key: 'breakfast', label: 'Breakfast', short: '🌅 Breakfast' },
  { key: 'lunch_dinner', label: 'Lunch/Dinner', short: '🍽️ Lunch/Dinner' },
  { key: 'both', label: 'Both', short: '🌅🍽️ Both' },
]
export const mealShort = (tag) => MEAL_TAGS.find((m) => m.key === tag)?.short ?? null

const INGREDIENT_COLS =
  'id, name, unit, quantity, min_threshold, cost_per_unit, meal_tag, aliases, supplier:suppliers(name)'

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
export async function fetchIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_COLS)
    .order('name')
  if (error) throw error
  return data ?? []
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
  const { data, error } = await supabase
    .from('ingredients')
    .update(patch)
    .eq('id', ingredient.id)
    .select(INGREDIENT_COLS)
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
export async function addIngredient({ name, unit, minThreshold, mealTag, quantity }, actorId) {
  const onHand = quantity === '' || quantity == null ? 0 : Number(quantity)
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      name: name.trim(),
      unit,
      quantity: Number.isFinite(onHand) && onHand > 0 ? onHand : 0,
      min_threshold: Number(minThreshold) || 0,
      cost_per_unit: 0,
      meal_tag: mealTag || null,
    })
    .select(INGREDIENT_COLS)
    .single()
  if (error) throw error
  await logActivity(
    `Stock item added — ${data.name} (${unit})` +
      (data.quantity > 0 ? `, starting stock ${fmtQty(data.quantity)} ${shortUnit(unit)}` : ''),
    actorId,
    { type: 'ingredient_add', ingredient_id: data.id }
  )
  return data
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
}
