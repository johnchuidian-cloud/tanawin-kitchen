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

/**
 * The production CSP, mirrored onto `vite preview` so it can be exercised
 * locally before it reaches anyone.
 *
 * `public/_headers` is the real source — Cloudflare applies it, Vite doesn't —
 * so these two must be kept in step. It's applied here as ENFORCING even
 * though it ships report-only first: locally a violation should break loudly,
 * which is the whole point of testing it here rather than on a cook's phone.
 *
 * Deliberately NOT on `server` (dev): Vite's HMR needs inline scripts and a
 * websocket, so the production policy would block dev rather than test it.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https:",
  "font-src 'self'",
  "connect-src 'self' https://gzijmkzwnfebgaqxcrbh.supabase.co",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  "form-action 'self'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildStamp()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  preview: {
    headers: {
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    },
  },
})
