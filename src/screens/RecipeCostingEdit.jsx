import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchRecipe, peso, tierColumnSum } from '../lib/recipes.js'
import { submitCostingEdit, applyCostingDirect } from '../lib/approvals.js'

// Editor for Lexi's costing grid: ingredient rows × tier columns, in pesos —
// the same method as her costing sheet (Gas and other overheads are lines
// too). Costs shown on the recipe only change when Recalculate is tapped.
export default function RecipeCostingEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [lines, setLines] = useState(null) // [{ name, costs: [str per tier] }]
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetchRecipe(id)
      .then((r) => {
        if (!active) return
        setRecipe(r)
        setLines(
          (r.cost_lines ?? []).map((l) => ({
            name: l.name,
            costs: (r.tiers ?? [{}]).map((_, i) => String(l.costs?.[i] ?? '')),
          }))
        )
      })
      .catch((e) => active && setError(e.message || 'Could not load the recipe.'))
    return () => {
      active = false
    }
  }, [id])

  const tiers = recipe?.tiers?.length ? recipe.tiers : [{ label: 'each' }]

  const setName = (idx, v) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, name: v } : l)))
  const setCost = (idx, ti, v) =>
    setLines((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, costs: l.costs.map((c, j) => (j === ti ? v : c)) } : l))
    )
  const addLine = () => setLines((ls) => [...ls, { name: '', costs: tiers.map(() => '') }])
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx))

  const parsed = (lines ?? []).map((l) => ({
    name: l.name.trim(),
    costs: l.costs.map((c) => (c === '' ? 0 : Number(c))),
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    for (const l of parsed) {
      if (!l.name) {
        setError('Every line needs a name (or remove the empty line).')
        return
      }
      if (l.costs.some((c) => Number.isNaN(c) || c < 0)) {
        setError(`Check the amounts on "${l.name}" — numbers only, 0 or more.`)
        return
      }
    }
    const before = recipe.cost_lines ?? []
    if (JSON.stringify(before) === JSON.stringify(parsed)) {
      setError('No costing changes to save.')
      return
    }
    const summary = `Edit costing — ${recipe.name}: ${parsed.length} ${parsed.length === 1 ? 'line' : 'lines'} (${tiers
      .map((t, i) => `${t.label} ${peso(parsed.reduce((s, l) => s + l.costs[i], 0))}`)
      .join(', ')})`
    setBusy(true)
    try {
      if (role === 'admin') {
        await applyCostingDirect(recipe, parsed, currentUser.id)
        setDone('Saved — costing updated. Tap Recalculate on the recipe to commit the new tier costs.')
      } else {
        await submitCostingEdit(recipe, parsed, before, summary, currentUser.id)
        setDone('Sent to Lexi for approval ⏳')
      }
    } catch (err) {
      setError(err.message || 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (role === 'guest') {
    return (
      <>
        <h2 className="title">Edit costing</h2>
        <div className="guest-banner">👁️ Guest view — editing isn't available.</div>
      </>
    )
  }

  if (error && !recipe) {
    return (
      <>
        <button className="link-btn" onClick={() => navigate(`/recipes/${id}`)}>← Back</button>
        <div className="error">{error}</div>
      </>
    )
  }

  if (!recipe || !lines) {
    return (
      <>
        <button className="link-btn" onClick={() => navigate('/recipes')}>← Recipes</button>
        <div className="muted">Loading…</div>
      </>
    )
  }

  return (
    <>
      <button className="link-btn" onClick={() => navigate(`/recipes/${id}`)}>← {recipe.name}</button>
      <h2 className="title">Edit costing</h2>
      <div className="muted">
        Peso cost per line, per size — gas and overheads count too.{' '}
        {role === 'admin' ? 'Changes apply immediately.' : 'Changes go to Lexi for approval.'}
      </div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

      {done ? (
        <div style={{ marginTop: 14 }}>
          <div className="success">{done}</div>
          <button className="btn" onClick={() => navigate(`/recipes/${id}`)}>← Back to recipe</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="card cost-grid-wrap" style={{ marginTop: 14 }}>
            <table className="cost-grid">
              <thead>
                <tr>
                  <th>Item</th>
                  {tiers.map((t) => (
                    <th key={t.label}>{t.label}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        value={l.name}
                        onChange={(e) => setName(idx, e.target.value)}
                        placeholder="e.g. Beef shank"
                      />
                    </td>
                    {tiers.map((t, ti) => (
                      <td key={t.label}>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          value={l.costs[ti]}
                          onChange={(e) => setCost(idx, ti, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td>
                      <button type="button" className="rm" onClick={() => removeLine(idx)} title="Remove">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="grid-total">
                  <td>Total</td>
                  {tiers.map((t, ti) => (
                    <td key={t.label}>{peso(parsed.reduce((s, l) => s + (l.costs[ti] || 0), 0))}</td>
                  ))}
                  <td></td>
                </tr>
              </tbody>
            </table>
            <button type="button" className="btn ghost" onClick={addLine} style={{ marginTop: 10 }}>
              + Add line
            </button>
          </div>

          <div className="note" style={{ marginTop: 0 }}>
            Saving updates the costing grid only — the recipe's tier costs change when someone taps
            Recalculate. Prices never change here.
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : role === 'admin' ? 'Save costing' : 'Send for approval'}
          </button>
        </form>
      )}
    </>
  )
}
