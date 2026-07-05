import { supabase } from './supabase.js'
import { logActivity } from './activity.js'

// Round quantities to 4 dp to avoid floating-point artifacts (e.g. 7.4 - 6
// = 1.4000000000000004) creeping into stored stock levels.
const roundQty = (n) => Math.round(Number(n) * 10000) / 10000

// Recent restock entries with ingredient, supplier, and who recorded them.
// Includes the "before" snapshot + undone_at so admins can undo a restock.
export async function fetchPurchases(limit = 15) {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      'id, ingredient_id, quantity, total_cost, source, purchased_at, prev_quantity, prev_cost_per_unit, undone_at, ' +
        'ingredient:ingredients(name, unit), supplier:suppliers(name), recorder:kitchen_users(name)'
    )
    .order('purchased_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Core effect of a purchase: record it (with a snapshot of the ingredient's
// quantity + cost BEFORE the change, so it can be undone), add to stock, and
// set the ingredient's cost-per-unit to this purchase's unit price.
export async function applyPurchase(p) {
  const { data: ing, error: e1 } = await supabase
    .from('ingredients')
    .select('quantity, cost_per_unit')
    .eq('id', p.ingredientId)
    .single()
  if (e1) throw e1

  const qty = Number(p.quantity)
  const total = Number(p.totalCost)
  const newQty = roundQty(Number(ing.quantity) + qty)
  const unitCost = qty > 0 ? Math.round((total / qty) * 100) / 100 : 0

  const ins = await supabase.from('purchases').insert({
    ingredient_id: p.ingredientId,
    supplier_id: p.supplierId || null,
    quantity: qty,
    total_cost: total,
    source: p.source || 'manual',
    recorded_by: p.recordedBy || null,
    prev_quantity: ing.quantity,
    prev_cost_per_unit: ing.cost_per_unit,
  })
  if (ins.error) throw ins.error

  const upd = await supabase
    .from('ingredients')
    .update({ quantity: newQty, cost_per_unit: unitCost })
    .eq('id', p.ingredientId)
  if (upd.error) throw upd.error
}

// Reverse a restock: subtract the purchased quantity back out of stock and
// restore the cost-per-unit to what it was just before this purchase. Marks
// the purchase row as undone (kept for the audit trail, not deleted).
export async function undoPurchase(purchase, actorId) {
  const { data: ing, error: e1 } = await supabase
    .from('ingredients')
    .select('quantity')
    .eq('id', purchase.ingredient_id)
    .single()
  if (e1) throw e1

  const newQty = Math.max(0, roundQty(Number(ing.quantity) - Number(purchase.quantity)))
  const update = { quantity: newQty }
  if (purchase.prev_cost_per_unit != null) update.cost_per_unit = Number(purchase.prev_cost_per_unit)

  const upd = await supabase.from('ingredients').update(update).eq('id', purchase.ingredient_id)
  if (upd.error) throw upd.error

  const mark = await supabase
    .from('purchases')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', purchase.id)
  if (mark.error) throw mark.error

  await logActivity(`Restock undone — ${purchase.ingredient?.name ?? 'ingredient'}`, actorId, {
    type: 'purchase_undo',
    purchase_id: purchase.id,
  })
}
