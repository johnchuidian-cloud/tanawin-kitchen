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
