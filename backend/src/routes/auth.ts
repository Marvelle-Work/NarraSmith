import type { FastifyInstance } from 'fastify'
import { Resend } from 'resend'
import { env } from '../env.js'

const resend = new Resend(env.RESEND_API_KEY)

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
  // ── Diagnostic probe — visit in browser to confirm route is live ─────────
  app.get('/auth/email-hook', async (_req, reply) => {
    return reply.send({
      ok: true,
      hookSecretConfigured: !!env.EMAIL_HOOK_SECRET,
      resendConfigured: !!env.RESEND_API_KEY,
      resendFrom: env.RESEND_FROM,
      ts: new Date().toISOString(),
    })
  })

  // ── Supabase "Send Email" hook ────────────────────────────────────────────
  // Canonical email path: Supabase Auth → this endpoint → Resend → inbox.
  // Configure in: Supabase Dashboard → Auth → Hooks → Send Email
  //   URL:    {BACKEND_URL}/auth/email-hook
  //   Secret: leave empty (or set to match EMAIL_HOOK_SECRET in Railway)
  app.post('/auth/email-hook', async (req, reply) => {
    console.log('🔥 EMAIL HOOK HIT')

    // Log all request headers, masking anything that looks like a credential.
    const MASKED = new Set(['authorization', 'x-hook-secret', 'x-api-key', 'svix-signature'])
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : (v ?? '')
        return [k, MASKED.has(k.toLowerCase()) ? val.slice(0, 12) + '…(masked)' : val]
      }),
    )
    console.log('[EMAIL_HOOK] headers:', headers)

    try {
      // ── Auth check (warn-only) ──────────────────────────────────────────
      // NEVER return non-2xx: Supabase falls back to its internal sender on failure → rate limits.
      // To enable auth: populate the "Secret" field in Supabase Dashboard → Auth → Hooks → Send Email.
      // Supabase will then send: Authorization: Bearer {secret}
      if (env.EMAIL_HOOK_SECRET) {
        const auth = (req.headers['authorization'] as string | undefined) ?? ''
        if (auth === `Bearer ${env.EMAIL_HOOK_SECRET}`) {
          console.log('[EMAIL_HOOK] auth: ✅ passed')
        } else {
          console.warn('[EMAIL_HOOK] auth: ⚠️ mismatch — processing anyway', {
            received: auth.slice(0, 20) || '(none)',
          })
        }
      }

      // ── Parse Supabase payload ──────────────────────────────────────────
      // Supabase "Send Email" hook schema (GoTrue v2, 2024+):
      //   { user: { id, email, ... }, email_data: { token, token_hash, redirect_to,
      //     email_action_type, site_url, token_new, token_hash_new }, metadata: {} }
      const body = req.body as {
        user?: {
          id?: string
          email?: string
          created_at?: string
        }
        email_data?: {
          token?: string          // raw OTP (older field)
          token_hash?: string     // hashed OTP (preferred)
          token_new?: string
          token_hash_new?: string
          redirect_to?: string
          email_action_type?: string   // e.g. "signup", "recovery", "invite"
          verification_type?: string   // alias used in some Supabase versions
          site_url?: string
        }
        metadata?: Record<string, unknown>
      }

      const userEmail = body?.user?.email
      const emailData = body?.email_data

      // email_action_type is the canonical field; fall back to verification_type.
      const actionType = emailData?.email_action_type ?? emailData?.verification_type
      // token_hash is preferred; fall back to token (raw OTP, older field).
      const tokenHash = emailData?.token_hash ?? emailData?.token

      // Log sanitized payload so we can see exactly what Supabase sends.
      console.log('[EMAIL_HOOK] payload:', {
        userId: body?.user?.id,
        email: userEmail ? userEmail.replace(/^(.{3}).*(@.*)$/, '$1…$2') : '(missing)',
        email_action_type: emailData?.email_action_type,
        verification_type: emailData?.verification_type,
        resolvedActionType: actionType,
        token_hash: tokenHash ? tokenHash.slice(0, 8) + '…(masked)' : '(missing)',
        redirect_to: emailData?.redirect_to,
        site_url: emailData?.site_url,
        token_hash_new: emailData?.token_hash_new ? '(present)' : undefined,
        metadata: body?.metadata,
        // all keys present in email_data — reveals unexpected field names
        emailDataKeys: Object.keys(emailData ?? {}),
      })

      if (!userEmail || !tokenHash || !actionType) {
        console.error('[EMAIL_HOOK] ❌ missing required fields — cannot send email', {
          hasEmail: !!userEmail,
          hasTokenHash: !!tokenHash,
          hasActionType: !!actionType,
          bodyTopLevelKeys: Object.keys(body ?? {}),
          emailDataKeys: Object.keys(emailData ?? {}),
        })
        // Return 200 so Supabase does not fall back to its internal sender.
        return reply.code(200).send({})
      }

      // ── Build Supabase verification URL ────────────────────────────────
      const verifyUrl = new URL(`${env.SUPABASE_URL}/auth/v1/verify`)
      verifyUrl.searchParams.set('token_hash', tokenHash)
      verifyUrl.searchParams.set('type', actionType)
      verifyUrl.searchParams.set(
        'redirect_to',
        emailData?.redirect_to ?? emailData?.site_url ?? env.FRONTEND_URL,
      )

      const type = actionType as VerificationType
      const { subject, html } = emailContent(type, verifyUrl.toString())

      console.log('[EMAIL_HOOK] sending via Resend', {
        to: userEmail.replace(/^(.{3}).*(@.*)$/, '$1…$2'),
        subject,
        type,
        verifyUrlHost: verifyUrl.host,
      })

      // ── Send via Resend ─────────────────────────────────────────────────
      const { data: sendData, error: sendError } = await resend.emails.send({
        from: env.RESEND_FROM,
        to: [userEmail],
        subject,
        html,
      })

      if (sendError) {
        console.error('[EMAIL_HOOK] ❌ Resend error:', sendError)
      } else {
        console.log('[EMAIL_HOOK] ✅ Resend succeeded', { id: sendData?.id, type })
      }

    } catch (err) {
      // Catch-all: never let an exception produce a non-200 response.
      console.error('[EMAIL_HOOK] ❌ unexpected exception (returning 200):', err)
    }

    // Supabase expects a 200 with an empty body on success.
    return reply.code(200).send({})
  })
}
