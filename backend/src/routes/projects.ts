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
    const { error } = await db
      .from('projects')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', req.userId)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
