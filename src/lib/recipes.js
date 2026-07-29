import { supabase } from './supabase.js'
import { logActivity } from './activity.js'

// Peso formatter: ₱195, ₱12.5 (trims trailing zeros).
export function peso(n) {
  return '₱' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------------------
// PRICING MODEL
// A recipe carries `tiers`: [{ label: "for 2", price: 479, cost: 140 }, ...].
// Prices are HAND-SET (they mirror the Tanawin Menu app — the authority on
// final prices and sizes); the app never computes a price. Costs come from
// either:
//   - `cost_lines`: Lexi's costing grid — [{ name: "Beef shank",
//     costs: [100, 320, 400] }] with one cost per tier (her sheet method), or
//   - `recipe_ingredients` quantity lines × inventory unit costs (crepes).
// Recalculate (manual only) sums whichever source exists into tiers[].cost.
// ---------------------------------------------------------------------------

// Fields the metadata editor can change (costs are recalc-derived; tier
// PRICES are edited there too via the special 'tiers' entry).
export const RECIPE_EDIT_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'pax_tier', label: 'Servings per batch', type: 'pax' },
  { key: 'is_available', label: 'Available', type: 'bool' },
  { key: 'prep_instructions', label: 'Notes' },
  { key: 'video_url', label: 'Video', type: 'url' },
  { key: 'image_url', label: 'Image', type: 'url' },
  { key: 'links', label: 'Links', type: 'list' },
  { key: 'tiers', label: 'Prices', type: 'tiers' },
]

function fmtFieldVal(field, v) {
  if (field?.type === 'bool') return v ? 'Yes' : 'No'
  if (field?.type === 'list') return `${Array.isArray(v) ? v.length : 0} link(s)`
  if (v === null || v === undefined || v === '') return '—'
  if (field?.type === 'url') {
    try {
      return new URL(String(v)).hostname
    } catch {
      return String(v).slice(0, 30)
    }
  }
  return String(v)
}

// Extract the YouTube video id from any common URL form (watch, youtu.be,
// shorts, embed). Returns null for non-YouTube URLs.
export function youTubeId(url) {
  const m = (url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  )
  return m ? m[1] : null
}

// "Price (for 6): ₱999 → ₱1,099" — tier arrays diff by label on price.
function describeTierChanges(before, after) {
  const b = new Map((before ?? []).map((t) => [t.label, t]))
  const parts = []
  for (const t of after ?? []) {
    const prev = b.get(t.label)
    const oldP = prev?.price
    const newP = t.price
    if ((oldP ?? null) !== (newP ?? null)) {
      parts.push(
        `Price (${t.label}): ${oldP == null ? '—' : peso(oldP)} → ${newP == null ? '—' : peso(newP)}`
      )
    }
  }
  return parts.join('; ')
}

// "Servings per batch: 6 → 9; Available: Yes → No; Price (for 2): ₱479 → ₱499"
export function describeRecipeChanges(changes, before) {
  return Object.keys(changes)
    .map((k) => {
      if (k === 'tiers') return describeTierChanges(before[k], changes[k])
      const f = RECIPE_EDIT_FIELDS.find((x) => x.key === k)
      return `${f?.label ?? k}: ${fmtFieldVal(f, before[k])} → ${fmtFieldVal(f, changes[k])}`
    })
    .filter(Boolean)
    .join('; ')
}

// "₱479–1,699", "₱299", or "—" (no prices set yet).
export function priceRange(tiers) {
  const prices = (tiers ?? []).map((t) => t.price).filter((p) => p != null)
  if (!prices.length) return '—'
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return lo === hi ? peso(lo) : `${peso(lo)}–${Number(hi).toLocaleString()}`
}

export async function fetchRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, category, pax_tier, tiers, is_available')
    .order('category')
    .order('name')
  if (error) throw error
  return data ?? []
}

