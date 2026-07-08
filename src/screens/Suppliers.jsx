import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchSuppliers, addSupplier, updateSupplier } from '../lib/suppliers.js'

const BLANK = { name: '', category: '', location: '', contact: '' }

export default function Suppliers() {
  const { role, currentUser } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    fetchSuppliers()
      .then((d) => active && setItems(d))
      .catch((e) => active && setError(e.message || 'Could not load suppliers.'))
    return () => {
      active = false
    }
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isAdmin = role === 'admin'

  const startAdd = () => {
    setAdding(true)
    setEditingId(null)
    setForm(BLANK)
    setError('')
    setSuccess('')
  }

  const startEdit = (s) => {
    setEditingId(s.id)
    setAdding(false)
    setForm({
      name: s.name ?? '',
      category: s.category ?? '',
      location: s.location ?? '',
      contact: s.contact ?? '',
    })
    setError('')
    setSuccess('')
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setForm(BLANK)
    setError('')
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim()) {
      setError('A supplier name is required.')
      return
    }
    setSaving(true)
    try {
      const created = await addSupplier(form, currentUser.id)
      setItems((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)))
      setSuccess(`Added ${created.name}.`)
      cancel()
    } catch (err) {
      setError(err.message || 'Could not add the supplier. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e, supplier) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim()) {
      setError('A supplier name is required.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateSupplier(supplier, form, currentUser.id)
      setItems((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name))
      )
      setSuccess(`Saved — ${updated.name} updated.`)
      cancel()
    } catch (err) {
      setError(err.message || 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const subtitle = (s) => [s.category, s.location].filter(Boolean).join(' · ')

  const Fields = (
    <>
      <div className="field">
        <label>Name</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="field">
        <label>Category</label>
        <input
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
          placeholder="e.g. Seafood, produce"
        />
      </div>
      <div className="field">
        <label>Location</label>
        <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Balanga" />
      </div>
      <div className="field">
        <label>Contact (optional)</label>
        <input value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="phone / name" />
      </div>
    </>
  )

  return (
    <>
      <h2 className="title">Suppliers</h2>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}
      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items ? (
        <>
          <div className="muted">
            {items.length} {items.length === 1 ? 'vendor' : 'vendors'}
          </div>

          {items.length === 0 ? (
            <div className="placeholder">No suppliers yet.</div>
          ) : (
            <div className="card" style={{ marginTop: 14 }}>
              {items.map((s) => (
                <div key={s.id}>
                  <div className="row">
                    <div className="info">
                      <div className="n">{s.name}</div>
                      <div className="m">{subtitle(s) || '—'}</div>
                    </div>
                    {s.contact && editingId !== s.id ? (
                      <div className="qty" style={{ fontSize: 12 }}>{s.contact}</div>
                    ) : null}
                    {isAdmin && editingId !== s.id ? (
                      <button className="mini-btn" onClick={() => startEdit(s)}>
                        Edit
                      </button>
                    ) : null}
                  </div>
                  {editingId === s.id ? (
                    <form className="edit-panel" onSubmit={(e) => handleUpdate(e, s)}>
                      {Fields}
                      <div className="appr-actions">
                        <button className="btn green" type="submit" disabled={saving}>
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn ghost" type="button" disabled={saving} onClick={cancel}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {isAdmin ? (
            adding ? (
              <form className="card" onSubmit={handleAdd}>
                {Fields}
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save supplier'}
                </button>
                <button type="button" className="btn ghost" onClick={cancel}>
                  Cancel
                </button>
              </form>
            ) : (
              <button className="btn" onClick={startAdd}>
                + Add supplier
              </button>
            )
          ) : null}
        </>
      ) : null}
    </>
  )
}
