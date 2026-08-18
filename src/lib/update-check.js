/**
 * "Update available" check.
 *
 * Every deploy used to end with "tell the team to fully close and reopen the
 * app" — until they did, they ran old code without knowing. This notices for
 * them. It only ever OFFERS a refresh: the cooks may have a count half-typed
 * or an approval in flight, and reloading under them would destroy real work.
 *
 * Mechanism (Kitchen has a build step): vite bakes __BUILD_ID__ into the
 * bundle and writes the same value to /version.json. If what the server serves
 * stops matching what we're running, a new build is out.
 *
 * Everything here fails silent. A failed check is never worth an error message
 * to a cook mid-service.
 */

const CHECK_EVERY_MS = 5 * 60 * 1000
// Two checks closer together than this are treated as one — stops a flurry of
// visibilitychange events causing a burst of requests.
const MIN_GAP_MS = 30 * 1000
const DISMISSED_KEY = 'tanawin-kitchen.updateDismissed'

const runningBuild = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null

let baseline = null // what the server served when this page loaded
let lastCheckedAt = 0

/**
 * Read the deployed build id.
 *
 * The SPA fallback (not_found_handling: "single-page-application") means a
 * missing /version.json returns index.html with a 200 — verified in
 * production. So the response is parsed by hand and anything that isn't the
 * expected shape is treated as "no information", never as a new version.
 *
 * Cache-busting is both the no-store hint AND a unique query per request:
 * Cloudflare's edge will happily return a stale copy for a repeated identical
 * URL, which would leave this silently never firing.
 */
async function fetchDeployedBuild() {
  const bust = Math.random().toString(36).slice(2)
  const res = await fetch(`/version.json?x=${bust}`, { cache: 'no-store' })
  if (!res.ok) return null
  const text = await res.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null // HTML from the SPA fallback, or anything else unparseable
  }
  return typeof parsed?.build === 'string' && parsed.build ? parsed.build : null
}

function dismissedBuild() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/** Dismiss applies to THIS build only — a newer one asks again. */
export function dismissUpdate(build) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, build)
  } catch {
    /* private mode: the banner simply comes back next check */
  }
}

/**
 * Start watching. Calls onUpdate(build) when a newer build is being served.
 * Returns a stop function.
 *
 * The check on load only establishes the baseline and never raises a banner:
 * during the minute or two after a deploy, one request can get the new
 * version.json while the page itself came from an older cached copy, and
 * announcing that would be crying wolf.
 */
export function watchForUpdates(onUpdate) {
  let stopped = false

  const check = async () => {
    if (stopped || document.hidden) return // never poll a hidden tab
    const now = Date.now()
    if (now - lastCheckedAt < MIN_GAP_MS) return
    lastCheckedAt = now

    let deployed
    try {
      deployed = await fetchDeployedBuild()
    } catch {
      return // offline, blocked, 500 — say nothing
    }
    if (stopped || !deployed) return

    if (baseline === null) {
      baseline = deployed // load check: baseline only
      return
    }

    // Either the server moved on since we loaded, or we're demonstrably
    // running a bundle that isn't the one being served — the second catches a
    // page that loaded an old cached bundle to begin with.
    const movedOn = deployed !== baseline
    const weAreStale = runningBuild != null && deployed !== runningBuild
    if (!movedOn && !weAreStale) return

    baseline = deployed
    if (dismissedBuild() === deployed) return // already said no to this one
    onUpdate(deployed)
  }

  check()
  const interval = setInterval(check, CHECK_EVERY_MS)
  const onVisible = () => {
    if (!document.hidden) check() // the "phone woke up" case
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    stopped = true
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
