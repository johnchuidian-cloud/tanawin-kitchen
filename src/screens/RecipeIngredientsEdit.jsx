import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchRecipe, costFromLines, peso } from '../lib/recipes.js'
import { fetchIngredients, shortUnit, fmtQty } from '../lib/inventory.js'
import { submitIngredientsEdit, applyIngredientsDirect } from '../lib/approvals.js'

// Human-readable diff of ingredient lines (added / removed / changed).
function describeChanges(before, after, byId) {
  const bMap = new Map(before.map((l) => [l.ingredient_id, l.quantity]))
  const aMap = new Map(after.map((l) => [l.ingredient_id, l.quantity]))
  const name = (id) => byId[id]?.name ?? 'ingredient'
  const u = (id) => shortUnit(byId[id]?.unit ?? '')
  const parts = []
  for (const l of after) {
    if (!bMap.has(l.ingredient_id)) parts.push(`added ${name(l.ingredient_id)} (${fmtQty(l.quantity)} ${u(l.ingredient_id)})`)
    else if (Number(bMap.get(l.ingredient_id)) !== Number(l.quantity))
      parts.push(`${name(l.ingredient_id)} ${fmtQty(bMap.get(l.ingredient_id))} → ${fmtQty(l.quantity)} ${u(l.ingredient_id)}`)
  }
  for (const l of before) {
    if (!aMap.has(l.ingredient_id)) parts.push(`removed ${name(l.ingredient_id)}`)
  }
  return parts.join('; ')
}

export default function RecipeIngredientsEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [lines, setLines] = useState(null) // [{ ingredient_id, quantity(str), unit }]
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([fetchRecipe(id), fetchIngredients()])
      .then(([r, ings]) => {
        if (!active) return
        setRecipe(r)
        setIngredients(ings)
        setLines(
          (r.lines ?? []).map((l) => ({
            ingredient_id: l.ingredient_id,
            quantity: String(l.quantity),
            unit: l.unit,
          }))
        )
      })
      .catch((e) => active && setError(e.message || 'Could not load the recipe.'))
    return () => {
      active = false
    }
  }, [id])

  const byId = useMemo(() => Object.fromEntries(ingredients.map((i) => [i.id, i])), [ingredients])
  const available = ingredients.filter((i) => !lines?.some((l) => l.ingredient_id === i.id))

  const preview = useMemo(
    () => (lines && recipe ? costFromLines(lines, byId, recipe.pax_tier) : null),
    [lines, recipe, byId]
  )

  const setQty = (idx, v) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx))
  const addLine = (ingredientId) => {
    const ing = byId[ingredientId]
    if (!ing) return
    setLines((ls) => [...ls, { ingredient_id: ing.id, quantity: '', unit: ing.unit }])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setDone('')
    for (const l of lines) {
      const n = Number(l.quantity)
      if (l.quantity === '' || Number.isNaN(n) || n <= 0) {
        setError(`Enter a quantity (more than 0) for ${byId[l.ingredient_id]?.name ?? 'each ingredient'}, or remove it.`)
        return
      }
    }
    const after = lines.map((l) => ({ ingredient_id: l.ingredient_id, quantity: Number(l.quantity), unit: l.unit }))
    const before = (recipe.lines ?? []).map((l) => ({
      ingredient_id: l.ingredient_id,
      quantity: Number(l.quantity),
      unit: l.unit,
    }))
    const diff = describeChanges(before, after, byId)
    if (!diff) {
      setError('No ingredient changes to save.')
      return
    }
    const summary =
      `Edit ingredients — ${recipe.name}: ${diff}. ` +
      `Cost/serving ${peso(recipe.cost_per_serving)} → ${peso(preview.costPerServing)}`

    setBusy(true)
    try {
      if (role === 'admin') {
        await applyIngredientsDirect(recipe, after, currentUser.id)
        setDone('Saved — ingredients updated. Tap Recalculate on the recipe to commit the new cost.')
      } else {
        await submitIngredientsEdit(recipe, after, before, summary, currentUser.id)
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
        <h2 className="title">Edit ingredients</h2>
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
      <h2 className="title">Edit ingredients</h2>
      <div className="muted">
        Fixed batch: {recipe.pax_tier} pax ·{' '}
        {role === 'admin' ? 'changes apply immediately' : 'changes go to Lexi for approval'}
      </div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

      {done ? (
        <div style={{ marginTop: 14 }}>
          <div className="success">{done}</div>
          <button className="btn" onClick={() => navigate(`/recipes/${id}`)}>← Back to recipe</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginTop: 14 }}>
            {lines.length === 0 ? (
              <div className="muted" style={{ padding: '6px 2px' }}>No ingredients yet — add one below.</div>
            ) : (
              lines.map((l, idx) => (
                <div className="line-edit" key={l.ingredient_id}>
                  <span className="ln">{byId[l.ingredient_id]?.name ?? 'Unknown'}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={l.quantity}
                    onChange={(e) => setQty(idx, e.target.value)}
                    placeholder="qty"
                  />
                  <span className="lu">{shortUnit(l.unit)}</span>
                  <button type="button" className="rm" onClick={() => removeLine(idx)} title="Remove">
                    ✕
                  </button>
                </div>
              ))
            )}

            {available.length > 0 ? (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>Add an ingredient</label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addLine(e.target.value)
                  }}
                >
                  <option value="">Choose…</option>
                  {available.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({shortUnit(i.unit)} · {peso(i.cost_per_unit)}/{shortUnit(i.unit)})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {/* Live cost preview */}
          <div className="recipe-cost">
            <div>
              <div className="cost-lbl">Batch total</div>
              <div className="big" style={{ fontSize: 18 }}>{peso(preview.batchTotal)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="cost-lbl">Cost / serving</div>
              <div className="big" style={{ fontSize: 18 }}>{peso(preview.costPerServing)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="cost-lbl">Menu ×3</div>
              <div className="big" style={{ fontSize: 18 }}>{peso(preview.menuPrice)}</div>
            </div>
          </div>
          <div className="note" style={{ marginTop: 0 }}>
            Currently stored: {peso(recipe.cost_per_serving)}/serving. Costs only change when you tap
            Recalculate — this preview shows what it would become.
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : role === 'admin' ? 'Save ingredients' : 'Send for approval'}
          </button>
        </form>
      )}
    </>
  )
}
