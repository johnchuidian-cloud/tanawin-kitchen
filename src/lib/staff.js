import { supabase } from './supabase.js'
import { logActivity } from './activity.js'
import { fetchSettings, setSetting } from './settings.js'
import { sha256Hex } from './pin.js'

export const validPin = (pin) => /^\d{4}$/.test(pin)

// Rename and/or re-PIN a user. Only the PIN's SHA-256 digest is stored, and
// PIN values are never written to the audit log.
export async function updateUser(user, { name, pin }, actorId) {
  const patch = {}
  if (name && name.trim() && name.trim() !== user.name) patch.name = name.trim()
  if (pin) patch.pin = await sha256Hex(pin)
  if (Object.keys(patch).length === 0) return false
  const { error } = await supabase.from('kitchen_users').update(patch).eq('id', user.id)
  if (error) throw error
  const what = [patch.name ? 'name' : null, patch.pin ? 'PIN' : null].filter(Boolean).join(' & ')
  await logActivity(`Staff updated — ${patch.name ?? user.name} (${what} changed)`, actorId, {
    type: 'staff_update',
    user_id: user.id,
  })
  return true
}

export async function addUser({ name, role, pin }, actorId) {
  const { data, error } = await supabase
    .from('kitchen_users')
    .insert({ name: name.trim(), role, pin: await sha256Hex(pin) })
    .select()
    .single()
  if (error) throw error
  await logActivity(`Staff added — ${data.name} (${role})`, actorId, {
    type: 'staff_add',
    user_id: data.id,
  })
  return data
}

// ---------- Admin forgot-PIN failsafe (recovery code) ----------
// The plaintext code is shown ONCE at generation; only its SHA-256 hash is
// stored (in kitchen_settings under 'admin_recovery' — no new table needed).
// Using it resets the PIN and burns the code.

const normalizeCode = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

export async function generateRecoveryCode(userId) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I lookalikes
  const rnd = crypto.getRandomValues(new Uint8Array(12))
  let raw = ''
  for (let i = 0; i < 12; i++) raw += alphabet[rnd[i] % alphabet.length]
  const display = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
  const hash = await sha256Hex(raw)
  await setSetting('admin_recovery', { userId, hash })
  return display // caller must tell the user to write it down — not recoverable
}

export async function hasRecoveryCode(userId) {
  const settings = await fetchSettings()
  return settings?.admin_recovery?.userId === userId
}

// Validate the code and set a new PIN. One-time: the code is cleared on use.
export async function resetPinWithRecoveryCode(user, code, newPin) {
  const settings = await fetchSettings()
  const rec = settings?.admin_recovery
  if (!rec || rec.userId !== user.id) {
    return { ok: false, reason: 'No recovery code is set up for this account.' }
  }
  if (!validPin(newPin)) {
    return { ok: false, reason: 'The new PIN must be exactly 4 digits.' }
  }
  const hash = await sha256Hex(normalizeCode(code))
  if (hash !== rec.hash) {
    return { ok: false, reason: "Recovery code doesn't match. Check for typos." }
  }
  const { error } = await supabase
    .from('kitchen_users')
    .update({ pin: await sha256Hex(newPin) })
    .eq('id', user.id)
  if (error) return { ok: false, reason: error.message }
  await setSetting('admin_recovery', null) // burn: one-time use
  await logActivity(`PIN reset via recovery code — ${user.name}`, user.id, { type: 'pin_recovery' })
  return { ok: true }
}
