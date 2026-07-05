import { supabase } from './supabase.js'

// App-wide settings live in a shared key/value table so a change Lexi makes
// applies to everyone. Reads are non-fatal: if the table is missing or a call
// fails, we fall back to defaults (safest = staff need approval).
export async function fetchSettings() {
  const { data, error } = await supabase.from('kitchen_settings').select('key, value')
  if (error) {
    console.warn('kitchen_settings read failed (using defaults):', error.message)
    return {}
  }
  const map = {}
  for (const row of data ?? []) map[row.key] = row.value
  return map
}

export async function setSetting(key, value) {
  const { error } = await supabase
    .from('kitchen_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}

export const SETTING_STAFF_DIRECT_RESTOCK = 'staff_direct_restock'

// Should a restock by this user apply immediately (vs. go to the approval
// queue)? Admin always direct; staff only when Lexi has allowed it; guests
// never (they can't restock at all).
export function canRestockDirectly(role, settings) {
  if (role === 'admin') return true
  if (role === 'staff') return settings?.[SETTING_STAFF_DIRECT_RESTOCK] === true
  return false
}
