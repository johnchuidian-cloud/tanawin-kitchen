import { supabase } from './supabase.js'
import { logActivity } from './activity.js'
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
}
