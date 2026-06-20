import type { FastifyInstance } from 'fastify'
import type { Json } from '@narrasmith/shared-types'
import { db } from '../db.js'
import { rebuildProjectSnapshot } from '../lib/snapshot.js'

type SyncBody = {
  graph: {
    nodes: Array<{
      id: string
      position?: { x: number; y: number }
      data: {
        label: string
        entityType: string
        typeId?: string
        fields?: Record<string, unknown>
        description?: string
        color?: string
        sizeLevel?: number
        concepts?: Record<string, unknown[]>
      }
    }>
    edges: Array<{
      id: string
      source: string
      target: string
      label?: string
      data?: {
        labelT?: number
        color?: string
        schemaColor?: string
        relationshipTypeId?: string
        description?: string
        whyItMatters?: string
      }
    }>
    rootNodeId?: string
  }
  entitySchema: Array<{
    id: string
    name: string
    parentId?: string
    fields: Array<{
      id: string
      name: string
      description?: string
      defaultValue?: string
      isBlock?: boolean
    }>
    conceptSchemaIds?: string[]
  }>
  relSchema: Array<{
    id: string
    name: string
    parentId?: string
    description?: string
    defaultColor?: string
  }>
  conceptSchema: Array<{
    id: string
    name: string
    description?: string
    fields: Array<{
      id: string
      name: string
      description?: string
      defaultValue?: string
      isBlock?: boolean
    }>
  }>
  version: number
}

