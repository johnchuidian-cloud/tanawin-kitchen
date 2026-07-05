import { supabase } from './supabase.js'

// Append an entry to the audit trail. Non-fatal: if the log write fails we
// don't want it to roll back the action the user actually performed, so we
// just report it to the console.
export async function logActivity(action, actorId, detail = null) {
  const { error } = await supabase
    .from('activity_log')
    .insert({ action, actor: actorId, detail })
  if (error) console.error('activity_log insert failed:', error)
}

// Recent audit entries, newest first, with the actor's name.
export async function fetchActivity(limit = 50) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, detail, created_at, actor:kitchen_users(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
