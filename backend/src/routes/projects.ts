import type { FastifyInstance } from 'fastify'
import type { InsertProject, UpdateProject } from '@narrasmith/shared-types'
import { db } from '../db.js'

type CreateBody = { name: string; description?: string | null }
type UpdateBody = { name?: string; description?: string | null }

export default async function projectsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('owner_id', req.userId)
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  app.post<{ Body: CreateBody }>('/', async (req, reply) => {
    const { data, error } = await db
      .from('projects')
      .insert({ ...req.body, owner_id: req.userId } as InsertProject)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('owner_id', req.userId)
      .single()
    if (error) return reply.code(404).send({ error: 'Not found' })
    return data
  })

  app.patch<{ Params: { id: string }; Body: UpdateBody }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('projects')
      .update(req.body as UpdateProject)
      .eq('id', req.params.id)
      .eq('owner_id', req.userId)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    if (!data) return reply.code(404).send({ error: 'Not found' })
    return data
  })

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    req.log.info({ projectId: req.params.id, userId: req.userId }, 'DELETE /projects/:id')
    const { error, count } = await db
      .from('projects')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', req.userId)
    if (error) {
      req.log.error({ error }, 'DELETE failed')
      return reply.code(500).send({ error: error.message })
    }
    return reply.code(204).send()
  })

  // ── Project data blob ──────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>('/:id/data', async (req, reply) => {
    const { data, error } = await db
      .from('projects')
      .select('project_data, project_data_version')
      .eq('id', req.params.id)
      .eq('owner_id', req.userId)
      .single()
    if (error || !data) return reply.code(404).send({ error: 'Not found' })
    return { projectData: data.project_data, version: data.project_data_version }
  })

  app.put<{ Params: { id: string }; Body: { projectData: unknown; version: number } }>(
    '/:id/data',
    async (req, reply) => {
      req.log.info({ projectId: req.params.id, userId: req.userId }, 'PUT /projects/:id/data received')
      const blob = req.body.projectData as Record<string, unknown> | null
      const { data, error } = await db
        .from('projects')
        .update({
          project_data: blob as any,
          project_data_version: (req.body.version ?? 0) + 1,
          name: (blob as any)?.name ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .eq('owner_id', req.userId)
        .select('project_data_version')
        .single()
      if (error) return reply.code(500).send({ error: error.message })
      if (!data) return reply.code(404).send({ error: 'Not found' })
      return { version: data.project_data_version }
    },
  )

  // ── Share links ────────────────────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/:id/share', async (req, reply) => {
    const shareId = crypto.randomUUID()
    const { data, error } = await db
      .from('projects')
      .update({ share_id: shareId, visibility: 'view' })
      .eq('id', req.params.id)
      .eq('owner_id', req.userId)
      .select('share_id')
      .single()
    if (error || !data) return reply.code(500).send({ error: error?.message ?? 'Failed' })
    return { shareId: data.share_id }
  })

  app.post<{ Params: { id: string } }>('/:id/unshare', async (req, reply) => {
    const { error } = await db
      .from('projects')
      .update({ share_id: null, visibility: 'private' })
      .eq('id', req.params.id)
      .eq('owner_id', req.userId)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
