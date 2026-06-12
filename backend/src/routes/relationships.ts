import type { FastifyInstance } from 'fastify'
import type { Json, InsertRelationship, UpdateRelationship } from '@narrasmith/shared-types'
import { db } from '../db.js'

type P = { projectId: string }
type PI = P & { id: string }
type CreateBody = {
  source_node_id: string
  target_node_id: string
  relationship_type_id: string
  properties_json?: Record<string, Json> | null
}
type UpdateBody = { properties_json?: Record<string, Json> | null }

export default async function relationshipsRoutes(app: FastifyInstance) {
  app.get<{ Params: P }>('/', async (req, reply) => {
    const { data, error } = await db
      .from('relationships')
      .select('*')
      .eq('project_id', req.params.projectId)
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  app.post<{ Params: P; Body: CreateBody }>('/', async (req, reply) => {
    const { data, error } = await db
      .from('relationships')
      .insert({ ...req.body, project_id: req.params.projectId } as InsertRelationship)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.get<{ Params: PI }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('relationships')
      .select('*')
      .eq('id', req.params.id)
      .eq('project_id', req.params.projectId)
      .single()
    if (error) return reply.code(404).send({ error: 'Not found' })
    return data
  })

  app.patch<{ Params: PI; Body: UpdateBody }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('relationships')
      .update(req.body as UpdateRelationship)
      .eq('id', req.params.id)
      .eq('project_id', req.params.projectId)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    if (!data) return reply.code(404).send({ error: 'Not found' })
    return data
  })

  app.delete<{ Params: PI }>('/:id', async (req, reply) => {
    const { error } = await db
      .from('relationships')
      .delete()
      .eq('id', req.params.id)
      .eq('project_id', req.params.projectId)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
