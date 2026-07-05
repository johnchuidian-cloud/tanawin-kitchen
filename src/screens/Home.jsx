import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchHomeStats } from '../lib/stats.js'

const ACTIONS = [
  { ico: '📋', name: 'Count Stock', desc: 'Log current quantities', to: '/count' },
  { ico: '🗑️', name: 'Log Waste', desc: 'Record spoilage', to: '/waste' },
  { ico: '🍳', name: 'Recipes', desc: 'Prep & cost', to: '/recipes' },
  { ico: '🧾', name: 'Purchases', desc: 'Restock log', to: '/purchases' },
  { ico: '🚚', name: 'Suppliers', desc: 'Vendors & prices', to: '/suppliers' },
  { ico: '✅', name: 'Approvals', desc: 'Awaiting sign-off', to: '/approvals', badgeKey: 'pending' },
]

export default function Home() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const firstName = currentUser?.name?.split(' ')[0] ?? 'there'
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let active = true
    fetchHomeStats()
      .then((s) => active && setStats(s))
      .catch(() => {}) // dashboard counts are non-critical; leave as "…" on failure
    return () => {
      active = false
    }
  }, [])

  const show = (v) => (stats ? v : '…')

  const cards = [
    { key: 'low', num: show(stats?.lowStock), lbl: 'Low Stock', to: '/inventory' },
    { key: 'pend', num: show(stats?.pending), lbl: 'Pending', to: '/approvals' },
    { key: 'waste', num: show(stats?.wasteWeek), lbl: 'Waste · wk', to: '/waste' },
  ]

  return (
    <>
      <h2 className="title">Good morning, {firstName}</h2>
      <div className="muted">Here's what needs attention today.</div>

      <div className="stats">
        {cards.map((s) => (
          <button key={s.key} className={`stat ${s.key}`} onClick={() => navigate(s.to)}>
            <div className="num">{s.num}</div>
            <div className="lbl">{s.lbl}</div>
          </button>
        ))}
      </div>

      <div className="section-label">Quick actions</div>
      <div className="grid">
        {ACTIONS.map((a) => {
          const badge = a.badgeKey && stats?.[a.badgeKey] ? stats[a.badgeKey] : null
          return (
            <button key={a.name} className="action" onClick={() => navigate(a.to)}>
              {badge ? <span className="badge">{badge}</span> : null}
              <div className="ico">{a.ico}</div>
              <div className="name">{a.name}</div>
              <div className="desc">{a.desc}</div>
            </button>
          )
        })}
      </div>
    </>
  )
}
