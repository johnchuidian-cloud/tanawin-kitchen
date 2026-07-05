// Hand-drawn avatar portraits for the Tanawin Kitchen team (requested per
// person). Keyed by first name (lowercase); anyone without a portrait falls
// back to their role emoji, so new staff still get an icon.

const ROLE_EMOJI = { admin: '👑', staff: '👷', guest: '👁️' }

function Lexi() {
  // A horse 🐴 — brown head, dark forelock, cream muzzle.
  return (
    <svg viewBox="0 0 40 40" aria-label="Lexi">
      <circle cx="20" cy="20" r="20" fill="#F1E4D6" />
      <path d="M11.5 10.5 L14 3.5 L17.5 9.5 Z" fill="#8C5A33" />
      <path d="M28.5 10.5 L26 3.5 L22.5 9.5 Z" fill="#8C5A33" />
      <path d="M12.5 9 L14.2 5 L16.4 8.6 Z" fill="#E5C6A8" />
      <path d="M27.5 9 L25.8 5 L23.6 8.6 Z" fill="#E5C6A8" />
      <ellipse cx="20" cy="20.5" rx="10" ry="13.5" fill="#A9714B" />
      <ellipse cx="20" cy="28" rx="7.2" ry="5.6" fill="#E5C6A8" />
      <circle cx="17.2" cy="28.5" r="1.15" fill="#6E4B38" />
      <circle cx="22.8" cy="28.5" r="1.15" fill="#6E4B38" />
      <path d="M20 6.5 C15.5 8.5 14.8 13 16.6 15 C17.8 12 22.2 12 23.4 15 C25.2 13 24.5 8.5 20 6.5 Z" fill="#5B3A21" />
      <circle cx="15.2" cy="18.5" r="1.7" fill="#2b1a12" />
      <circle cx="24.8" cy="18.5" r="1.7" fill="#2b1a12" />
      <circle cx="15.7" cy="18" r="0.5" fill="#fff" />
      <circle cx="25.3" cy="18" r="0.5" fill="#fff" />
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

function Sherill() {
  // Light-brown hair, terracotta apron over a cream shirt.
  return (
    <svg viewBox="0 0 40 40" aria-label="Sherill">
      <circle cx="20" cy="20" r="20" fill="#F1E9DC" />
      <path d="M10.8 16 C10.8 7 29.2 7 29.2 16 L29.2 28.5 C29.2 31.8 25.6 31.8 25.6 28.5 L25.6 17.5 L14.4 17.5 L14.4 28.5 C14.4 31.8 10.8 31.8 10.8 28.5 Z" fill="#A97C50" />
      <circle cx="20" cy="18.5" r="8.3" fill="#EDBE96" />
      <path d="M11.9 16.6 C11.9 8.4 28.1 8.4 28.1 16.6 C25.8 12.6 23.5 12.4 20.9 12.9 C21.5 11.6 21.3 10.7 20.5 10 C18.9 12.4 13.9 12 11.9 16.6 Z" fill="#A97C50" />
      <circle cx="16.9" cy="18.8" r="1.35" fill="#2b1a12" />
      <circle cx="23.1" cy="18.8" r="1.35" fill="#2b1a12" />
      <path d="M17.2 22.3 Q20 24.4 22.8 22.3" stroke="#2b1a12" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M11 40 C11 31.5 29 31.5 29 40 Z" fill="#F4F1E7" />
      <path d="M15.5 40 C15.5 33.5 24.5 33.5 24.5 40 Z" fill="#CC7459" />
      <path d="M16.3 34.6 L14 31.6 M23.7 34.6 L26 31.6" stroke="#CC7459" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function Janice() {
  // Dark-brown hair, green apron over a cream shirt.
  return (
    <svg viewBox="0 0 40 40" aria-label="Janice">
      <circle cx="20" cy="20" r="20" fill="#F1E9DC" />
      <path d="M10.8 16 C10.8 7 29.2 7 29.2 16 L29.2 28.5 C29.2 31.8 25.6 31.8 25.6 28.5 L25.6 17.5 L14.4 17.5 L14.4 28.5 C14.4 31.8 10.8 31.8 10.8 28.5 Z" fill="#4E342E" />
      <circle cx="20" cy="18.5" r="8.3" fill="#E8B080" />
      <path d="M11.9 16.6 C11.9 8.4 28.1 8.4 28.1 16.6 C26.4 12.9 22.6 12.2 19.1 13.1 C16.4 13.8 13.5 13.4 11.9 16.6 Z" fill="#4E342E" />
      <circle cx="16.9" cy="18.8" r="1.35" fill="#2b1a12" />
      <circle cx="23.1" cy="18.8" r="1.35" fill="#2b1a12" />
      <path d="M17.2 22.3 Q20 24.4 22.8 22.3" stroke="#2b1a12" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M11 40 C11 31.5 29 31.5 29 40 Z" fill="#F4F1E7" />
      <path d="M15.5 40 C15.5 33.5 24.5 33.5 24.5 40 Z" fill="#5F7A5F" />
      <path d="M16.3 34.6 L14 31.6 M23.7 34.6 L26 31.6" stroke="#5F7A5F" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

const PORTRAITS = { lexi: Lexi, monique: Monique, disang: Disang, sherill: Sherill, janice: Janice }

export default function Avatar({ name, role, className }) {
  const Portrait = PORTRAITS[(name || '').trim().toLowerCase()]
  return (
    <span className={className}>
      {Portrait ? <Portrait /> : ROLE_EMOJI[role] ?? '👤'}
    </span>
  )
}