export default async function syncRoutes(app: FastifyInstance) {
  app.put<{
    Params: { projectId: string }
    Body: SyncBody
  }>('/sync', async (req, reply) => {
    const { projectId } = req.params
    const { graph, entitySchema, relSchema, conceptSchema, version } = req.body

    // ── Optimistic concurrency check ─────────────────────────────────
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

    // ── Load existing relational state ───────────────────────────────
    const [
      existingNodeTypes,
      existingNodes,
      existingRelTypes,
      existingRels,
      existingConcepts,
    ] = await Promise.all([
      db.from('node_types').select('id, client_id').eq('project_id', projectId),
      db.from('nodes').select('id, client_id').eq('project_id', projectId),
      db.from('relationship_types').select('id, client_id').eq('project_id', projectId),
      db.from('relationships').select('id, client_id').eq('project_id', projectId),
      db.from('concept_types').select('id, client_id').eq('project_id', projectId),
    ])

    const existingNodeTypeByClientId = new Map(
      (existingNodeTypes.data ?? []).map(r => [r.client_id, r.id]),
    )
    const existingNodeByClientId = new Map(
      (existingNodes.data ?? []).map(r => [r.client_id, r.id]),
    )
    const existingRelTypeByClientId = new Map(
      (existingRelTypes.data ?? []).map(r => [r.client_id, r.id]),
    )
    const existingRelByClientId = new Map(
      (existingRels.data ?? []).map(r => [r.client_id, r.id]),
    )
    const existingConceptByClientId = new Map(
      (existingConcepts.data ?? []).map(r => [r.client_id, r.id]),
    )

    try {
      // ── 1. Upsert node_types ─────────────────────────────────────────
      const nodeTypeClientToUuid = new Map<string, string>()

      if (entitySchema.length > 0) {
        const rows = entitySchema.map(s => ({
          id: existingNodeTypeByClientId.get(s.id) ?? crypto.randomUUID(),
          client_id: s.id,
          project_id: projectId,
          name: s.name,
          schema_json: {
            fields: s.fields,
            conceptSchemaIds: s.conceptSchemaIds,
          },
        }))

        req.log.debug({ nodeTypeRows: rows }, 'node_types upsert payload')

        const { data: upserted, error } = await db
          .from('node_types')
          .upsert(rows, { onConflict: 'project_id,client_id' })
          .select('id, client_id')

        if (error) throw new Error(`node_types upsert failed: ${error.message}`)

        for (const row of upserted ?? []) {
          nodeTypeClientToUuid.set(row.client_id, row.id)
        }
      }

      // ── 2. Upsert relationship_types ─────────────────────────────────
      const relTypeClientToUuid = new Map<string, string>()

      if (relSchema.length > 0) {
        const rows = relSchema.map(s => ({
          id: existingRelTypeByClientId.get(s.id) ?? crypto.randomUUID(),
          client_id: s.id,
          project_id: projectId,
          name: s.name,
          description: s.description ?? null,
          default_color: s.defaultColor ?? null,
        }))

        const { data: upserted, error } = await db
          .from('relationship_types')
          .upsert(rows, { onConflict: 'project_id,client_id' })
          .select('id, client_id')

        if (error) throw new Error(`relationship_types upsert failed: ${error.message}`)

        for (const row of upserted ?? []) {
          relTypeClientToUuid.set(row.client_id, row.id)
        }
      }

      // ── 3. Upsert concept_types ──────────────────────────────────────
      if (conceptSchema.length > 0) {
        const rows = conceptSchema.map(s => ({
          id: existingConceptByClientId.get(s.id) ?? crypto.randomUUID(),
          client_id: s.id,
          project_id: projectId,
          name: s.name,
          description: s.description ?? null,
          schema_json: { fields: s.fields },
        }))

        const { error } = await db
          .from('concept_types')
          .upsert(rows, { onConflict: 'project_id,client_id' })

        if (error) throw new Error(`concept_types upsert failed: ${error.message}`)
      }

      // ── 4. Resolve parent_id references for types ────────────────────
      for (const s of entitySchema) {
        if (s.parentId) {
          const selfUuid = nodeTypeClientToUuid.get(s.id)
          const parentUuid = nodeTypeClientToUuid.get(s.parentId)
          if (selfUuid && parentUuid) {
            await db.from('node_types')
              .update({ parent_id: parentUuid })
              .eq('id', selfUuid)
          }
        }
      }
      for (const s of relSchema) {
        if (s.parentId) {
          const selfUuid = relTypeClientToUuid.get(s.id)
          const parentUuid = relTypeClientToUuid.get(s.parentId)
          if (selfUuid && parentUuid) {
            await db.from('relationship_types')
              .update({ parent_id: parentUuid })
              .eq('id', selfUuid)
          }
        }
      }

      // ── 5. Upsert nodes ──────────────────────────────────────────────
      const nodeClientToUuid = new Map<string, string>()

      if (graph.nodes.length > 0) {
        const fallbackTypeUuid = nodeTypeClientToUuid.values().next().value

        const rows = graph.nodes.map(n => {
          const typeUuid = n.data.typeId
            ? nodeTypeClientToUuid.get(n.data.typeId)
            : undefined

          return {
            id: existingNodeByClientId.get(n.id) ?? crypto.randomUUID(),
            client_id: n.id,
            project_id: projectId,
            node_type_id: typeUuid ?? fallbackTypeUuid ?? crypto.randomUUID(),
            title: n.data.label ?? 'Untitled',
            position_x: n.position?.x ?? 0,
            position_y: n.position?.y ?? 0,
            properties_json: {
              entityType: n.data.entityType,
              fields: n.data.fields ?? {},
              description: n.data.description ?? '',
              color: n.data.color ?? null,
              sizeLevel: n.data.sizeLevel ?? 3,
              concepts: n.data.concepts ?? null,
            } as Record<string, Json>,
          }
        })

        const { data: upserted, error } = await db
          .from('nodes')
          .upsert(rows, { onConflict: 'project_id,client_id' })
          .select('id, client_id')

        if (error) throw new Error(`nodes upsert failed: ${error.message}`)

        for (const row of upserted ?? []) {
          nodeClientToUuid.set(row.client_id, row.id)
        }
      }

      // ── 6. Upsert relationships ──────────────────────────────────────
      if (graph.edges.length > 0) {
        const fallbackRelTypeUuid = relTypeClientToUuid.values().next().value

        const rows = graph.edges
          .filter(e => nodeClientToUuid.has(e.source) && nodeClientToUuid.has(e.target))
          .map(e => {
            const relTypeUuid = e.data?.relationshipTypeId
              ? relTypeClientToUuid.get(e.data.relationshipTypeId)
              : undefined

            return {
              id: existingRelByClientId.get(e.id) ?? crypto.randomUUID(),
              client_id: e.id,
              project_id: projectId,
              source_node_id: nodeClientToUuid.get(e.source)!,
              target_node_id: nodeClientToUuid.get(e.target)!,
              relationship_type_id: relTypeUuid ?? fallbackRelTypeUuid ?? crypto.randomUUID(),
              properties_json: {
                label: e.label ?? null,
                labelT: e.data?.labelT ?? 0.5,
                color: e.data?.color ?? null,
                schemaColor: e.data?.schemaColor ?? null,
                description: e.data?.description ?? null,
                whyItMatters: e.data?.whyItMatters ?? null,
              } as Record<string, Json>,
            }
          })

        if (rows.length > 0) {
          const { error } = await db
            .from('relationships')
            .upsert(rows, { onConflict: 'project_id,client_id' })

          if (error) throw new Error(`relationships upsert failed: ${error.message}`)
        }
      }

      // ── 7. Delete removed records (FK-safe order) ────────────────────
      const incomingRelClientIds = new Set(graph.edges.map(e => e.id))
      const incomingNodeClientIds = new Set(graph.nodes.map(n => n.id))
      const incomingNodeTypeClientIds = new Set(entitySchema.map(s => s.id))
      const incomingRelTypeClientIds = new Set(relSchema.map(s => s.id))
      const incomingConceptClientIds = new Set(conceptSchema.map(s => s.id))

      const relsToDelete = [...existingRelByClientId.entries()]
        .filter(([cid]) => !incomingRelClientIds.has(cid))
        .map(([, uuid]) => uuid)
      const nodesToDelete = [...existingNodeByClientId.entries()]
        .filter(([cid]) => !incomingNodeClientIds.has(cid))
        .map(([, uuid]) => uuid)
      const nodeTypesToDelete = [...existingNodeTypeByClientId.entries()]
        .filter(([cid]) => !incomingNodeTypeClientIds.has(cid))
        .map(([, uuid]) => uuid)
      const relTypesToDelete = [...existingRelTypeByClientId.entries()]
        .filter(([cid]) => !incomingRelTypeClientIds.has(cid))
        .map(([, uuid]) => uuid)
      const conceptsToDelete = [...existingConceptByClientId.entries()]
        .filter(([cid]) => !incomingConceptClientIds.has(cid))
        .map(([, uuid]) => uuid)

      if (relsToDelete.length > 0) {
        await db.from('relationships').delete().in('id', relsToDelete)
      }
      if (nodesToDelete.length > 0) {
        await db.from('nodes').delete().in('id', nodesToDelete)
      }
      if (nodeTypesToDelete.length > 0) {
        await db.from('node_types').delete().in('id', nodeTypesToDelete)
      }
      if (relTypesToDelete.length > 0) {
        await db.from('relationship_types').delete().in('id', relTypesToDelete)
      }
      if (conceptsToDelete.length > 0) {
        await db.from('concept_types').delete().in('id', conceptsToDelete)
      }

      // ── 8. Rebuild snapshot and update project ───────────────────────
      const snapshot = await rebuildProjectSnapshot(projectId)
      const newVersion = (version ?? 0) + 1

      const { error: updateErr } = await db
        .from('projects')
        .update({
          project_data: snapshot as unknown as Json,
          project_data_version: newVersion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)

      if (updateErr) throw new Error(`project update failed: ${updateErr.message}`)

      return { version: newVersion }
    } catch (err) {
      req.log.error({ error: err }, 'Sync failed')
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Sync failed',
      })
    }
  })
}
