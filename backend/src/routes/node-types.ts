import type { FastifyInstance } from 'fastify'
import type { NodeTypeSchema, InsertNodeType, UpdateNodeType } from '@narrasmith/shared-types'
import { db } from '../db.js'

type P = { projectId: string }
type PI = P & { id: string }
type CreateBody = { name: string; icon?: string | null; color?: string | null; schema_json: NodeTypeSchema }
type UpdateBody = Partial<CreateBody>

export default async function nodeTypesRoutes(app: FastifyInstance) {
  app.get<{ Params: P }>('/', async (req, reply) => {
    const { data, error } = await db
      .from('node_types')
      .select('*')
      .eq('project_id', req.params.projectId)
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  app.post<{ Params: P; Body: CreateBody }>('/', async (req, reply) => {
    const { data, error } = await db
      .from('node_types')
      .insert({ ...req.body, project_id: req.params.projectId } as InsertNodeType)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.get<{ Params: PI }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('node_types')
      .select('*')
      .eq('id', req.params.id)
      .eq('project_id', req.params.projectId)
      .single()
    if (error) return reply.code(404).send({ error: 'Not found' })
    return data
  })

  app.patch<{ Params: PI; Body: UpdateBody }>('/:id', async (req, reply) => {
    const { data, error } = await db
      .from('node_types')
      .update(req.body as UpdateNodeType)
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
      .from('node_types')
      .delete()
      .eq('id', req.params.id)
      .eq('project_id', req.params.projectId)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
