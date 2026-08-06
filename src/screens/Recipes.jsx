import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchRecipes, priceRange, addRecipe } from '../lib/recipes.js'
import { MEAL_TAGS } from '../lib/inventory.js'

const MEAL_SHORT = { breakfast: '🌅 Breakfast', lunch_dinner: '🌇 Lunch/Dinner', both: '☀️ All day' }
const BLANK = { name: '', category: '', paxTier: '1', mealTag: '' }

export default function Recipes() {
  const navigate = useNavigate()
  const { role, currentUser } = useAuth()
  const [recipes, setRecipes] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetchRecipes()
      .then((data) => active && setRecipes(data))
      .catch((e) => active && setError(e.message || 'Could not load recipes.'))
    return () => {
      active = false
    }
  }, [])

  const categoryCount = recipes ? new Set(recipes.map((r) => r.category)).size : 0
  const canAdd = role === 'admin' || role === 'staff'
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  // Existing categories, offered as suggestions so the list doesn't sprout
  // near-duplicates ("Dessert" vs "Desserts").
  const categories = recipes ? [...new Set(recipes.map((r) => r.category).filter(Boolean))].sort() : []

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    if (!name) {
      setError('The dish needs a name.')
      return
    }
    const dupe = (recipes ?? []).find((r) => r.name.trim().toLowerCase() === name.toLowerCase())
    if (dupe) {
      setError(`"${dupe.name}" already exists — open it instead of adding it twice.`)
      return
    }
    setBusy(true)
    try {
      const created = await addRecipe(form, currentUser.id)
      navigate(`/recipes/${created.id}`)
    } catch (err) {
      setError(err.message || 'Could not add the dish. Try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <h2 className="title">Recipes</h2>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {!recipes && !error ? <div className="muted">Loading…</div> : null}

      {recipes ? (
        <>
          <div className="muted">
            {recipes.length} {recipes.length === 1 ? 'dish' : 'dishes'} · {categoryCount}{' '}
            {categoryCount === 1 ? 'category' : 'categories'}
          </div>

          {recipes.length === 0 ? (
            <div className="placeholder">No recipes yet.</div>
          ) : (
            <div className="card" style={{ marginTop: 14 }}>
              {recipes.map((r) => (
                <button
                  key={r.id}
                  className="row"
                  style={{ width: '100%', background: 'none', border: 'none', font: 'inherit', cursor: 'pointer' }}
                  onClick={() => navigate(`/recipes/${r.id}`)}
                >
                  <div className="info">
                    <div className="n">{r.name}</div>
                    <div className="m">
                      {r.category}
                      {(r.tiers ?? []).length
                        ? ` · ${r.tiers.map((t) => t.label).join(' / ')}`
                        : ''}
                      {r.meal_tag ? ` · ${MEAL_SHORT[r.meal_tag] ?? r.meal_tag}` : ''}
                      {!r.is_available ? ' · not on menu' : ''}
                    </div>
                  </div>
                  <div className="qty">
                    {priceRange(r.tiers)}
                    <small>menu price</small>
                  </div>
                </button>
              ))}
            </div>
          )}

          {canAdd ? (
            adding ? (
              <form className="card" onSubmit={handleAdd}>
                <div className="field">
                  <label>Dish name</label>
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Chicken Adobo"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Category</label>
                  <input
                    list="recipe-categories"
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    placeholder="e.g. Mains, Dessert"
                  />
                  <datalist id="recipe-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label>Servings per batch</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={form.paxTier}
                    onChange={(e) => set('paxTier', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Mainly served at (optional)</label>
                  <select value={form.mealTag} onChange={(e) => set('mealTag', e.target.value)}>
                    <option value="">— not set —</option>
                    {MEAL_TAGS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="appr-actions">
                  <button className="btn green" type="submit" disabled={busy}>
                    {busy ? 'Adding…' : 'Add dish'}
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setAdding(false)
                      setForm(BLANK)
                      setError('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <div className="note">
                  It starts with no prices and off the menu. Add sizes and prices in "Edit recipe",
                  amounts in "Edit ingredients" — prices are always set by hand to match the Tanawin
                  Menu.
                </div>
              </form>
            ) : (
              <button className="btn" onClick={() => setAdding(true)}>
                + Add recipe
              </button>
            )
          ) : null}
        </>
      ) : null}
    </>
  )
}
