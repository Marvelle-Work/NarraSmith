import type { FastifyInstance } from 'fastify'
import type { Json, InsertNode, UpdateNode } from '@narrasmith/shared-types'
import { db } from '../db.js'

type P = { projectId: string }
type PI = P & { id: string }
type CreateBody = {
  node_type_id: string
  title: string
  properties_json?: Record<string, Json> | null
  position_x?: number | null
  position_y?: number | null
}
type UpdateBody = Partial<Omit<CreateBody, 'node_type_id'>> & { node_type_id?: string }

export default async function nodesRoutes(app: FastifyInstance) {
  app.get<{ Params: P }>('/', async (req, reply) => {
    const { data, error } = await db
      .from('nodes')
      .select('*')
      .eq('project_id', req.params.projectId)
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  app.post<{ Params: P; Body: CreateBody }>('/', async (req, reply) => {
    const { data, error } = await db
      .from('nodes')
      .insert({ ...req.body, project_id: req.params.projectId } as InsertNode)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.get<{ Params: PI }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('nodes')
      .select('*')
      .eq('id', req.params.id)
      .eq('project_id', req.params.projectId)
      .single()
    if (error) return reply.code(404).send({ error: 'Not found' })
    return data
  })

  app.patch<{ Params: PI; Body: UpdateBody }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('nodes')
      .update(req.body as UpdateNode)
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
      .from('nodes')
      .delete()
      .eq('id', req.params.id)
      .eq('project_id', req.params.projectId)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
