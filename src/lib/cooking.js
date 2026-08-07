import { supabase } from './supabase.js'
import { logActivity } from './activity.js'
import { recordMovement } from './movements.js'
import { convert } from './units.js'
import { fmtQty, shortUnit } from './inventory.js'

// ---------------------------------------------------------------------------
// COOKING A DISH → deducting its ingredients
//
// This is the "expected" half of the stock picture: logging a cooked dish
// takes its batch quantities out of stock, so the next physical count measures
// the GAP rather than the whole usage. Only recipes that actually carry
// ingredient quantities can do this — most don't yet, so the button simply
// doesn't appear for them rather than pretending to work.
// ---------------------------------------------------------------------------

export function cookableLines(recipe) {
  return (recipe?.lines ?? []).filter((l) => l.ingredient_id && Number(l.quantity) > 0)
}

export const canCook = (recipe) => cookableLines(recipe).length > 0

/**
 * Work out what cooking `batches` batches would take out, without touching
 * anything. A line whose recipe unit can't be converted to the stocking unit
 * (pieces → kg, say) is SKIPPED, never guessed: pack and piece sizes aren't
 * knowable from the data, and a wrong deduction is worse than none.
 */
export function planCook(recipe, batches) {
  const n = Number(batches)
  const deduct = []
  const skipped = []
  for (const l of cookableLines(recipe)) {
    const stockUnit = l.ingredient?.unit
    const recipeUnit = l.unit || stockUnit
    const amount = Number(l.quantity) * n
    const inStockUnit = convert(amount, recipeUnit, stockUnit)
    if (inStockUnit == null) {
      skipped.push({
        name: l.ingredient?.name ?? 'Unknown item',
        reason: `listed in ${recipeUnit}, stocked in ${stockUnit} — can't convert automatically`,
      })
      continue
    }
    deduct.push({
      ingredientId: l.ingredient_id,
      name: l.ingredient?.name ?? 'Unknown item',
      amount: inStockUnit,
      unit: stockUnit,
      onHand: l.ingredient?.quantity == null ? null : Number(l.ingredient.quantity),
    })
  }
  // Lines the books say there isn't enough of. Flagged before cooking, not
  // after: "it took 10 kg" when only 5 existed is a lie the cook can't act on.
  const short = deduct.filter((d) => d.onHand != null && d.amount > d.onHand)
  return { deduct, skipped, short }
}

/**
 * Log a cooked dish: deduct each convertible ingredient and record a 'use'
 * movement against the recipe.
 *
 * Quantities are re-read here rather than trusted from the loaded recipe —
 * on a shared kitchen phone the screen may have been open for a while.
 */
export async function cookDish(recipe, batches, actorId) {
  const { deduct, skipped } = planCook(recipe, batches)
  if (!deduct.length) {
    throw new Error('Nothing could be deducted — none of the ingredient units convert to stock units.')
  }

  const ids = deduct.map((d) => d.ingredientId)
  const { data: current, error } = await supabase
    .from('ingredients')
    .select('id, quantity')
    .in('id', ids)
  if (error) throw error
  const onHand = Object.fromEntries((current ?? []).map((r) => [r.id, Number(r.quantity)]))

  const applied = []
  const shortfalls = []
  for (const d of deduct) {
    const before = onHand[d.ingredientId] ?? 0
    // Floored at zero: on-hand can't go negative. When the recipe wanted more
    // than the books showed, that's flagged — it usually means a restock or a
    // count went unrecorded.
    const after = Math.max(0, Math.round((before - d.amount) * 10000) / 10000)
    // What actually left the shelf, which is not what was asked for when the
    // books ran out partway.
    const deducted = Math.round((before - after) * 10000) / 10000
    if (d.amount > before) shortfalls.push({ ...d, before })

    const upd = await supabase.from('ingredients').update({ quantity: after }).eq('id', d.ingredientId)
    if (upd.error) throw upd.error

    await recordMovement({
      ingredientId: d.ingredientId,
      kind: 'use',
      delta: -deducted,
      qtyAfter: after,
      actorId,
      recipeId: recipe.id,
      servings: Number(batches) * (recipe.pax_tier || 1),
    })
    applied.push({ ...d, after, deducted })
  }

  await logActivity(
    `Cooked — ${recipe.name} ×${batches} batch${Number(batches) === 1 ? '' : 'es'}, ` +
      `${applied.length} ingredient${applied.length === 1 ? '' : 's'} deducted`,
    actorId,
    { type: 'cooked', recipe_id: recipe.id, batches: Number(batches) }
  )

  return { applied, skipped, shortfalls }
}

// "Beef shank −1.5 kg, Onion −300 g" — the amount that actually came out of
// stock, which differs from the amount asked for when the books ran dry.
export function describeApplied(applied) {
  return applied
    .map((a) => `${a.name} −${fmtQty(a.deducted ?? a.amount)} ${shortUnit(a.unit)}`)
    .join(', ')
}
