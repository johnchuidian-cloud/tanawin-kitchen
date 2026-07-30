// Hand-drawn avatar portraits for the Tanawin Kitchen team (requested per
// person). Keyed by first name (lowercase); anyone without a portrait falls
// back to their role emoji, so new staff still get an icon.

const ROLE_EMOJI = { admin: '👑', staff: '👷', guest: '👁️' }

function Lexi() {
  // A flower 🌸 in the brand palette — terracotta petals, amber heart,
  // little leaves; a nod to the starburst over the Tanawin "i".
  const petals = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg viewBox="0 0 40 40" aria-label="Lexi">
      <circle cx="20" cy="20" r="20" fill="#F1E4D6" />
      <path d="M12 30.5 C8.5 29.5 7 26.5 7.5 24 C11 24.5 13 27 13.2 29.8 Z" fill="#5F7A5F" />
      <path d="M28 30.5 C31.5 29.5 33 26.5 32.5 24 C29 24.5 27 27 26.8 29.8 Z" fill="#5F7A5F" />
      {petals.map((a, i) => (
        <ellipse
          key={a}
          cx="20"
          cy="10.8"
          rx="4"
          ry="6.6"
          fill={i % 2 ? '#B14C2E' : '#CC7459'}
          transform={`rotate(${a} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="6.2" fill="#C98A1E" />
      <circle cx="17.8" cy="19.2" r="1.1" fill="#2b1a12" />
      <circle cx="22.2" cy="19.2" r="1.1" fill="#2b1a12" />
      <path d="M17.7 21.8 Q20 23.6 22.3 21.8" stroke="#2b1a12" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Monique() {
  // Chef — long dark hair tucked in a hairnet, whites underneath.
  return (
    <svg viewBox="0 0 40 40" aria-label="Monique">
      <circle cx="20" cy="20" r="20" fill="#F5EDE4" />
      <path d="M10.5 15.5 C10.5 6.5 29.5 6.5 29.5 15.5 L29.5 30 C29.5 33.4 25.7 33.4 25.7 30 L25.7 18 L14.3 18 L14.3 30 C14.3 33.4 10.5 33.4 10.5 30 Z" fill="#3E2723" />
      <circle cx="20" cy="18.5" r="8.3" fill="#EDBE96" />
      <path d="M12 16.2 C12 8.2 28 8.2 28 16.2 C24.5 13.4 15.5 13.4 12 16.2 Z" fill="#3E2723" />
      <path d="M12.6 14.6 Q20 10.4 27.4 14.6" stroke="#D9CABB" strokeWidth="0.9" fill="none" />
      <path d="M13.6 12.2 Q20 8.8 26.4 12.2" stroke="#D9CABB" strokeWidth="0.9" fill="none" />
      <path d="M16 13.4 Q17.5 10.2 20 9.6 M24 13.4 Q22.5 10.2 20 9.6" stroke="#D9CABB" strokeWidth="0.7" fill="none" />
      <circle cx="16.9" cy="18.8" r="1.35" fill="#2b1a12" />
      <circle cx="23.1" cy="18.8" r="1.35" fill="#2b1a12" />
      <path d="M17.2 22.3 Q20 24.4 22.8 22.3" stroke="#2b1a12" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M11 40 C11 31.5 29 31.5 29 40 Z" fill="#FBFAF6" />
      <path d="M20 32 L20 39" stroke="#E8E2D0" strokeWidth="1" />
    </svg>
  )
}

function Disang() {
  // Chef — pixie cut, chef whites with collar buttons.
  return (
    <svg viewBox="0 0 40 40" aria-label="Disang">
      <circle cx="20" cy="20" r="20" fill="#F5EDE4" />
      <circle cx="20" cy="19" r="8.3" fill="#E8B080" />
      <path d="M11.6 19.5 C10.6 9 26 6.2 28.6 13.6 C29.4 16 28.8 18.6 28.3 19.8 C27.6 16.6 26.6 15 25.4 13.8 C21.8 15.4 15.4 15 13.6 13.2 C12.4 14.8 12 17 11.6 19.5 Z" fill="#2E1B12" />
      <path d="M13.6 13.2 C15 10 19 8.6 20.6 8.9 C19.4 10 19 11.4 19.2 12.2 Z" fill="#2E1B12" />
      <circle cx="16.9" cy="19.3" r="1.35" fill="#2b1a12" />
      <circle cx="23.1" cy="19.3" r="1.35" fill="#2b1a12" />
      <path d="M17.2 22.8 Q20 24.9 22.8 22.8" stroke="#2b1a12" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M11 40 C11 31.5 29 31.5 29 40 Z" fill="#FBFAF6" />
      <path d="M20 31.5 L17.5 35 L20 40 L22.5 35 Z" fill="#E8E2D0" />
      <circle cx="20" cy="35.5" r="0.7" fill="#6E6759" />
      <circle cx="20" cy="38" r="0.7" fill="#6E6759" />
    </svg>
  )
}



// Sherill/Janice portraits retired 2026-07 (accounts renamed to shift logins,
// which fall back to the 👷 icon by design).
const PORTRAITS = { lexi: Lexi, monique: Monique, disang: Disang }

export default function Avatar({ name, role, className }) {
  const Portrait = PORTRAITS[(name || '').trim().toLowerCase()]
  return (
    <span className={className}>
      {Portrait ? <Portrait /> : ROLE_EMOJI[role] ?? '👤'}
    </span>
  )
}
