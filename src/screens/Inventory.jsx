import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIngredients, stockStatus, shortUnit, fmtQty } from '../lib/inventory.js'

const DOT = { low: 'lowd', mid: 'mid', ok: 'ok' }

export default function Inventory() {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchIngredients()
      .then((data) => active && setItems(data))
      .catch((e) => active && setError(e.message || 'Could not load inventory.'))
    return () => {
      active = false
    }
  }, [])

  const lowCount = items?.filter((i) => stockStatus(i) === 'low').length ?? 0

  return (
    <>
      <h2 className="title">Inventory</h2>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

      {!items && !error ? <div className="muted">Loading…</div> : null}

      {items ? (
        <>
          <div className="muted">
            {items.length} ingredient{items.length === 1 ? '' : 's'}
            {lowCount > 0 ? ` · ${lowCount} below threshold` : ''}
          </div>

          {items.length === 0 ? (
            <div className="placeholder">
              No ingredients yet — add them via Purchases, or ask Lexi to set them up.
            </div>
          ) : (
            <div className="card" style={{ marginTop: 14 }}>
              {items.map((i) => {
                const status = stockStatus(i)
                const isLow = status === 'low'
                return (
                  <div className="row" key={i.id}>
                    <span className={`dot ${DOT[status]}`}></span>
                    <div className="info">
                      <div className="n">{i.name}</div>
                      <div className="m">{i.supplier?.name ?? 'No supplier set'}</div>
                    </div>
                    <div className="qty">
                      {fmtQty(i.quantity)} {shortUnit(i.unit)}
                      <small>
                        min {fmtQty(i.min_threshold)} {shortUnit(i.unit)}
                      </small>
                    </div>
                    <span className={`pill ${isLow ? 'low' : 'ok'}`}>{isLow ? 'LOW' : 'OK'}</span>
                  </div>
                )
              })}
            </div>
          )}

          <button className="btn" onClick={() => navigate('/count')}>
            + Enter stock count
          </button>
        </>
      ) : null}
    </>
  )
}
