import { createClient } from '@supabase/supabase-js'

// Values come from .env.local (never commit that file).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Demo mode: an in-memory stand-in with fictional data, for portfolio
// screenshots. VITE_DEMO is a build-time constant, so when it isn't '1' this
// whole branch — and the dynamically imported demo code and fixtures — is
// dead-code-eliminated from the bundle. It must NEVER be set in any deploy
// environment: Kitchen's real database is Finance's LIVE one.
const DEMO = import.meta.env.VITE_DEMO === '1'

if (!DEMO && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    'Supabase keys missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local'
  )
}

export const supabase = DEMO
  ? (await import('../demo/demoClient.js')).makeDemoClient()
  : createClient(supabaseUrl, supabaseAnonKey)
