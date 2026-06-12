import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from './db.js'

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing Bearer token' })
  }
  const { data: { user }, error } = await db.auth.getUser(header.slice(7))
  if (error || !user) {
    return reply.code(401).send({ error: 'Invalid or expired token' })
  }
  request.userId = user.id
}

// Runs inside /projects/:projectId scope — confirms the project exists and belongs to the caller.
export async function verifyProjectOwnership(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { projectId } = request.params as { projectId: string }
  const { data } = await db
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', request.userId)
    .single()
  if (!data) {
    return reply.code(404).send({ error: 'Project not found' })
  }
}
