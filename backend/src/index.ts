import Fastify from 'fastify'
import cors from '@fastify/cors'
import { env } from './env.js'
import { authenticate, verifyProjectOwnership } from './hooks.js'
import { db } from './db.js'
import projectsRoutes from './routes/projects.js'
import importRoutes from './routes/import.js'
import nodeTypesRoutes from './routes/node-types.js'
import nodesRoutes from './routes/nodes.js'
import relationshipTypesRoutes from './routes/relationship-types.js'
import relationshipsRoutes from './routes/relationships.js'
import syncRoutes from './routes/sync.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

const app = Fastify({ logger: true })

app.decorateRequest('userId', '')

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})

app.get('/health', async () => ({ status: 'ok' }))

app.get<{ Params: { shareId: string } }>('/shared/:shareId', async (req, reply) => {
  const { data, error } = await db
    .from('projects')
    .select('project_data, name')
    .eq('share_id', req.params.shareId)
    .eq('visibility', 'view')
    .single()
  if (error || !data) return reply.code(404).send({ error: 'Not found' })
  return data.project_data ?? {}
})

app.register(async (api) => {
  api.addHook('preHandler', authenticate)

  api.register(projectsRoutes, { prefix: '/projects' })
  api.register(importRoutes)

  // All routes below this point also run verifyProjectOwnership,
  // which confirms the caller owns the project before touching its data.
  api.register(async (projectApi) => {
    projectApi.addHook('preHandler', verifyProjectOwnership)
    projectApi.register(syncRoutes)
    projectApi.register(nodeTypesRoutes,         { prefix: '/node-types' })
    projectApi.register(nodesRoutes,             { prefix: '/nodes' })
    projectApi.register(relationshipTypesRoutes, { prefix: '/relationship-types' })
    projectApi.register(relationshipsRoutes,     { prefix: '/relationships' })
  }, { prefix: '/projects/:projectId' })
})

app.listen({ port: env.PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})
