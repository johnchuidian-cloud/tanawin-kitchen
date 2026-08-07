import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchRecipe, costFromLines, peso } from '../lib/recipes.js'
import { fetchIngredients, shortUnit, fmtQty, UNITS } from '../lib/inventory.js'
import { convert } from '../lib/units.js'
import { submitIngredientsEdit, applyIngredientsDirect } from '../lib/approvals.js'

// Human-readable diff of ingredient lines (added / removed / changed).
function describeChanges(before, after, byId) {
  const bMap = new Map(before.map((l) => [l.ingredient_id, l]))
  const aMap = new Map(after.map((l) => [l.ingredient_id, l]))
  const name = (id) => byId[id]?.name ?? 'ingredient'
  // The LINE's unit, not the stock unit — they can differ, and an approval
  // that quotes the wrong one is worse than useless.
  const u = (l) => shortUnit(l.unit || byId[l.ingredient_id]?.unit || '')
  const parts = []
  for (const l of after) {
    const prev = bMap.get(l.ingredient_id)
    if (!prev) parts.push(`added ${name(l.ingredient_id)} (${fmtQty(l.quantity)} ${u(l)})`)
    else if (Number(prev.quantity) !== Number(l.quantity) || prev.unit !== l.unit)
      parts.push(
        `${name(l.ingredient_id)} ${fmtQty(prev.quantity)} ${u(prev)} → ${fmtQty(l.quantity)} ${u(l)}`
      )
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
    // Archived items included so a recipe that still uses one can NAME it.
    // Without them the line rendered as "Unknown" with a malformed unit
    // warning. They're kept out of the "add an ingredient" picker below.
    Promise.all([fetchRecipe(id), fetchIngredients({ includeArchived: true })])
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
  const available = ingredients.filter(
    (i) => !i.archived_at && !lines?.some((l) => l.ingredient_id === i.id)
  )

  const preview = useMemo(
    () => (lines && recipe ? costFromLines(lines, byId, recipe.pax_tier) : null),
    [lines, recipe, byId]
  )

  const setQty = (idx, v) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))
  // The unit the RECIPE is written in — it needn't match how the item is
  // stocked ("500 g" of something bought by the kilo). Costing and cooking
  // convert; where they can't, the line says so.
  const setUnit = (idx, u) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unit: u } : l)))
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
      `Cost/serving ${recipe.tiers?.[0]?.cost != null ? peso(recipe.tiers[0].cost) : '—'} → ${peso(preview.costPerServing)}`

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
              lines.map((l, idx) => {
                const ing = byId[l.ingredient_id]
                // Can this line's unit be turned into the unit the item is
                // stocked (and priced) in? Flagged here, at the moment of
                // choosing, rather than as a surprise on the recipe page.
                // An item that's gone missing entirely (deleted straight from
                // the database) has no unit to reconcile against — don't
                // accuse it of a unit mismatch it can't be guilty of.
                const converts = !ing || convert(1, l.unit || ing.unit, ing.unit) != null
                return (
                  <div key={l.ingredient_id}>
                    <div className="line-edit">
                      <span className="ln">
                        {ing?.name ?? 'Item no longer in stock list'}
                        {ing?.archived_at ? ' (archived)' : ''}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={l.quantity}
                        onChange={(e) => setQty(idx, e.target.value)}
                        placeholder="qty"
                      />
                      <select
                        className="line-unit"
                        value={l.unit || ing?.unit || ''}
                        onChange={(e) => setUnit(idx, e.target.value)}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {shortUnit(u)}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="rm" onClick={() => removeLine(idx)} title="Remove">
                        ✕
                      </button>
                    </div>
                    {!converts ? (
                      <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>
                        ⚠️ {ing?.name} is counted in {shortUnit(ing?.unit)}, and there's no fixed way
                        to turn {shortUnit(l.unit)} into {shortUnit(ing?.unit)} — that depends on
                        size, which only a person knows. This line won't be costed, and cooking
                        won't take it out of stock. Use {shortUnit(ing?.unit)} if you can.
                      </div>
                    ) : l.unit && ing && l.unit !== ing.unit && Number(l.quantity) > 0 ? (
                      <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>
                        = {fmtQty(convert(Number(l.quantity), l.unit, ing.unit))} {shortUnit(ing.unit)}{' '}
                        in stock terms
                      </div>
                    ) : null}
                  </div>
                )
              })
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
              <div className="cost-lbl">Menu price</div>
              <div className="big" style={{ fontSize: 18 }}>
                {recipe.tiers?.[0]?.price != null ? peso(recipe.tiers[0].price) : '—'}
              </div>
            </div>
          </div>
          {preview.unconverted.length ? (
            <div className="note" style={{ marginTop: 0 }}>
              ⚠️ {preview.unconverted.join(', ')} left out of the total — the amount here is in a
              unit that doesn't match how the item is stocked. That usually means the item's unit
              was changed after this recipe was written.
            </div>
          ) : null}
          <div className="note" style={{ marginTop: 0 }}>
            Costs only change when you tap Recalculate — this preview shows what they would become.
            Prices are hand-set on the Tanawin Menu and never computed here.
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : role === 'admin' ? 'Save ingredients' : 'Send for approval'}
          </button>
        </form>
      )}
    </>
  )
}
