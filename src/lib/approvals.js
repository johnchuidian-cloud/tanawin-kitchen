import { supabase } from './supabase.js'
import { fetchAllRows } from './paginate.js'
import { logActivity } from './activity.js'
import { replaceRecipeIngredients } from './recipes.js'
import { applyPurchase } from './purchases.js'

const APPROVAL_COLS =
  'id, change_type, summary, payload, status, requested_at, resolved_at, ' +
  'requester:kitchen_users!approvals_requested_by_fkey(name), ' +
  'resolver:kitchen_users!approvals_resolved_by_fkey(name)'

/**
 * Approval requests: everything still pending, plus a few recently resolved.
 *
 * This used to read the WHOLE table on every visit. Resolved requests are
 * never deleted, so that grows forever — and each row carries a `payload`
 * holding the full before-and-after of a costing grid or ingredient list. The
 * screen only ever shows eight resolved rows, so the rest was fetched, parsed
 * and thrown away; past 1000 rows it would also have started silently dropping
 * history.
 *
 * Pending is paged rather than capped: an unnoticed backlog is exactly the
 * case where you must not lose rows.
 */
export async function fetchApprovals({ resolvedLimit = 8 } = {}) {
  const [pending, resolved] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from('approvals')
        .select(APPROVAL_COLS)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .order('id')
    ),
    supabase
      .from('approvals')
      .select(APPROVAL_COLS)
      .neq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(resolvedLimit),
  ])
  if (resolved.error) throw resolved.error
  return [...pending, ...(resolved.data ?? [])]
}

// Staff path: queue a recipe edit for Lexi to approve. Nothing changes yet.
export async function submitRecipeEdit(recipe, changes, before, summary, actorId) {
  const { error } = await supabase.from('approvals').insert({
    change_type: 'recipe_edit',
    summary,
    payload: { kind: 'recipe_update', recipeId: recipe.id, recipeName: recipe.name, changes, before },
    status: 'pending',
    requested_by: actorId,
  })
  if (error) throw error
  await logActivity(`Recipe edit requested — ${recipe.name}`, actorId, {
    type: 'recipe_edit_request',
    recipe_id: recipe.id,
  })
}

// Admin path: apply a recipe edit straight away.
export async function applyRecipeEditDirect(recipe, changes, actorId) {
  const { error } = await supabase.from('recipes').update(changes).eq('id', recipe.id)
  if (error) throw error
  await logActivity(`Recipe updated — ${recipe.name}`, actorId, {
    type: 'recipe_update',
    recipe_id: recipe.id,
    changes,
  })
}

// Staff path: queue an ingredient-list change for approval. `lines` is the full
// desired set [{ ingredient_id, quantity, unit }]; `before` is the current set.
export async function submitIngredientsEdit(recipe, lines, before, summary, actorId) {
  const { error } = await supabase.from('approvals').insert({
    change_type: 'recipe_ingredients',
    summary,
    payload: { kind: 'recipe_ingredients', recipeId: recipe.id, recipeName: recipe.name, lines, before },
    status: 'pending',
    requested_by: actorId,
  })
  if (error) throw error
  await logActivity(`Ingredient change requested — ${recipe.name}`, actorId, {
    type: 'recipe_ingredients_request',
    recipe_id: recipe.id,
  })
}

// Admin path: replace ingredient lines straight away.
export async function applyIngredientsDirect(recipe, lines, actorId) {
  await replaceRecipeIngredients(recipe.id, lines)
  await logActivity(`Ingredients updated — ${recipe.name}`, actorId, {
    type: 'recipe_ingredients_update',
    recipe_id: recipe.id,
  })
}

// Staff path: queue a costing-grid change (peso lines per tier) for approval.
export async function submitCostingEdit(recipe, costLines, before, summary, actorId) {
  const { error } = await supabase.from('approvals').insert({
    change_type: 'recipe_costing',
    summary,
    payload: { kind: 'recipe_costing', recipeId: recipe.id, recipeName: recipe.name, costLines, before },
    status: 'pending',
    requested_by: actorId,
  })
  if (error) throw error
  await logActivity(`Costing change requested — ${recipe.name}`, actorId, {
    type: 'recipe_costing_request',
    recipe_id: recipe.id,
  })
}

// Admin path: apply a costing-grid change straight away.
export async function applyCostingDirect(recipe, costLines, actorId) {
  const { error } = await supabase.from('recipes').update({ cost_lines: costLines }).eq('id', recipe.id)
  if (error) throw error
  await logActivity(`Costing updated — ${recipe.name}`, actorId, {
    type: 'recipe_costing_update',
    recipe_id: recipe.id,
  })
}

// Staff path: queue a purchase/restock for approval.
export async function submitPurchase(purchase, summary, actorId) {
  const { error } = await supabase.from('approvals').insert({
    change_type: 'purchase',
    summary,
    payload: { kind: 'purchase', ...purchase, recordedBy: actorId, source: purchase.source || 'manual' },
    status: 'pending',
    requested_by: actorId,
  })
  if (error) throw error
  await logActivity(`Purchase requested — ${purchase.ingredientName}`, actorId, {
    type: 'purchase_request',
  })
}

// Admin path: record a purchase straight away (updates stock + cost basis).
export async function applyPurchaseDirect(purchase, actorId) {
  await applyPurchase({ ...purchase, recordedBy: actorId, source: purchase.source || 'manual' })
  await logActivity(`Purchase recorded — ${purchase.ingredientName}`, actorId, {
    type: 'purchase',
  })
}

// Apply the change described by an approval's payload. Extend this switch as
// new change types are added.
async function applyApproval(approval) {
  const p = approval.payload
  if (p?.kind === 'recipe_update') {
    const { error } = await supabase.from('recipes').update(p.changes).eq('id', p.recipeId)
    if (error) throw error
    return
  }
  if (p?.kind === 'recipe_ingredients') {
    await replaceRecipeIngredients(p.recipeId, p.lines)
    return
  }
  if (p?.kind === 'purchase') {
    await applyPurchase(p)
    return
  }
  if (p?.kind === 'recipe_costing') {
    const { error } = await supabase
      .from('recipes')
      .update({ cost_lines: p.costLines })
      .eq('id', p.recipeId)
    if (error) throw error
    return
  }
  throw new Error('Unknown change type — cannot apply automatically.')
}

// Admin resolves a pending approval. On approve, the change is applied first;
// then the row is marked resolved and the decision is logged.
export async function resolveApproval(approval, decision, actorId) {
  if (decision === 'approved') await applyApproval(approval)
  const { error } = await supabase
    .from('approvals')
    .update({ status: decision, resolved_by: actorId, resolved_at: new Date().toISOString() })
    .eq('id', approval.id)
  if (error) throw error
  await logActivity(
    `${decision === 'approved' ? 'Approved' : 'Rejected'} — ${approval.summary}`,
    actorId,
    { type: `approval_${decision}`, approval_id: approval.id }
  )
}
