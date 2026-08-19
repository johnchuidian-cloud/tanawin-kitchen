import { supabase } from './supabase.js'
import { logActivity } from './activity.js'

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, category, location, contact')
    .order('name')
  if (error) throw error
  return data ?? []
}

// Suppliers are managed directly by the admin (not through the approval queue).
export async function updateSupplier(supplier, fields, actorId) {
  const patch = {
    name: fields.name.trim(),
    category: fields.category.trim() || null,
    location: fields.location.trim() || null,
    contact: fields.contact.trim() || null,
  }
  const { data, error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('id', supplier.id)
    .select()
    .single()
  if (error) throw error
  await logActivity(`Supplier updated — ${patch.name}`, actorId, {
    type: 'supplier_update',
    supplier_id: supplier.id,
  })
  return data
}

/**
 * Set which stock items come from this supplier.
 *
 * ONE SUPPLIER PER ITEM. That's Lexi's call for now ("an item usually has one
 * supplier... but it might change"), and it's what `ingredients.supplier_id`
 * already supports, so it needs no migration. The consequence to keep visible
 * in the UI: ticking an item that belongs to someone else MOVES it rather than
 * adding a second source.
 *
 * If it ever becomes many-per-item, this function and the picker that calls it
 * are the only two places that need to change — nothing else reads
 * `supplier_id` directly.
 */
export async function setSupplierItems(supplier, nextIds, actorId) {
  const { data: current, error: readErr } = await supabase
    .from('ingredients')
    .select('id')
    .eq('supplier_id', supplier.id)
  if (readErr) throw readErr

  const currentIds = new Set((current ?? []).map((r) => r.id))
  const next = new Set(nextIds)
  const added = [...next].filter((id) => !currentIds.has(id))
  const removed = [...currentIds].filter((id) => !next.has(id))

  // Assigning overwrites whatever was there — that's the "moved from another
  // supplier" case, which the picker warns about before you save.
  if (added.length) {
    const { error } = await supabase
      .from('ingredients')
      .update({ supplier_id: supplier.id })
      .in('id', added)
    if (error) throw error
  }
  if (removed.length) {
    const { error } = await supabase.from('ingredients').update({ supplier_id: null }).in('id', removed)
    if (error) throw error
  }

  if (added.length || removed.length) {
    await logActivity(
      `Supplier items updated — ${supplier.name}: ${added.length} added, ${removed.length} removed`,
      actorId,
      { type: 'supplier_items', supplier_id: supplier.id }
    )
  }
  return { added: added.length, removed: removed.length }
}

export async function addSupplier(fields, actorId) {
  const row = {
    name: fields.name.trim(),
    category: fields.category.trim() || null,
    location: fields.location.trim() || null,
    contact: fields.contact.trim() || null,
  }
  const { data, error } = await supabase.from('suppliers').insert(row).select().single()
  if (error) throw error
  await logActivity(`Supplier added — ${row.name}`, actorId, { type: 'supplier_add', supplier_id: data.id })
  return data
}
