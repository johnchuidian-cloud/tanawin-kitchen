import { supabase } from './supabase.js'
import { logActivity } from './activity.js'

// Peso formatter: ₱195, ₱12.5 (trims trailing zeros).
export function peso(n) {
  return '₱' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// Fields an editor can change on a recipe (cost/serving + menu price are
// derived via Recalculate, so they're intentionally not here).
export const RECIPE_EDIT_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'pax_tier', label: 'Pax tier', type: 'pax' },
  { key: 'is_available', label: 'Available', type: 'bool' },
  { key: 'prep_instructions', label: 'Notes' },
  { key: 'video_url', label: 'Video', type: 'url' },
  { key: 'image_url', label: 'Image', type: 'url' },
  { key: 'links', label: 'Links', type: 'list' },
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

// "Pax tier: 6 → 9; Available: Yes → No"
export function describeRecipeChanges(changes, before) {
  return Object.keys(changes)
    .map((k) => {
      const f = RECIPE_EDIT_FIELDS.find((x) => x.key === k)
      return `${f?.label ?? k}: ${fmtFieldVal(f, before[k])} → ${fmtFieldVal(f, changes[k])}`
    })
    .join('; ')
}

export async function fetchRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, category, pax_tier, cost_per_serving, menu_price, is_available')
    .order('category')
    .order('name')
  if (error) throw error
  return data ?? []
}

// One recipe plus its fixed-batch ingredient lines (with each ingredient's
// current cost_per_unit, which is what the cost breakdown/recalc uses).
export async function fetchRecipe(id) {
  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, name, category, pax_tier, cost_per_serving, menu_price, prep_instructions, is_available, ' +
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

// Batch total, cost/serving (÷ pax tier), and menu price (cost ×3, rounded UP).
export function computeCost(recipe, lines) {
  const batchTotal = lines.reduce((sum, l) => sum + lineCost(l), 0)
  const pax = recipe.pax_tier || 1
  const costPerServing = batchTotal / pax
  const menuPrice = Math.ceil(costPerServing * 3)
  return { batchTotal, costPerServing, menuPrice }
}

// Cost from raw editor lines ({ ingredient_id, quantity }), pricing each via a
// lookup of ingredient id → { cost_per_unit }. Used for the live edit preview.
export function costFromLines(lines, ingredientsById, paxTier) {
  const batchTotal = lines.reduce(
    (s, l) => s + Number(l.quantity || 0) * Number(ingredientsById[l.ingredient_id]?.cost_per_unit ?? 0),
    0
  )
  const pax = paxTier || 1
  const costPerServing = batchTotal / pax
  return { batchTotal, costPerServing, menuPrice: Math.ceil(costPerServing * 3) }
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

// MANUAL recalculation — only runs when invoked (never automatic). Recomputes
// from current ingredient costs and writes the new figures to the recipe row.
export async function recalcRecipe(recipe, lines, actorId) {
  const { costPerServing, menuPrice } = computeCost(recipe, lines)
  const roundedCost = Math.round(costPerServing * 100) / 100
  const { error } = await supabase
    .from('recipes')
    .update({ cost_per_serving: roundedCost, menu_price: menuPrice })
    .eq('id', recipe.id)
  if (error) throw error
  await logActivity(
    `Recalculated cost — ${recipe.name}: ${peso(roundedCost)}/serving`,
    actorId,
    { type: 'recipe_recalc', recipe_id: recipe.id, cost_per_serving: roundedCost, menu_price: menuPrice }
  )
  return { costPerServing: roundedCost, menuPrice }
}
