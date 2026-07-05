import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchRecipe, describeRecipeChanges } from '../lib/recipes.js'
import { submitRecipeEdit, applyRecipeEditDirect } from '../lib/approvals.js'

const PAX_TIERS = [2, 6, 9]

export default function RecipeEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState('') // success message after submit
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetchRecipe(id)
      .then((r) => {
        if (!active) return
        setRecipe(r)
        setForm({
          name: r.name ?? '',
          category: r.category ?? '',
          pax_tier: r.pax_tier ?? 2,
          is_available: !!r.is_available,
          prep_instructions: r.prep_instructions ?? '',
          video_url: r.video_url ?? '',
          image_url: r.image_url ?? '',
          links: (r.links ?? []).join('\n'),
        })
      })
      .catch((e) => active && setError(e.message || 'Could not load recipe.'))
    return () => {
      active = false
    }
  }, [id])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Compare form vs. the loaded recipe; return only the changed fields.
  const diff = () => {
    const before = {}
    const changes = {}
    const formLinks = form.links
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const pairs = [
      ['name', recipe.name ?? '', form.name.trim()],
      ['category', recipe.category ?? '', form.category.trim()],
      ['pax_tier', recipe.pax_tier, Number(form.pax_tier)],
      ['is_available', !!recipe.is_available, !!form.is_available],
      ['prep_instructions', recipe.prep_instructions ?? '', form.prep_instructions.trim()],
      ['video_url', recipe.video_url ?? '', form.video_url.trim()],
      ['image_url', recipe.image_url ?? '', form.image_url.trim()],
      ['links', JSON.stringify(recipe.links ?? []), JSON.stringify(formLinks)],
    ]
    for (const [k, orig, next] of pairs) {
      if (orig !== next) {
        // links are compared as JSON but stored as real arrays
        before[k] = k === 'links' ? JSON.parse(orig) : orig
        changes[k] = k === 'links' ? JSON.parse(next) : next
      }
    }
    return { before, changes }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setDone('')
    const { before, changes } = diff()
    if (Object.keys(changes).length === 0) {
      setError('No changes to save.')
      return
    }
    const summary = `Edit recipe — ${recipe.name}: ${describeRecipeChanges(changes, before)}`
    setBusy(true)
    try {
      if (role === 'admin') {
        await applyRecipeEditDirect(recipe, changes, currentUser.id)
        setDone('Saved — changes applied.')
      } else {
        await submitRecipeEdit(recipe, changes, before, summary, currentUser.id)
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
        <h2 className="title">Edit recipe</h2>
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

  if (!form) {
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
      <h2 className="title">Edit recipe</h2>
      <div className="muted">
        {role === 'admin'
          ? 'Your changes apply immediately.'
          : 'Changes are sent to Lexi for approval before they take effect.'}
      </div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

      {done ? (
        <div style={{ marginTop: 14 }}>
          <div className="success">{done}</div>
          <button className="btn" onClick={() => navigate(`/recipes/${id}`)}>
            ← Back to recipe
          </button>
        </div>
      ) : (
        <form className="card" style={{ marginTop: 14 }} onSubmit={handleSubmit}>
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Category</label>
            <input value={form.category} onChange={(e) => set('category', e.target.value)} />
          </div>
          <div className="field">
            <label>Fixed batch (pax tier)</label>
            <select value={form.pax_tier} onChange={(e) => set('pax_tier', e.target.value)}>
              {PAX_TIERS.map((p) => (
                <option key={p} value={p}>
                  {p} pax
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Available on the menu?</label>
            <select
              value={form.is_available ? 'yes' : 'no'}
              onChange={(e) => set('is_available', e.target.value === 'yes')}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea
              rows={3}
              value={form.prep_instructions}
              onChange={(e) => set('prep_instructions', e.target.value)}
              placeholder="Prep instructions, tips, reminders…"
            />
          </div>
          <div className="field">
            <label>YouTube video (optional)</label>
            <input
              type="url"
              value={form.video_url}
              onChange={(e) => set('video_url', e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </div>
          <div className="field">
            <label>Photo URL (optional — also used by the menu)</label>
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => set('image_url', e.target.value)}
              placeholder="https://…/photo.jpg"
            />
          </div>
          <div className="field">
            <label>External links (optional, one per line)</label>
            <textarea
              rows={3}
              value={form.links}
              onChange={(e) => set('links', e.target.value)}
              placeholder={'https://example.com/recipe\nhttps://blog.com/tips'}
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : role === 'admin' ? 'Save changes' : 'Send for approval'}
          </button>
        </form>
      )}
    </>
  )
}
