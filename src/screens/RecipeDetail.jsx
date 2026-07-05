import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchRecipe, recalcRecipe, computeCost, lineCost, peso, youTubeId } from '../lib/recipes.js'
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

  const lines = recipe?.lines ?? []
  const hasLines = lines.length > 0
  const canEdit = role === 'admin' || role === 'staff'

  const handleRecalc = async () => {
    if (!hasLines) return
    setBusy(true)
    setMsg('')
    setError('')
    try {
      const { costPerServing, menuPrice } = await recalcRecipe(recipe, lines, currentUser.id)
      setRecipe((r) => ({ ...r, cost_per_serving: costPerServing, menu_price: menuPrice }))
      setMsg(`Recalculated — ${peso(costPerServing)}/serving, menu price ${peso(menuPrice)}.`)
    } catch (err) {
      setError(err.message || 'Could not recalculate. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
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

  const computed = hasLines ? computeCost(recipe, lines) : null
  const batchTotal = computed?.batchTotal ?? 0
  const ytid = youTubeId(recipe.video_url)
  // Breakdown implies a different cost than what's stored → nudge to recalc.
  const costStale = computed && Math.abs(computed.costPerServing - Number(recipe.cost_per_serving)) > 0.005

  return (
    <>
      <button className="link-btn" onClick={() => navigate('/recipes')}>← Recipes</button>

      <h2 className="title">{recipe.name}</h2>
      <div className="muted">
        {recipe.category} · Fixed batch: {recipe.pax_tier} pax
      </div>

      {recipe.image_url ? (
        <img
          className="recipe-img"
          src={recipe.image_url}
          alt={recipe.name}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : null}

      <div className="recipe-cost">
        <div>
          <div className="cost-lbl">Cost / serving</div>
          <div className="big">{peso(recipe.cost_per_serving)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="cost-lbl">Menu price ×3</div>
          <div className="big">{peso(recipe.menu_price)}</div>
        </div>
      </div>

      {msg ? <div className="success">{msg}</div> : null}

      <div className="section-label">Ingredients (fixed batch)</div>
      {hasLines ? (
        <div className="card">
          {lines.map((l) => (
            <div className="ing-line" key={l.id}>
              <span>
                {l.ingredient?.name ?? 'Unknown'} — {fmtQty(l.quantity)} {shortUnit(l.unit)}
              </span>
              <span className="c">{peso(lineCost(l))}</span>
            </div>
          ))}
          <div className="ing-line" style={{ fontWeight: 700 }}>
            <span>Batch total ({recipe.pax_tier} pax)</span>
            <span>{peso(batchTotal)}</span>
          </div>
        </div>
      ) : (
        <div className="placeholder">
          No ingredients linked yet. Tap "Edit ingredients" to add them and enable the cost breakdown.
        </div>
      )}

      {costStale ? (
        <div className="note" style={{ marginTop: 0, marginBottom: 6 }}>
          ⚠️ The breakdown works out to {peso(computed.costPerServing)}/serving, but the stored
          cost is {peso(recipe.cost_per_serving)}. Tap Recalculate to update it.
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
            disabled={busy || !hasLines}
            title={hasLines ? '' : 'Add ingredients first'}
          >
            ↻ {busy ? 'Recalculating…' : 'Recalculate cost'}
          </button>
          <button className="btn ghost" onClick={() => navigate(`/recipes/${recipe.id}/ingredients`)}>
            Edit ingredients
          </button>
          <button className="btn" onClick={() => navigate(`/recipes/${recipe.id}/edit`)}>
            Edit recipe
          </button>
          <div className="note">
            {role === 'admin'
              ? 'Editing applies your changes directly. Recalculate only runs when you tap it — costs never shift on their own.'
              : 'Editing a recipe routes to Lexi for approval. Recalculate only runs when you tap it — costs never shift on their own.'}
          </div>
        </>
      ) : (
        <div className="guest-banner">👁️ Guest view — recipe costs are read-only.</div>
      )}
    </>
  )
}
