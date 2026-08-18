import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const LINKS = [
  { to: '/history', icon: '📈', name: 'Stock history', desc: 'Day by day, per item' },
  { to: '/suppliers', icon: '🚚', name: 'Suppliers', desc: 'Vendors & contact info' },
  { to: '/activity', icon: '📜', name: 'Activity log', desc: 'Who changed what, when' },
  { to: '/purchases', icon: '🧾', name: 'Purchases', desc: 'Restock & Finance pull' },
  { to: '/waste', icon: '🗑️', name: 'Waste log', desc: 'Spoilage & losses' },
  { to: '/approvals', icon: '✅', name: 'Approvals', desc: 'Awaiting sign-off' },
  { to: '/staff', icon: '👥', name: 'Manage staff', desc: 'Names, PINs & recovery code', adminOnly: true },
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
      {/* Which build this phone is actually running. When someone reports
          something odd, this is the difference between guessing and knowing
          whether they're on current code. */}
      <div className="muted" style={{ textAlign: 'center', marginTop: 6 }}>
        Build {typeof __BUILD_ID__ === 'string' ? __BUILD_ID__.slice(0, 7) : 'dev'}
      </div>
    </>
  )
}
