// The Tanawin wordmark: the flower/starburst sits ABOVE the i (as its dot —
// dotless ı + positioned ✸), not inline, so it can't read as a letter.
export default function Wordmark() {
  return (
    <div className="logo-mark">
      Tanaw
      <span className="logo-i">
        ı<span className="flower">✸</span>
      </span>
      n
    </div>
  )
}
