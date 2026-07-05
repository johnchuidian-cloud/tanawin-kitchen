import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/recipes', label: 'Recipes', icon: '🍳' },
  { to: '/purchases', label: 'Purchases', icon: '🧾' },
  { to: '/more', label: 'More', icon: '☰' },
]

export default function BottomNav() {
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => (isActive ? 'on' : undefined)}
        >
          <span className="ni">{t.icon}</span>
          <span className="nl">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
