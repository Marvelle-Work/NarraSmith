import { createClient } from '@supabase/supabase-js'
import type { Database } from '@narrasmith/shared-types'
import { env } from './env.js'

// Service-role client: bypasses RLS, for server-side use only.
// Never expose this client or its key to the browser.
export const db = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
