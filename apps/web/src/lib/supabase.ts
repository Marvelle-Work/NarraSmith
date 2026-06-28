import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// Diagnostic: confirms which Supabase project this build is connected to.
// Visible in browser DevTools → Console on any page load.
console.log('🟡 SUPABASE CLIENT INIT', {
  url: supabaseUrl,
  anonKeyPrefix: supabaseAnonKey.slice(0, 20) + '...',
})

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
