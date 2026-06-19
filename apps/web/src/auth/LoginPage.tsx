import { useState } from 'react'
import { useAuth } from './AuthProvider'

type Props = {
  onSwitchToSignup: () => void
}

export function LoginPage({ onSwitchToSignup }: Props) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div style={container}>
      <div style={card}>
        <h1 style={title}>Narrasmith</h1>
        <p style={subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} style={form}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={input}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={input}
          />

          {error && <div style={errorBox}>{error}</div>}

          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={switchText}>
          Don't have an account?{' '}
          <button onClick={onSwitchToSignup} style={linkBtn}>Sign up</button>
        </p>
      </div>
    </div>
  )
}

const container: React.CSSProperties = {
  width: '100vw', height: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#fafafa', fontFamily: 'system-ui, sans-serif',
}

const card: React.CSSProperties = {
  width: 380, padding: '40px 36px',
  background: '#fff', borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
}

const title: React.CSSProperties = {
  margin: 0, fontSize: 28, fontWeight: 800, color: '#18181b',
  letterSpacing: -0.5, textAlign: 'center',
}

const subtitle: React.CSSProperties = {
  margin: '8px 0 28px', fontSize: 14, color: '#71717a', textAlign: 'center',
}

const form: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14,
}

const input: React.CSSProperties = {
  padding: '10px 14px', border: '1px solid #d4d4d8', borderRadius: 8,
  fontSize: 14, color: '#18181b', background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  padding: '11px 20px', borderRadius: 8,
  border: 'none', background: '#18181b', color: '#fff',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
  marginTop: 4,
}

const errorBox: React.CSSProperties = {
  padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: 6, fontSize: 13, color: '#dc2626',
}

const switchText: React.CSSProperties = {
  marginTop: 20, fontSize: 13, color: '#71717a', textAlign: 'center',
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#6366f1',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0,
}
