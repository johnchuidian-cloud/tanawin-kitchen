import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchIngredients, shortUnit, fmtQty } from '../lib/inventory.js'
import { fetchSuppliers } from '../lib/suppliers.js'
import { fetchPurchases, undoPurchase } from '../lib/purchases.js'
import { peso } from '../lib/recipes.js'
import { submitPurchase, applyPurchaseDirect } from '../lib/approvals.js'
import { fetchSettings, canRestockDirectly } from '../lib/settings.js'
import FinanceImport from '../components/FinanceImport.jsx'

const FINANCE_KEY = 'tanawin-kitchen.financePull'

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' })
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Purchases() {
  const { role, currentUser } = useAuth()
  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [recent, setRecent] = useState(null)
  const [settings, setSettings] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [undoingId, setUndoingId] = useState(null)
  const [financeOn, setFinanceOn] = useState(() => localStorage.getItem(FINANCE_KEY) === '1')

  const [ingredientId, setIngredientId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [totalCost, setTotalCost] = useState('')

  const loadRecent = () => fetchPurchases().then(setRecent).catch(() => {})

  useEffect(() => {
    let active = true
    Promise.all([fetchIngredients(), fetchSuppliers(), fetchPurchases(), fetchSettings()])
      .then(([ings, sups, purchases, sets]) => {
        if (!active) return
        setIngredients(ings)
        setSuppliers(sups)
        setRecent(purchases)
        setSettings(sets)
        if (ings.length) setIngredientId(ings[0].id)
        setLoaded(true)
      })
      .catch((e) => active && setError(e.message || 'Could not load this screen.'))
    return () => {
      active = false
    }
  }, [])

  const selected = ingredients.find((i) => i.id === ingredientId) ?? null
  const direct = canRestockDirectly(role, settings) // apply now vs. queue for approval
  const isAdmin = role === 'admin'

  const handleUndo = async (purchase) => {
    setError('')
    setUndoingId(purchase.id)
    try {
      await undoPurchase(purchase, currentUser.id)
      await loadRecent()
    } catch (err) {
      setError(err.message || 'Could not undo. Try again.')
    } finally {
      setUndoingId(null)
    }
  }
  const unitCost = useMemo(() => {
    const q = Number(quantity)
    const t = Number(totalCost)
    return q > 0 && t >= 0 ? t / q : null
  }, [quantity, totalCost])

  const toggleFinance = () => {
    setFinanceOn((on) => {
      const next = !on
      localStorage.setItem(FINANCE_KEY, next ? '1' : '0')
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const q = Number(quantity)
    const t = Number(totalCost)
    if (!selected) return
    if (quantity === '' || Number.isNaN(q) || q <= 0) {
      setError('Enter a quantity greater than 0.')
      return
    }
    if (totalCost === '' || Number.isNaN(t) || t < 0) {
      setError('Enter the total cost (0 or more).')
      return
    }
    const supplier = suppliers.find((s) => s.id === supplierId)
    const purchase = {
      ingredientId: selected.id,
      supplierId: supplierId || null,
      quantity: q,
      totalCost: t,
      ingredientName: selected.name,
      supplierName: supplier?.name ?? null,
      unit: selected.unit,
    }
    const summary =
      `Restock — ${selected.name} +${fmtQty(q)} ${shortUnit(selected.unit)} for ${peso(t)}` +
      (supplier ? ` from ${supplier.name}` : '') +
      `. Updates stock & sets cost to ${peso(t / q)}/${shortUnit(selected.unit)}`

    setSaving(true)
    try {
      if (direct) {
        await applyPurchaseDirect(purchase, currentUser.id)
        setSuccess(`Recorded — ${selected.name} restocked. Stock and cost updated.`)
        await loadRecent()
      } else {
        await submitPurchase(purchase, summary, currentUser.id)
        setSuccess('Sent to Lexi for approval ⏳')
      }
      setQuantity('')
      setTotalCost('')
    } catch (err) {
      setError(err.message || 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const RecentList = () =>
    recent && recent.length > 0 ? (
      <>
        <div className="section-label" style={{ marginTop: 18 }}>Recent restocks</div>
        <div className="card">
          {recent.map((p) => (
            <div className="row" key={p.id} style={p.undone_at ? { opacity: 0.55 } : undefined}>
              <div className="info">
                <div className="n">
                  {p.ingredient?.name ?? 'Unknown'} · {fmtQty(p.quantity)} {shortUnit(p.ingredient?.unit ?? '')}
                </div>
                <div className="m">
                  {p.supplier?.name ? `${p.supplier.name} · ` : ''}
                  {p.recorder?.name ? `by ${p.recorder.name} · ` : ''}
                  {timeAgo(p.purchased_at)}
                  {p.source === 'finance_pull' ? ' · from Finance' : ''}
                </div>
              </div>
              <div className="row-action">
                <div className="qty" style={p.undone_at ? { textDecoration: 'line-through' } : undefined}>
                  {peso(p.total_cost)}
                </div>
                {p.undone_at ? (
                  <span className="undone-tag">Undone</span>
                ) : isAdmin ? (
                  <button
                    className="mini-btn"
                    onClick={() => handleUndo(p)}
                    disabled={undoingId === p.id}
                  >
                    {undoingId === p.id ? '…' : 'Undo'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </>
    ) : null

  return (
    <>
      <h2 className="title">Purchases &amp; Restock</h2>
      <div className="muted">Log what you bought — it updates stock and cost on {direct ? 'save' : 'approval'}.</div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {success ? <div className="success" style={{ marginTop: 12 }}>{success}</div> : null}
      {!loaded && !error ? <div className="muted">Loading…</div> : null}

      {loaded ? (
        <>
          {/* Finance-pull toggle (import wiring comes later) */}
          {role !== 'guest' ? (
            <>
              <div className="toggle-row" style={{ marginTop: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Pull from Tanawin Finance</div>
                  <div className="muted" style={{ fontSize: 11 }}>Import purchases already recorded there</div>
                </div>
                <button
                  type="button"
                  className={`switch ${financeOn ? 'on' : ''}`}
                  onClick={toggleFinance}
                  aria-label="Toggle Finance pull"
                />
              </div>
              {financeOn ? (
                <FinanceImport
                  ingredients={ingredients}
                  direct={direct}
                  currentUser={currentUser}
                  onChange={loadRecent}
                />
              ) : null}
            </>
          ) : null}

          {role === 'guest' ? (
            <div className="guest-banner">👁️ Guest view — you can look, but not record purchases.</div>
          ) : ingredients.length === 0 ? (
            <div className="placeholder">No ingredients to restock yet.</div>
          ) : (
            <form className="card" onSubmit={handleSubmit}>
              <div className="field">
                <label>Ingredient</label>
                <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Supplier</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">— none —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantity{selected ? ` (${shortUnit(selected.unit)})` : ''}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="field">
                <label>Total cost (₱)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="e.g. 1300"
                />
              </div>
              {unitCost !== null ? (
                <div className="note" style={{ marginTop: 0, marginBottom: 6 }}>
                  Works out to <b>{peso(unitCost)}/{shortUnit(selected.unit)}</b> — this becomes the
                  ingredient's cost basis.
                </div>
              ) : null}
              <button className="btn" type="submit" disabled={saving}>
                {saving ? 'Saving…' : direct ? 'Save purchase' : 'Send for approval'}
              </button>
              <div className="note">
                {direct
                  ? 'Recording a purchase updates stock and the cost record immediately.'
                  : 'Restock entries affect cost records, so they route to Lexi for approval.'}
              </div>
            </form>
          )}

          <RecentList />
        </>
      ) : null}
    </>
  )
}
