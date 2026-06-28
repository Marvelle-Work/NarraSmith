import type { FastifyInstance } from 'fastify'
import type { Json } from '@narrasmith/shared-types'
import { db } from '../db.js'

type CanonicalBody = {
  state: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    schemaVersion: 2
    graph: unknown
    entitySchema: unknown[]
    relSchema: unknown[]
    conceptSchema: unknown[]
    assets: Array<{ id: string; kind?: string; [key: string]: unknown }>
  }
  version: number
}

export default async function syncRoutes(app: FastifyInstance) {
  // ── Canonical save: write the full blob directly, no relational expansion ──
  app.put<{
    Params: { projectId: string }
    Body: CanonicalBody
  }>('/canonical', async (req, reply) => {
    const { projectId } = req.params
    const { state, version } = req.body

    const { data: project } = await db
      .from('projects')
      .select('project_data_version')
      .eq('id', projectId)
      .single()

    if (project && project.project_data_version > version) {
      return reply.code(409).send({
        error: 'Version conflict: server has a newer version.',
        serverVersion: project.project_data_version,
      })
    }

    const allAssets = state.assets ?? []
    const notebooks = allAssets.filter(a => a.kind === 'notebook')

    req.log.info({
      projectId,
      totalAssets: allAssets.length,
      notebookCount: notebooks.length,
      notebookIds: notebooks.map(n => n.id),
    }, '[CANONICAL] Writing project_data blob')

    const newVersion = (version ?? 0) + 1

    const { error } = await db
      .from('projects')
      .update({
        project_data: state as unknown as Json,
        project_data_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    if (error) {
      req.log.error({ error }, '[CANONICAL] project_data write failed')
      return reply.code(500).send({ error: error.message })
    }

    req.log.info({ projectId, newVersion, notebookCount: notebooks.length }, '[CANONICAL] project_data written')
    return { version: newVersion }
  })

  // ── /sync is deprecated — returns 410 and logs loudly ────────────────────
  // Any hit here is a regression: the client should only call /canonical.
  app.put('/sync', async (req, reply) => {
    req.log.warn({
      projectId: (req.params as { projectId: string }).projectId,
      userId: req.userId,
      payloadKeys: Object.keys((req.body as Record<string, unknown>) ?? {}),
    }, '[SYNC] DEPRECATED endpoint hit — regression detected. Use /canonical instead.')

    return reply.code(410).send({
      error: 'SYNC_DEPRECATED',
      message: 'Use /canonical instead',
    })
  })
}
