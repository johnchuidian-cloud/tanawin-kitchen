import { supabase } from './supabase.js'
import { fetchIngredients, stockLevel } from './inventory.js'

// Home dashboard counts: low stock, out of stock, pending approvals. Low and
// out are counted the same way as the Inventory row colours (yellow / light
// red), so the two screens agree — an empty item is "out", not also "low".
export async function fetchHomeStats() {
  const [ings, pending] = await Promise.all([
    fetchIngredients(),
    supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  return {
    lowStock: ings.filter((i) => stockLevel(i) === 'low').length,
    outOfStock: ings.filter((i) => stockLevel(i) === 'out').length,
    pending: pending.count ?? 0,
  }
}
