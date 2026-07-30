import { supabase } from './supabase.js'
import { logActivity } from './activity.js'

// Read all ingredients with their supplier name (if linked), sorted by name.
export async function fetchIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, quantity, min_threshold, cost_per_unit, supplier:suppliers(name)')
    .order('name')
  if (error) throw error
  return data ?? []
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
export async function addIngredient({ name, unit, minThreshold }, actorId) {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      name: name.trim(),
      unit,
      quantity: 0,
      min_threshold: Number(minThreshold) || 0,
      cost_per_unit: 0,
    })
    .select('id, name, unit, quantity, min_threshold, cost_per_unit, supplier:suppliers(name)')
    .single()
  if (error) throw error
  await logActivity(`Stock item added — ${data.name} (${unit})`, actorId, {
    type: 'ingredient_add',
    ingredient_id: data.id,
  })
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