// One recipe plus its costing sources: the peso costing grid (cost_lines)
// and/or quantity lines (with current inventory unit costs).
export async function fetchRecipe(id) {
  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, name, category, pax_tier, tiers, cost_lines, prep_instructions, is_available, ' +
        'video_url, image_url, links, ' +
        'lines:recipe_ingredients(id, ingredient_id, quantity, unit, ingredient:ingredients(name, unit, cost_per_unit))'
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// Per-line cost = batch quantity × the ingredient's current cost_per_unit.
export function lineCost(line) {
  return Number(line.quantity) * Number(line.ingredient?.cost_per_unit ?? 0)
}

// Quantity-based batch total and cost per serving (÷ servings per batch).
export function computeCost(recipe, lines) {
  const batchTotal = lines.reduce((sum, l) => sum + lineCost(l), 0)
  const pax = recipe.pax_tier || 1
  return { batchTotal, costPerServing: batchTotal / pax }
}

// Same, from raw editor lines — used by the ingredient editor's live preview.
export function costFromLines(lines, ingredientsById, paxTier) {
  const batchTotal = lines.reduce(
    (s, l) => s + Number(l.quantity || 0) * Number(ingredientsById[l.ingredient_id]?.cost_per_unit ?? 0),
    0
  )
  return { batchTotal, costPerServing: batchTotal / (paxTier || 1) }
}

const round2 = (n) => Math.round(Number(n) * 100) / 100

// Sum of a costing-grid column (one tier).
export function tierColumnSum(costLines, tierIndex) {
  return round2((costLines ?? []).reduce((s, l) => s + Number(l.costs?.[tierIndex] ?? 0), 0))
}

// What Recalculate WOULD set each tier's cost to, from whichever costing
// source the recipe has. Returns null when there's nothing to compute from.
export function computedTierCosts(recipe) {
  const tiers = recipe.tiers ?? []
  if (recipe.cost_lines?.length) {
    return tiers.map((_, i) => tierColumnSum(recipe.cost_lines, i))
  }
  if (recipe.lines?.length) {
    const { costPerServing } = computeCost(recipe, recipe.lines)
    return tiers.length ? tiers.map(() => round2(costPerServing)) : [round2(costPerServing)]
  }
  return null
}

// Any tier whose stored cost differs from what Recalculate would produce?
export function costsStale(recipe) {
  const computed = computedTierCosts(recipe)
  if (!computed) return false
  const tiers = recipe.tiers ?? []
  if (!tiers.length) return true // computable but no tiers stored yet
  return tiers.some((t, i) => round2(t.cost ?? 0) !== computed[i])
}

// Replace a recipe's ingredient lines with a fresh set (delete then insert).
// Not transactional over REST — acceptable for this prototype's small edits.
export async function replaceRecipeIngredients(recipeId, lines) {
  const del = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
  if (del.error) throw del.error
  if (lines.length) {
    const rows = lines.map((l) => ({
      recipe_id: recipeId,
      ingredient_id: l.ingredient_id,
      quantity: l.quantity,
      unit: l.unit,
    }))
    const ins = await supabase.from('recipe_ingredients').insert(rows)
    if (ins.error) throw ins.error
  }
}

// MANUAL recalculation — only runs when invoked (never automatic). Writes the
// computed cost into each tier; prices are untouched (always hand-set).
export async function recalcRecipe(recipe, actorId) {
  const computed = computedTierCosts(recipe)
  if (!computed) throw new Error('Nothing to calculate from — add costing first.')
  const baseTiers = recipe.tiers?.length ? recipe.tiers : [{ label: 'each', price: null }]
  const tiers = baseTiers.map((t, i) => ({ ...t, cost: computed[i] ?? t.cost ?? null }))
  const { error } = await supabase.from('recipes').update({ tiers }).eq('id', recipe.id)
  if (error) throw error
  await logActivity(
    `Recalculated costs — ${recipe.name}: ${tiers
      .map((t) => `${t.label} ${t.cost == null ? '—' : peso(t.cost)}`)
      .join(', ')}`,
    actorId,
    { type: 'recipe_recalc', recipe_id: recipe.id }
  )
  return tiers
}
