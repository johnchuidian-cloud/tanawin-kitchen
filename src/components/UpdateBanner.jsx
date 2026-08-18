import { useEffect, useState } from 'react'
import { watchForUpdates, dismissUpdate } from '../lib/update-check.js'

/**
 * Tells someone running an old build that a newer one is deployed.
 *
 * Deliberately NOT a modal and it never reloads on its own: a cook may be
 * halfway through a stock count and staff may have an approval in flight.
 * The person picks the moment.
 *
 * Wording is fixed across the whole Tanawin suite ("Update available" /
 * "Refresh") so it reads as one family of apps.
 */
export default function UpdateBanner() {
  const [build, setBuild] = useState(null)

  useEffect(() => watchForUpdates(setBuild), [])

  if (!build) return null

  return (
    <div className="update-banner" role="status">
      <span className="ub-text">Update available</span>
      <button className="ub-refresh" onClick={() => location.reload()}>
        Refresh
      </button>
      <button
        className="ub-dismiss"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={() => {
          dismissUpdate(build)
          setBuild(null)
        }}
      >
        ×
      </button>
    </div>
  )
}
