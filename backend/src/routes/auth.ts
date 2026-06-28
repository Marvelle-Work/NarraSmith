import type { FastifyInstance } from 'fastify'
import { Resend } from 'resend'
import { env } from '../env.js'
import { db } from '../db.js'

const resend = new Resend(env.RESEND_API_KEY)

// In-memory per-email cooldown for /auth/send-verification
const resendCooldowns = new Map<string, number>()
const RESEND_COOLDOWN_MS = 60_000

type VerificationType = 'signup' | 'recovery' | 'invite' | 'email_change' | 'magic_link'

function emailContent(type: VerificationType, actionUrl: string): { subject: string; html: string } {
  const configs: Record<VerificationType, { subject: string; btnLabel: string }> = {
    signup:       { subject: 'Verify your Narrasmith account',    btnLabel: 'Verify Email' },
    recovery:     { subject: 'Reset your Narrasmith password',    btnLabel: 'Reset Password' },
    invite:       { subject: "You've been invited to Narrasmith", btnLabel: 'Accept Invite' },
    email_change: { subject: 'Confirm your new email address',    btnLabel: 'Confirm Email' },
    magic_link:   { subject: 'Sign in to Narrasmith',            btnLabel: 'Sign In' },
  }
  const { subject, btnLabel } = configs[type] ?? configs['signup']
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#fafafa;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#18181b;">Narrasmith</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;">${subject.replace('Narrasmith', '').trim()}</p>
    <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">${btnLabel}</a>
    <p style="margin:28px 0 0;font-size:12px;color:#a1a1aa;">This link expires in 24 hours. If you did not request this, you can safely ignore this email.</p>
  </div>
</body>
</html>`
  return { subject, html }
}

export default async function authRoutes(app: FastifyInstance) {
  // ── Supabase "Send Email" hook ──────────────────────────────────────────
  // Supabase calls this instead of sending emails itself.
  // Configure: Supabase Dashboard → Authentication → Hooks → Send Email
  // Set the hook URL to: {BACKEND_URL}/auth/email-hook
  // Set the hook secret to: EMAIL_HOOK_SECRET (same value as your env var)
  app.post('/auth/email-hook', async (req, reply) => {
    // ── DIAGNOSTIC: hard log BEFORE any auth check ───────────────────────
    // If this log never appears, Supabase is NOT calling this endpoint.
    // Check: Dashboard → Authentication → Hooks → Send Email
    req.log.warn({
      url: req.url,
      method: req.method,
      hasAuthHeader: !!req.headers['authorization'],
      authHeaderPrefix: ((req.headers['authorization'] as string | undefined) ?? '').slice(0, 20) || '(none)',
      bodyKeys: Object.keys((req.body as Record<string, unknown>) ?? {}),
    }, '[EMAIL_HOOK] 🔥 HIT — Supabase called the email hook')
    // ─────────────────────────────────────────────────────────────────────

    const hookSecret = env.EMAIL_HOOK_SECRET
    if (hookSecret) {
      const authHeader = (req.headers['authorization'] as string | undefined) ?? ''
      const authorized = authHeader === `Bearer ${hookSecret}`
      req.log.warn({
        authorized,
        secretLength: hookSecret.length,
        receivedPrefix: authHeader.slice(0, 20) || '(none)',
      }, authorized
        ? '[EMAIL_HOOK] Auth check PASSED'
        : '[EMAIL_HOOK] ❌ Auth check FAILED — secret mismatch. Supabase Dashboard secret does not match EMAIL_HOOK_SECRET env var.'
      )
      if (!authorized) {
        // Returning 401 causes Supabase to fall back to internal email → rate limits.
        // If you see this log, fix the hook secret in the Supabase Dashboard.
        return reply.code(401).send({ error: 'Unauthorized' })
      }
    } else {
      req.log.warn('[EMAIL_HOOK] EMAIL_HOOK_SECRET is not set — accepting unauthenticated hook calls (set in production)')
    }

    const body = req.body as {
      user?: { email?: string }
      email_data?: {
        token_hash?: string
        redirect_to?: string
        verification_type?: string
      }
    }

    const userEmail = body?.user?.email
    const emailData = body?.email_data

    req.log.info({
      userEmail,
      verificationType: emailData?.verification_type,
      hasTokenHash: !!emailData?.token_hash,
      redirectTo: emailData?.redirect_to,
    }, '[EMAIL_HOOK] Payload parsed')

    if (!userEmail || !emailData?.token_hash || !emailData.verification_type) {
      req.log.error({ body }, '[EMAIL_HOOK] ❌ Unexpected payload shape — returning 200 to avoid blocking auth, but NOT sending email')
      // Always return 200 to Supabase; non-2xx blocks the auth operation entirely
      return reply.code(200).send({})
    }

    const verifyUrl = new URL(`${env.SUPABASE_URL}/auth/v1/verify`)
    verifyUrl.searchParams.set('token_hash', emailData.token_hash)
    verifyUrl.searchParams.set('type', emailData.verification_type)
    verifyUrl.searchParams.set('redirect_to', emailData.redirect_to || env.FRONTEND_URL)

    const type = emailData.verification_type as VerificationType
    const { subject, html } = emailContent(type, verifyUrl.toString())

    req.log.info({ to: userEmail, subject, type }, '[EMAIL_HOOK] Sending via Resend')

    const { error } = await resend.emails.send({ from: env.RESEND_FROM, to: [userEmail], subject, html })
    if (error) {
      req.log.error({ error, email: userEmail }, '[EMAIL_HOOK] ❌ Resend send failed')
    } else {
      req.log.info({ email: userEmail, type }, '[EMAIL_HOOK] ✅ Resend send succeeded')
    }

    // Must return 200 + empty JSON for Supabase to treat the hook as successful
    return reply.code(200).send({})
  })

  // ── Manual resend verification ──────────────────────────────────────────
  // Called by the frontend "Resend email" button. Generates a fresh
  // Supabase signup link via admin API, then sends it via Resend.
  // 60s per-email cooldown prevents abuse.
  app.post<{ Body: { email: string } }>(
    '/auth/send-verification',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    },
    async (req, reply) => {
      const { email } = req.body

      const lastSent = resendCooldowns.get(email) ?? 0
      const elapsed = Date.now() - lastSent
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return reply.code(429).send({ error: 'Please wait before requesting another email.', retryAfter })
      }

      // 'magiclink' doesn't require the user's password and verifies their
      // email when clicked — correct for resending to an unconfirmed user.
      const { data, error: linkError } = await db.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: env.FRONTEND_URL },
      })

      if (linkError || !data?.properties?.action_link) {
        req.log.error({ linkError, email }, 'send-verification: generateLink failed')
        return reply.code(500).send({ error: 'Could not generate verification link. The address may already be confirmed.' })
      }

      // Record cooldown before sending so a Resend failure doesn't let the
      // user retry immediately with a freshly-generated (now-invalidated) token
      resendCooldowns.set(email, Date.now())

      const { subject, html } = emailContent('signup', data.properties.action_link)
      const { error: sendError } = await resend.emails.send({
        from: env.RESEND_FROM,
        to: [email],
        subject,
        html,
      })

      if (sendError) {
        req.log.error({ sendError, email }, 'send-verification: Resend send failed')
        return reply.code(500).send({ error: 'Failed to send email. Please try again later.' })
      }

      return { ok: true }
    },
  )
}
