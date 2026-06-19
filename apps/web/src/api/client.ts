import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string ?? 'http://localhost:3000'

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${session.access_token}`,
  }
  if (options.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers as Record<string, string>,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `API error ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
