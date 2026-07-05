export default function Placeholder({ title }) {
  return (
    <>
      <h2 className="title">{title}</h2>
      <div className="muted">Coming next.</div>
      <div className="placeholder">
        This screen isn't built yet — we'll wire it up screen by screen.
      </div>
    </>
  )
}
