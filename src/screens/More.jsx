import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const LINKS = [
  { to: '/suppliers', icon: '🚚', name: 'Suppliers', desc: 'Vendors & contact info' },
  { to: '/activity', icon: '📜', name: 'Activity log', desc: 'Who changed what, when' },
  { to: '/purchases', icon: '🧾', name: 'Purchases', desc: 'Restock & Finance pull' },
  { to: '/waste', icon: '🗑️', name: 'Waste log', desc: 'Spoilage & losses' },
  { to: '/approvals', icon: '✅', name: 'Approvals', desc: 'Awaiting sign-off' },
  { to: '/settings', icon: '⚙️', name: 'Settings', desc: 'Team controls', adminOnly: true },
]

export default function More() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const links = LINKS.filter((l) => !l.adminOnly || role === 'admin')

  return (
    <>
      <h2 className="title">More</h2>
      <div className="card" style={{ marginTop: 14 }}>
        {links.map((l) => (
          <button
            key={l.to}
            className="row"
            style={{ width: '100%', background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
            onClick={() => navigate(l.to)}
          >
            <div className="info">
              <div className="n">
                {l.icon} {l.name}
              </div>
              <div className="m">{l.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
