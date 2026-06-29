import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '../lib/supabase'

type Props = {
  onSwitchToLogin: () => void
}

export function SignupPage({ onSwitchToLogin }: Props) {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error: err } = await signUp(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSuccess(true)
    }
  }

  const handleResend = async () => {
    setResendState('sending')
    setResendError(null)
    try {
      // Calls Supabase directly, which re-triggers the Send Email hook → Resend.
      // This keeps the canonical path: Supabase → hook → Railway → Resend → inbox.
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) {
        setResendError(error.message)
        setResendState('error')
        return
      }
      setResendState('sent')
      setResendCooldown(60)
      const tick = setInterval(() => {
        setResendCooldown(c => {
          if (c <= 1) { clearInterval(tick); setResendState('idle'); return 0 }
          return c - 1
        })
      }, 1000)
    } catch {
      setResendError('Network error. Please try again.')
      setResendState('error')
    }
  }

  if (success) {
    return (
      <div style={container}>
        <div style={card}>
          <h1 style={title}>Narrasmith</h1>
          <p style={successMsg}>Check your email for a confirmation link.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resendState === 'sent' && (
              <p style={{ margin: 0, fontSize: 13, color: '#16a34a', textAlign: 'center' }}>
                Email resent!
              </p>
            )}
            {resendError && (
              <p style={{ margin: 0, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>
                {resendError}
              </p>
            )}
            <button
              onClick={handleResend}
              disabled={resendState === 'sending' || resendCooldown > 0}
              style={{ ...secondaryBtn, opacity: (resendState === 'sending' || resendCooldown > 0) ? 0.5 : 1 }}
            >
              {resendState === 'sending'
                ? 'Sending...'
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend verification email'}
            </button>
            <button onClick={onSwitchToLogin} style={primaryBtn}>Back to Sign In</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={container}>
      <div style={card}>
        <h1 style={title}>Narrasmith</h1>
        <p style={subtitle}>Create your account</p>

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
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm Password"
            required
            style={input}
          />

          {error && <div style={errorBox}>{error}</div>}

          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={switchText}>
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} style={linkBtn}>Sign in</button>
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

const successMsg: React.CSSProperties = {
  margin: '16px 0 24px', fontSize: 14, color: '#16a34a', textAlign: 'center',
  padding: '12px', background: '#f0fdf4', borderRadius: 8,
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

const secondaryBtn: React.CSSProperties = {
  padding: '11px 20px', borderRadius: 8,
  border: '1px solid #d4d4d8', background: '#fff', color: '#18181b',
  fontWeight: 600, fontSize: 14, cursor: 'pointer',
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
