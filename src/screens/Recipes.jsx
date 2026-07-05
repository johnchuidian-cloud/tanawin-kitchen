import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchRecipes, peso } from '../lib/recipes.js'

export default function Recipes() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [error, setError] = useState('')

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
                      {r.category} · {r.pax_tier} pax batch
                    </div>
                  </div>
                  <div className="qty">
                    {peso(r.menu_price)}
                    <small>per serving</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  )
}
