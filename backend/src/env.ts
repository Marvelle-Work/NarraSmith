import 'dotenv/config'

// ── ENV DIAGNOSTICS ────────────────────────────────────────────────────────
// Fires before any required() call so we can see exactly what Railway injected.
const WATCHED_KEYS = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY', 'RESEND_FROM', 'FRONTEND_URL',
  'EMAIL_HOOK_SECRET', 'PORT', 'NODE_ENV',
]
console.log('ENV CHECK', {
  cwd: process.cwd(),
  watchedKeys: Object.fromEntries(
    WATCHED_KEYS.map(k => [k, process.env[k] ? `${process.env[k]!.slice(0, 12)}... (len=${process.env[k]!.length})` : '❌ MISSING']),
  ),
  allSupabaseKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('SUPABASE')),
  totalEnvVarCount: Object.keys(process.env).length,
})
// ────────────────────────────────────────────────────────────────────────────

function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    console.error(`💥 FATAL: Missing required env var: ${key}`)
    console.error('Set this variable in Railway → Variables before deploying.')
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

export const env = {
  SUPABASE_URL:              required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  RESEND_API_KEY:            required('RESEND_API_KEY'),
  RESEND_FROM:               required('RESEND_FROM'),
  FRONTEND_URL:              required('FRONTEND_URL'),
  // Optional — if empty the email hook is unauthenticated (dev only)
  EMAIL_HOOK_SECRET:         process.env['EMAIL_HOOK_SECRET'] ?? '',
  PORT:                      Number(process.env['PORT'] ?? 3000),
} as const
