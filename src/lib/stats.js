import { supabase } from './supabase.js'
import { fetchIngredients, stockStatus } from './inventory.js'

// Home dashboard counts: low stock, pending approvals, waste this week.
export async function fetchHomeStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [ings, pending, waste] = await Promise.all([
    fetchIngredients(),
    supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('waste_log').select('id', { count: 'exact', head: true }).gte('logged_at', weekAgo),
  ])
  return {
    lowStock: ings.filter((i) => stockStatus(i) === 'low').length,
    pending: pending.count ?? 0,
    wasteWeek: waste.count ?? 0,
  }
}
