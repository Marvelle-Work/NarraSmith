import 'dotenv/config'

function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

export const env = {
  SUPABASE_URL:              required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  PORT:                      Number(process.env['PORT'] ?? 3000),
} as const
