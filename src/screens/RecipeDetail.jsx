import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  fetchRecipe,
  recalcRecipe,
  computeCost,
  computedTierCosts,
  costsStale,
  lineCost,
  tierColumnSum,
  peso,
  youTubeId,
} from '../lib/recipes.js'
import { fmtQty, shortUnit } from '../lib/inventory.js'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let active = true
    fetchRecipe(id)
      .then((data) => active && setRecipe(data))
      .catch((e) => active && setError(e.message || 'Could not load this recipe.'))
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
  const stale = recipe ? costsStale(recipe) : false
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
                      <td key={t.label}>{peso(l.costs?.[ti] ?? 0)}</td>
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
            {qtyLines.map((l) => (
              <div className="ing-line" key={l.id}>
                <span>
                  {l.ingredient?.name ?? 'Unknown'} — {fmtQty(l.quantity)} {shortUnit(l.unit)}
                </span>
                <span className="c">{peso(lineCost(l))}</span>
              </div>
            ))}
            <div className="ing-line" style={{ fontWeight: 700 }}>
              <span>Batch total</span>
              <span>{peso(batchTotal)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="placeholder">
          No costing yet — add Lexi-style peso lines via "Edit costing", or ingredient quantities
          via "Edit ingredients".
        </div>
      )}

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
          {hasGrid || !hasQty ? (
            <button className="btn ghost" onClick={() => navigate(`/recipes/${recipe.id}/costing`)}>
              Edit costing
            </button>
          ) : null}
          {hasQty || !hasGrid ? (
            <button className="btn ghost" onClick={() => navigate(`/recipes/${recipe.id}/ingredients`)}>
              Edit ingredients
            </button>
          ) : null}
          <button className="btn" onClick={() => navigate(`/recipes/${recipe.id}/edit`)}>
            Edit recipe
          </button>
          <div className="note">
            Prices mirror the Tanawin Menu and only change by hand (via Edit recipe
            {role === 'admin' ? '' : ', with Lexi\'s approval'}). Recalculate only runs when you tap
            it — costs never shift on their own.
          </div>
        </>
      ) : (
        <div className="guest-banner">👁️ Guest view — recipe costs are read-only.</div>
      )}
    </>
  )
}
