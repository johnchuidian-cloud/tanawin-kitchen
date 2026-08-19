import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchSuppliers, addSupplier, updateSupplier, setSupplierItems } from '../lib/suppliers.js'
import { fetchIngredients, shortUnit } from '../lib/inventory.js'

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
  const [stock, setStock] = useState([]) // every active stock item
  const [pickingId, setPickingId] = useState(null) // supplier whose items are open
  const [picked, setPicked] = useState(new Set())
  const [pickSearch, setPickSearch] = useState('')

  useEffect(() => {
    let active = true
    fetchSuppliers()
      .then((d) => active && setItems(d))
      .catch((e) => active && setError(e.message || 'Could not load suppliers.'))
    fetchIngredients()
      .then((d) => active && setStock(d))
      .catch(() => {})
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
  const countFor = (s) => stock.filter((i) => i.supplier_id === s.id).length
  const supplierName = (id) => items?.find((s) => s.id === id)?.name ?? 'another supplier'

  const startPicking = (s) => {
    setPickingId(s.id)
    setEditingId(null)
    setAdding(false)
    setPickSearch('')
    setPicked(new Set(stock.filter((i) => i.supplier_id === s.id).map((i) => i.id)))
    setError('')
    setSuccess('')
  }

  const togglePick = (id) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const savePicks = async (supplier) => {
    setSaving(true)
    setError('')
    try {
      const res = await setSupplierItems(supplier, [...picked], currentUser.id)
      setStock(await fetchIngredients())
      setSuccess(
        res.added || res.removed
          ? `Saved — ${supplier.name}: ${res.added} added, ${res.removed} removed.`
          : `No changes for ${supplier.name}.`
      )
      setPickingId(null)
    } catch (err) {
      setError(err.message || 'Could not save the item list. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // Items that would be taken off another supplier by saving — worth naming
  // before the fact, since one item can only have one supplier.
  const moving = (supplier) =>
    stock.filter((i) => picked.has(i.id) && i.supplier_id && i.supplier_id !== supplier.id)

  const pickQuery = pickSearch.trim().toLowerCase()
  const pickList = stock.filter(
    (i) =>
      !pickQuery ||
      i.name.toLowerCase().includes(pickQuery) ||
      (i.aliases ?? []).some((a) => a.toLowerCase().includes(pickQuery))
  )

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
                    {editingId !== s.id && pickingId !== s.id ? (
                      <div className="qty" style={{ fontSize: 12 }}>
                        {countFor(s)}
                        <small>items</small>
                      </div>
                    ) : null}
                    {isAdmin && editingId !== s.id && pickingId !== s.id ? (
                      <button className="mini-btn" onClick={() => startPicking(s)}>
                        Items
                      </button>
                    ) : null}
                    {isAdmin && editingId !== s.id && pickingId !== s.id ? (
                      <button className="mini-btn" onClick={() => startEdit(s)}>
                        Edit
                      </button>
                    ) : null}
                  </div>

                  {pickingId === s.id ? (
                    <div className="edit-panel">
                      <div className="muted" style={{ marginBottom: 8 }}>
                        Tick everything you buy from {s.name}. {picked.size} selected.
                      </div>
                      <div className="field">
                        <input
                          type="search"
                          value={pickSearch}
                          onChange={(e) => setPickSearch(e.target.value)}
                          placeholder="Search items…"
                          aria-label="Search stock items"
                        />
                      </div>

                      <div className="item-pick">
                        {pickList.length === 0 ? (
                          <div className="muted" style={{ padding: '6px 2px' }}>
                            Nothing matches “{pickSearch.trim()}”.
                          </div>
                        ) : (
                          pickList.map((i) => {
                            const elsewhere = i.supplier_id && i.supplier_id !== s.id
                            return (
                              <label key={i.id} className="pick-row">
                                <input
                                  type="checkbox"
                                  checked={picked.has(i.id)}
                                  onChange={() => togglePick(i.id)}
                                />
                                <span className="pick-name">
                                  {i.name} <span className="pick-unit">{shortUnit(i.unit)}</span>
                                  {/* One supplier per item, so ticking this MOVES it.
                                      Said out loud rather than discovered later. */}
                                  {elsewhere ? (
                                    <span className="pick-note">now: {supplierName(i.supplier_id)}</span>
                                  ) : null}
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>

                      {moving(s).length ? (
                        <div className="note" style={{ marginTop: 8 }}>
                          ⚠️ {moving(s).length === 1 ? 'This item moves' : 'These items move'} to {s.name}:{' '}
                          {moving(s).map((i) => `${i.name} (from ${supplierName(i.supplier_id)})`).join(', ')}
                          . An item can only have one supplier at a time.
                        </div>
                      ) : null}

                      <div className="appr-actions">
                        <button className="btn green" type="button" disabled={saving} onClick={() => savePicks(s)}>
                          {saving ? 'Saving…' : 'Save items'}
                        </button>
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={saving}
                          onClick={() => setPickingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
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
