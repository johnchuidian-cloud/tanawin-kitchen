import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  fetchRecipe,
  recalcRecipe,
  computeCost,
  costsStale,
  lineCost,
  unitProblems,
  recipeUsage,
  deleteRecipe,
  tierColumnSum,
  peso,
  youTubeId,
} from '../lib/recipes.js'
import { fmtQty, shortUnit } from '../lib/inventory.js'
import { canCook, planCook, cookDish, describeApplied } from '../lib/cooking.js'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [usage, setUsage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [batches, setBatches] = useState('1')
  const [cooking, setCooking] = useState(false)
  const [cookResult, setCookResult] = useState(null)

  useEffect(() => {
    let active = true
    fetchRecipe(id)
      .then((data) => active && setRecipe(data))
      .catch((e) => active && setError(e.message || 'Could not load this recipe.'))
    // What a delete would affect — loaded up front so the button can say so
    // before it's tapped, not after.
    recipeUsage(id)
      .then((u) => active && setUsage(u))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [id])

  const qtyLines = recipe?.lines ?? []
  const costLines = recipe?.cost_lines ?? []
  const tiers = recipe?.tiers ?? []
  const hasGrid = costLines.length > 0
  const hasQty = qtyLines.length > 0
  const canEdit = role === 'admin' || role === 'staff'
  // While a unit can't be reconciled the totals are knowingly incomplete, so
  // "tap Recalculate" would be bad advice — Recalculate refuses to run.
  const stale = recipe ? costsStale(recipe) && !unitProblems(recipe).length : false
  const ytid = youTubeId(recipe?.video_url)

  const handleRecalc = async () => {
    setBusy(true)
    setMsg('')
    setError('')
    try {
      const newTiers = await recalcRecipe(recipe, currentUser.id)
      setRecipe((r) => ({ ...r, tiers: newTiers }))
      setMsg('Recalculated — tier costs updated. Prices are untouched (always hand-set).')
    } catch (err) {
      setError(err.message || 'Could not recalculate. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteRecipe(recipe, currentUser.id)
      navigate('/recipes')
    } catch (err) {
      setError(err.message || 'Could not delete this recipe.')
      setBusy(false)
    }
  }

  const handleCook = async () => {
    setCooking(true)
    setError('')
    setMsg('')
    setCookResult(null)
    try {
      const res = await cookDish(recipe, Number(batches) || 1, currentUser.id)
      setCookResult(res)
      // Reload so the ingredient costs/quantities on screen reflect the deduction.
      const fresh = await fetchRecipe(id)
      setRecipe(fresh)
    } catch (err) {
      setError(err.message || 'Could not log this as cooked.')
    } finally {
      setCooking(false)
    }
  }

  if (error && !recipe) {
    return (
      <>
        <button className="link-btn" onClick={() => navigate('/recipes')}>← Recipes</button>
        <div className="error">{error}</div>
      </>
    )
  }

  if (!recipe) {
    return (
      <>
        <button className="link-btn" onClick={() => navigate('/recipes')}>← Recipes</button>
        <div className="muted">Loading…</div>
      </>
    )
  }

  const batchTotal = hasQty ? computeCost(recipe, qtyLines).batchTotal : 0
  const unitTrouble = unitProblems(recipe)

  return (
    <>
      <button className="link-btn" onClick={() => navigate('/recipes')}>← Recipes</button>

      <h2 className="title">{recipe.name}</h2>
      <div className="muted">
        {recipe.category}
        {recipe.meal_tag
          ? ` · ${{ breakfast: 'Breakfast', lunch_dinner: 'Lunch/Dinner', both: 'Breakfast + Lunch/Dinner' }[recipe.meal_tag] ?? recipe.meal_tag}`
          : ''}
        {!recipe.is_available ? ' · not on the menu' : ''}
      </div>

      {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}

      {recipe.image_url ? (
        <img
          className="recipe-img"
          src={recipe.image_url}
          alt={recipe.name}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : null}

      {/* Sizes: cost vs hand-set menu price, with the resulting markup */}
      {tiers.length ? (
        <div className="card tier-table-wrap" style={{ marginTop: 12 }}>
          <table className="tier-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Cost</th>
                <th>Menu price</th>
                <th>Markup</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.label}>
                  <td>{t.label}</td>
                  <td>{t.cost == null ? '—' : peso(t.cost)}</td>
                  <td className="price">{t.price == null ? '—' : peso(t.price)}</td>
                  <td className="muted-cell">
                    {t.cost && t.price ? `×${(t.price / t.cost).toFixed(1)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="placeholder">No sizes or prices set yet — use Edit recipe.</div>
      )}

      {msg ? <div className="success">{msg}</div> : null}

      {stale ? (
        <div className="note" style={{ marginTop: 0, marginBottom: 6 }}>
          ⚠️ The costing below doesn't match the stored tier costs. Tap Recalculate to update them.
        </div>
      ) : null}

      {/* Costing: Lexi's peso grid, or quantity-based breakdown (crepes) */}
      {hasGrid ? (
        <>
          <div className="section-label">Costing (per size)</div>
          <div className="card cost-grid-wrap">
            <table className="cost-grid readonly">
              <thead>
                <tr>
                  <th>Item</th>
                  {tiers.map((t) => (
                    <th key={t.label}>{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costLines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.name}</td>
                    {tiers.map((t, ti) => (
                      <td key={t.label}>
                        {l.qty?.[ti] != null ? (
                          <span className="cell-qty">
                            {fmtQty(l.qty[ti])} {l.unit ? shortUnit(l.unit) : ''}
                          </span>
                        ) : null}
                        <span className="cell-cost">{peso(l.costs?.[ti] ?? 0)}</span>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="grid-total">
                  <td>Total</td>
                  {tiers.map((t, ti) => (
                    <td key={t.label}>{peso(tierColumnSum(costLines, ti))}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : hasQty ? (
        <>
          <div className="section-label">
            Ingredients (batch of {recipe.pax_tier || 1})
          </div>
          <div className="card">
            {qtyLines.map((l) => {
              const cost = lineCost(l)
              return (
                <div className="ing-line" key={l.id}>
                  <span>
                    {l.ingredient?.name ?? 'Unknown'} — {fmtQty(l.quantity)} {shortUnit(l.unit)}
                  </span>
                  {/* A cost we can't work out is shown as unknown, never as ₱0
                      and never as the raw multiplication. */}
                  <span className="c">{cost == null ? '—' : peso(cost)}</span>
                </div>
              )
            })}
            <div className="ing-line" style={{ fontWeight: 700 }}>
              <span>Batch total{unitTrouble.length ? ' (incomplete)' : ''}</span>
              <span>{peso(batchTotal)}</span>
            </div>
          </div>
          {unitTrouble.length ? (
            <div className="note">
              ⚠️ {unitTrouble.join(', ')} {unitTrouble.length === 1 ? 'is' : 'are'} measured here in
              a unit that doesn't match how the item is stocked (like pieces vs kg), so{' '}
              {unitTrouble.length === 1 ? 'its cost is' : 'their costs are'} left out of the total.
              Only a person knows what one pack or piece weighs — fix the units in "Edit
              ingredients" and the total completes itself.
            </div>
          ) : null}
        </>
      ) : (
        <div className="placeholder">
          No costing yet — add Lexi-style peso lines via "Edit costing", or ingredient quantities
          via "Edit ingredients".
        </div>
      )}

      {/* Logging a cooked dish deducts stock. Only offered when the recipe
          carries real quantities — most don't yet, and a button that silently
          did nothing would be worse than no button. */}
      {canCook(recipe) && role !== 'guest' ? (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>Cooked this?</div>
          <div className="card">
            <div className="field">
              <label>How many batches?</label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={batches}
                onChange={(e) => {
                  setBatches(e.target.value)
                  setCookResult(null)
                }}
              />
            </div>
            {Number(batches) > 0 ? (
              <div className="note" style={{ marginTop: 0 }}>
                Will take out:{' '}
                {planCook(recipe, Number(batches))
                  .deduct.map((d) => `${d.name} −${fmtQty(d.amount)} ${shortUnit(d.unit)}`)
                  .join(', ') || 'nothing — no units convert'}
                {planCook(recipe, Number(batches)).skipped.length ? (
                  <>
                    <br />
                    Not deducted:{' '}
                    {planCook(recipe, Number(batches))
                      .skipped.map((s) => `${s.name} (${s.reason})`)
                      .join('; ')}
                  </>
                ) : null}
              </div>
            ) : null}
            <button
              className="btn green"
              disabled={cooking || !(Number(batches) > 0)}
              onClick={handleCook}
            >
              {cooking ? 'Saving…' : '🍳 Log as cooked'}
            </button>
            <div className="note">
              This takes the ingredients out of stock straight away — no approval needed. Your next
              stock count then shows whether anything went missing on top of this.
            </div>
          </div>
        </>
      ) : null}

      {cookResult ? (
        <div className="success" style={{ marginTop: 10 }}>
          Logged. Deducted: {describeApplied(cookResult.applied)}.
          {cookResult.shortfalls.length
            ? ` Note: ${cookResult.shortfalls
                .map((s) => `${s.name} only had ${fmtQty(s.before)} ${shortUnit(s.unit)} on record`)
                .join('; ')} — worth a fresh count.`
            : ''}
          {cookResult.skipped.length
            ? ` Not deducted: ${cookResult.skipped.map((s) => s.name).join(', ')}.`
            : ''}
        </div>
      ) : null}

      {ytid ? (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>Watch how it's made</div>
          <div className="video-wrap">
            <iframe
              src={`https://www.youtube.com/embed/${ytid}`}
              title={`${recipe.name} video`}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <a className="btn ghost yt-btn" href={`https://youtu.be/${ytid}`} target="_blank" rel="noreferrer">
            ▶ Open in YouTube
          </a>
        </>
      ) : recipe.video_url ? (
        <a className="btn ghost yt-btn" href={recipe.video_url} target="_blank" rel="noreferrer">
          ▶ Watch recipe video
        </a>
      ) : null}

      {recipe.prep_instructions ? (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>Notes</div>
          <div className="card recipe-notes">{recipe.prep_instructions}</div>
        </>
      ) : null}

      {recipe.links?.length ? (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>Links</div>
          <div className="card">
            {recipe.links.map((l) => {
              let label = l
              try {
                label = new URL(l).hostname.replace(/^www\./, '')
              } catch { /* show raw */ }
              return (
                <a className="ext-link" key={l} href={l} target="_blank" rel="noreferrer">
                  🔗 {label}
                  <span className="m">{l}</span>
                </a>
              )
            })}
          </div>
        </>
      ) : null}

      {canEdit ? (
        <>
          <button
            className="btn ghost"
            onClick={handleRecalc}
            disabled={busy || (!hasGrid && !hasQty)}
            title={hasGrid || hasQty ? '' : 'Add costing first'}
          >
            ↻ {busy ? 'Recalculating…' : 'Recalculate costs'}
          </button>
          {/* Both are always offered. "Edit ingredients" used to hide itself
              on any recipe that had a costing grid, which made the one screen
              that drives stock deduction unreachable for most dishes. */}
          <button className="btn ghost" onClick={() => navigate(`/recipes/${recipe.id}/costing`)}>
            Edit costing{hasGrid ? '' : ' (peso sheet)'}
          </button>
          <button className="btn ghost" onClick={() => navigate(`/recipes/${recipe.id}/ingredients`)}>
            Edit ingredients{hasQty ? '' : ' (amounts + units)'}
          </button>
          <button className="btn" onClick={() => navigate(`/recipes/${recipe.id}/edit`)}>
            Edit recipe
          </button>
          <div className="note">
            <b>Edit costing</b> is the peso sheet — it sets the cost per size.{' '}
            <b>Edit ingredients</b> links to your stock with amounts and units — that's what makes
            "Cooked this?" appear and takes things out of stock. Filling in both is worth it; they
            do different jobs. Prices mirror the Tanawin Menu and only change by hand (via Edit
            recipe
            {role === 'admin' ? '' : ", with Lexi's approval"}). Recalculate only runs when you tap
            it — costs never shift on their own.
          </div>

          {role === 'admin' ? (
            <>
              <div className="note" style={{ marginTop: 12 }}>
                {usage == null
                  ? 'Checking what this dish has attached…'
                  : `Deleting removes this dish${
                      usage.lines ? ` and its ${usage.lines} ingredient line${usage.lines === 1 ? '' : 's'}` : ''
                    }.${
                      usage.cooked
                        ? ` The ${usage.cooked} cooked entr${usage.cooked === 1 ? 'y' : 'ies'} in your stock history stay put — the stock still shows as used, it just stops naming the dish.`
                        : ''
                    } This can't be undone.`}
              </div>
              <div className="appr-actions">
                {confirmDelete ? (
                  <>
                    <button className="btn" type="button" disabled={busy} onClick={handleDelete}>
                      {busy ? 'Deleting…' : `Really delete ${recipe.name}?`}
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep it
                    </button>
                  </>
                ) : (
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={busy || usage == null}
                    onClick={() => setConfirmDelete(true)}
                  >
                    🗑️ Delete this dish
                  </button>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="guest-banner">👁️ Guest view — recipe costs are read-only.</div>
      )}
    </>
  )
}
