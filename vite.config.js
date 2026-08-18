import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Identity of this build, for the "Update available" check.
 *
 * A commit SHA is preferred over a timestamp: rebuilding the same commit then
 * produces the same id, so a redeploy with no code change doesn't nag everyone
 * to refresh for nothing. The timestamp is only a last resort.
 */
function buildId() {
  const fromCI =
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA
  if (fromCI) return fromCI.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return String(Date.now())
  }
}

const BUILD_ID = buildId()

/**
 * Stamps the build id in two places that must agree:
 *   - baked into the bundle as __BUILD_ID__ (what the running code IS)
 *   - written to /version.json (what the server currently SERVES)
 * The update check compares them.
 */
function buildStamp() {
  return {
    name: 'tanawin-build-stamp',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          build: BUILD_ID,
          // Not used by the check (which compares `build` only) — it's there
          // so anyone can ask the live site when it was last deployed without
          // digging through Cloudflare.
          builtAt: new Date().toISOString(),
        }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildStamp()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
})
