import Fastify from 'fastify'
import { env } from './env.js'
import { authenticate, verifyProjectOwnership } from './hooks.js'
import projectsRoutes from './routes/projects.js'
import nodeTypesRoutes from './routes/node-types.js'
import nodesRoutes from './routes/nodes.js'
import relationshipTypesRoutes from './routes/relationship-types.js'
import relationshipsRoutes from './routes/relationships.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

const app = Fastify({ logger: true })

app.decorateRequest('userId', '')

app.get('/health', async () => ({ status: 'ok' }))

app.register(async (api) => {
  api.addHook('preHandler', authenticate)

  api.register(projectsRoutes, { prefix: '/projects' })

  // All routes below this point also run verifyProjectOwnership,
  // which confirms the caller owns the project before touching its data.
  api.register(async (projectApi) => {
    projectApi.addHook('preHandler', verifyProjectOwnership)
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
