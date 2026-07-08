// PIN hashing (mirrors Tanawin Finance): kitchen_users.pin stores the
// SHA-256 hex digest of the 4-digit PIN, never the plaintext. Login compares
// digests. Rows not yet migrated (legacy plaintext) still verify, so the
// rollout needs no downtime.
//
// Honest caveat (same as Finance): a 4-digit space is trivially brute-forced
// offline — hashing stops casual reading of the table, not a determined
// attacker. The real fix is Supabase Auth + RLS, planned as joint work with
// Finance since the project is shared.

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const isHashedPin = (v) => /^[0-9a-f]{64}$/i.test((v || '').trim())

export async function verifyPin(entered, stored) {
  if (!entered || !stored) return false
  if (isHashedPin(stored)) {
    return (await sha256Hex(entered)) === stored.trim().toLowerCase()
  }
  return stored === entered // legacy plaintext row (pre-migration)
}
