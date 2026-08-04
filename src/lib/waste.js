import { supabase } from './supabase.js'
import { logActivity } from './activity.js'
import { recordMovement } from './movements.js'
import { fmtQty, shortUnit } from './inventory.js'

export const WASTE_REASONS = ['Spoilage', 'Prep error', 'Expired', 'Over-portioned']

// Recent waste entries, with the ingredient and who logged it.
export async function fetchWaste(limit = 30) {
  const { data, error } = await supabase
    .from('waste_log')
    .select('id, quantity, reason, logged_at, ingredient:ingredients(name, unit), logger:kitchen_users(name)')
    .order('logged_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Record spoilage/loss. Writes directly (staff allowed, no approval) and adds
// an audit entry. Does NOT change on-hand stock — that's set via Count Stock.
export async function logWaste(ingredient, quantity, reason, actorId) {
  const { error } = await supabase.from('waste_log').insert({
    ingredient_id: ingredient.id,
    quantity,
    reason,
    logged_by: actorId,
  })
  if (error) throw error
  await logActivity(
    `Waste logged — ${ingredient.name} ${fmtQty(quantity)} ${shortUnit(ingredient.unit)}`,
    actorId,
    { type: 'waste', ingredient_id: ingredient.id, quantity, reason }
  )
  // qty_after is the UNCHANGED on-hand figure — logging waste doesn't move
  // stock (that's long-standing behaviour; the next count absorbs it). The
  // row is here so a later count's shortfall can be explained rather than
  // looking like a mystery.
  await recordMovement({
    ingredientId: ingredient.id,
    kind: 'waste',
    delta: -Math.abs(Number(quantity)),
    qtyAfter: ingredient.quantity,
    actorId,
    note: reason,
  })
}
