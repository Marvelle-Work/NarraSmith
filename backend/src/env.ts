import 'dotenv/config'

function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
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
