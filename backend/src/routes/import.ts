import type { FastifyInstance } from 'fastify'
import type { Json } from '@narrasmith/shared-types'
import { createHash } from 'crypto'
import { db } from '../db.js'

type SchemaField = {
  id: string
  name: string
  description?: string
  defaultValue?: string
  isBlock?: boolean
}

type EntitySchema = {
  id: string
  name: string
  parentId?: string
  fields: SchemaField[]
  conceptSchemaIds?: string[]
}

type RelSchema = {
  id: string
  name: string
  parentId?: string
  description?: string
  defaultColor?: string
}

type ConceptSchema = {
  id: string
  name: string
  description?: string
  fields: SchemaField[]
}

type ImportNode = {
  id: string
  type?: string
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
}

type ImportEdge = {
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
  style?: Record<string, unknown>
}

type ImportBody = {
  format: 'narrasmith-project' | 'narrasmith-fragment'
  version: number
  name?: string
  project?: { id?: string; name?: string; createdAt?: string }
  entitySchema?: EntitySchema[]
  relationshipSchema?: RelSchema[]
  conceptSchema?: ConceptSchema[]
  graph?: { nodes: ImportNode[]; edges: ImportEdge[]; rootNodeId?: string }
  nodes?: ImportNode[]
  edges?: ImportEdge[]
}

type ImportStats = {
  projectId: string
  nodeTypesCreated: number
  relationshipTypesCreated: number
  conceptTypesCreated: number
  nodesCreated: number
  relationshipsCreated: number
}

export default async function importRoutes(app: FastifyInstance) {
  app.post<{ Body: ImportBody }>('/import-project', async (req, reply) => {
    const body = req.body

    // ── Validate format ──────────────────────────────────────────────
    if (!body.format || !['narrasmith-project', 'narrasmith-fragment'].includes(body.format)) {
      return reply.code(400).send({ error: 'Invalid format. Expected narrasmith-project or narrasmith-fragment.' })
    }
    if (body.version !== 1) {
      return reply.code(400).send({ error: `Unsupported version: ${body.version}` })
    }

    const nodes: ImportNode[] = body.format === 'narrasmith-fragment'
      ? (body.nodes ?? [])
      : (body.graph?.nodes ?? [])
    const edges: ImportEdge[] = body.format === 'narrasmith-fragment'
      ? (body.edges ?? [])
      : (body.graph?.edges ?? [])
    const entitySchemas: EntitySchema[] = body.entitySchema ?? []
    const relSchemas: RelSchema[] = body.relationshipSchema ?? []
    const conceptSchemas: ConceptSchema[] = body.conceptSchema ?? []

    if (!Array.isArray(nodes)) {
      return reply.code(400).send({ error: 'nodes must be an array.' })
    }
    if (!Array.isArray(edges)) {
      return reply.code(400).send({ error: 'edges must be an array.' })
    }

    // ── Deduplication via import_hash ─────────────────────────────────
    const importHash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex')

    const { data: existing } = await db
      .from('projects')
      .select('id')
      .eq('owner_id', req.userId)
      .eq('import_hash', importHash)
      .single()

    if (existing) {
      return reply.code(409).send({
        error: 'This content has already been imported.',
        projectId: existing.id,
      })
    }

    // ── Step 1: Create project ───────────────────────────────────────
    const projectName = body.project?.name ?? body.name ?? 'Imported Project'
    const { data: project, error: projErr } = await db
      .from('projects')
      .insert({
        owner_id: req.userId,
        name: projectName,
        import_hash: importHash,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (projErr || !project) {
      return reply.code(500).send({ error: projErr?.message ?? 'Failed to create project' })
    }

    const projectId = project.id
    const stats: ImportStats = {
      projectId,
      nodeTypesCreated: 0,
      relationshipTypesCreated: 0,
      conceptTypesCreated: 0,
      nodesCreated: 0,
      relationshipsCreated: 0,
    }

    try {
      // ── Step 2: Map and insert node_types ────────────────────────────
      const nodeTypeMap = new Map<string, string>()

      if (entitySchemas.length > 0) {
        const nodeTypeRows = entitySchemas.map(s => ({
          project_id: projectId,
          name: s.name,
          schema_json: {
            fields: s.fields,
            conceptSchemaIds: s.conceptSchemaIds,
          },
        }))

        const { data: inserted, error } = await db
          .from('node_types')
          .insert(nodeTypeRows)
          .select('id, name')

        if (error) throw new Error(`node_types insert failed: ${error.message}`)

        for (let i = 0; i < entitySchemas.length; i++) {
          if (inserted?.[i]) {
            nodeTypeMap.set(entitySchemas[i].id, inserted[i].id)
          }
        }
        stats.nodeTypesCreated = inserted?.length ?? 0
      }

      // ── Step 2b: Handle parent_id references for node_types ──────────
      const parentUpdates: { id: string; parent_id: string }[] = []
      for (const s of entitySchemas) {
        if (s.parentId && nodeTypeMap.has(s.parentId)) {
          const newId = nodeTypeMap.get(s.id)
          const newParentId = nodeTypeMap.get(s.parentId)
          if (newId && newParentId) {
            parentUpdates.push({ id: newId, parent_id: newParentId })
          }
        }
      }
      for (const upd of parentUpdates) {
        await db.from('node_types').update({ parent_id: upd.parent_id }).eq('id', upd.id)
      }

      // ── Step 2c: Map and insert relationship_types ───────────────────
      const relTypeMap = new Map<string, string>()

      if (relSchemas.length > 0) {
        const relTypeRows = relSchemas.map(s => ({
          project_id: projectId,
          name: s.name,
          description: s.description ?? null,
          default_color: s.defaultColor ?? null,
        }))

        const { data: inserted, error } = await db
          .from('relationship_types')
          .insert(relTypeRows)
          .select('id, name')

        if (error) throw new Error(`relationship_types insert failed: ${error.message}`)

        for (let i = 0; i < relSchemas.length; i++) {
          if (inserted?.[i]) {
            relTypeMap.set(relSchemas[i].id, inserted[i].id)
          }
        }
        stats.relationshipTypesCreated = inserted?.length ?? 0
      }

      // ── Step 2d: Handle parent_id references for relationship_types ──
      const relParentUpdates: { id: string; parent_id: string }[] = []
      for (const s of relSchemas) {
        if (s.parentId && relTypeMap.has(s.parentId)) {
          const newId = relTypeMap.get(s.id)
          const newParentId = relTypeMap.get(s.parentId)
          if (newId && newParentId) {
            relParentUpdates.push({ id: newId, parent_id: newParentId })
          }
        }
      }
      for (const upd of relParentUpdates) {
        await db.from('relationship_types').update({ parent_id: upd.parent_id }).eq('id', upd.id)
      }

      // ── Step 2e: Map and insert concept_types ────────────────────────
      const conceptTypeMap = new Map<string, string>()

      if (conceptSchemas.length > 0) {
        const conceptRows = conceptSchemas.map(s => ({
          project_id: projectId,
          name: s.name,
          description: s.description ?? null,
          schema_json: { fields: s.fields },
        }))

        const { data: inserted, error } = await db
          .from('concept_types')
          .insert(conceptRows)
          .select('id, name')

        if (error) throw new Error(`concept_types insert failed: ${error.message}`)

        for (let i = 0; i < conceptSchemas.length; i++) {
          if (inserted?.[i]) {
            conceptTypeMap.set(conceptSchemas[i].id, inserted[i].id)
          }
        }
        stats.conceptTypesCreated = inserted?.length ?? 0
      }

      // ── Step 3: Build node ID map ──────────────────────────────────
      const nodeMap = new Map<string, string>()
      for (const n of nodes) {
        nodeMap.set(n.id, crypto.randomUUID())
      }

      // ── Step 4a: Insert nodes ──────────────────────────────────────
      if (nodes.length > 0) {
        const fallbackTypeId = nodeTypeMap.values().next().value

        const nodeRows = nodes.map((n, i) => {
          const mappedTypeId = n.data.typeId ? nodeTypeMap.get(n.data.typeId) : undefined

          return {
            id: nodeMap.get(n.id)!,
            project_id: projectId,
            node_type_id: mappedTypeId ?? fallbackTypeId ?? crypto.randomUUID(),
            title: n.data.label ?? 'Untitled',
            position_x: n.position?.x ?? 100 + (i % 5) * 200,
            position_y: n.position?.y ?? 100 + Math.floor(i / 5) * 200,
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

        const { error } = await db.from('nodes').insert(nodeRows)
        if (error) throw new Error(`nodes insert failed: ${error.message}`)
        stats.nodesCreated = nodeRows.length
      }

      // ── Step 4b: Insert relationships ──────────────────────────────
      if (edges.length > 0) {
        const relRows = edges
          .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
          .map(e => {
            const mappedRelTypeId = e.data?.relationshipTypeId
              ? relTypeMap.get(e.data.relationshipTypeId)
              : undefined

            const fallbackRelTypeId = relTypeMap.values().next().value

            return {
              id: crypto.randomUUID(),
              project_id: projectId,
              source_node_id: nodeMap.get(e.source)!,
              target_node_id: nodeMap.get(e.target)!,
              relationship_type_id: mappedRelTypeId ?? fallbackRelTypeId ?? crypto.randomUUID(),
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

        if (relRows.length > 0) {
          const { error } = await db.from('relationships').insert(relRows)
          if (error) throw new Error(`relationships insert failed: ${error.message}`)
          stats.relationshipsCreated = relRows.length
        }
      }

      // ── Step 5: Rebuild project_data snapshot (cache) ──────────────
      const snapshot = await rebuildProjectSnapshot(projectId, nodeTypeMap, relTypeMap, conceptTypeMap)
      await db
        .from('projects')
        .update({
          project_data: snapshot as unknown as Json,
          project_data_version: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)

      req.log.info(stats, 'Import completed')
      return reply.code(201).send(stats)
    } catch (err) {
      req.log.error({ error: err }, 'Import failed, cleaning up')
      await db.from('projects').delete().eq('id', projectId)
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Import failed',
      })
    }
  })
}

async function rebuildProjectSnapshot(
  projectId: string,
  nodeTypeMap: Map<string, string>,
  relTypeMap: Map<string, string>,
  conceptTypeMap: Map<string, string>,
): Promise<Record<string, unknown>> {
  const [nodesRes, relsRes, nodeTypesRes, relTypesRes, conceptTypesRes] = await Promise.all([
    db.from('nodes').select('*').eq('project_id', projectId),
    db.from('relationships').select('*').eq('project_id', projectId),
    db.from('node_types').select('*').eq('project_id', projectId),
    db.from('relationship_types').select('*').eq('project_id', projectId),
    db.from('concept_types').select('*').eq('project_id', projectId),
  ])

  const entitySchema = (nodeTypesRes.data ?? []).map(nt => ({
    id: nt.id,
    name: nt.name,
    parentId: nt.parent_id ?? undefined,
    fields: (nt.schema_json as any)?.fields ?? [],
    conceptSchemaIds: (nt.schema_json as any)?.conceptSchemaIds ?? undefined,
  }))

  const relSchema = (relTypesRes.data ?? []).map(rt => ({
    id: rt.id,
    name: rt.name,
    description: rt.description ?? undefined,
    defaultColor: rt.default_color ?? undefined,
    parentId: rt.parent_id ?? undefined,
  }))

  const conceptSchema = (conceptTypesRes.data ?? []).map(ct => ({
    id: ct.id,
    name: ct.name,
    description: ct.description ?? undefined,
    fields: (ct.schema_json as any)?.fields ?? [],
  }))

  const graphNodes = (nodesRes.data ?? []).map(n => {
    const props = (n.properties_json ?? {}) as Record<string, any>
    return {
      id: n.id,
      type: 'circle',
      position: { x: n.position_x ?? 0, y: n.position_y ?? 0 },
      data: {
        label: n.title,
        entityType: props.entityType ?? 'Character',
        typeId: n.node_type_id,
        fields: props.fields ?? {},
        description: props.description ?? '',
        color: props.color ?? undefined,
        sizeLevel: props.sizeLevel ?? 3,
        concepts: props.concepts ?? undefined,
      },
    }
  })

  const graphEdges = (relsRes.data ?? []).map(r => {
    const props = (r.properties_json ?? {}) as Record<string, any>
    return {
      id: r.id,
      source: r.source_node_id,
      target: r.target_node_id,
      label: props.label ?? undefined,
      type: 'relationship',
      data: {
        labelT: props.labelT ?? 0.5,
        color: props.color ?? undefined,
        schemaColor: props.schemaColor ?? undefined,
        relationshipTypeId: r.relationship_type_id,
        description: props.description ?? undefined,
        whyItMatters: props.whyItMatters ?? undefined,
      },
      style: props.schemaColor
        ? { stroke: props.schemaColor, strokeWidth: 2 }
        : props.color
          ? { stroke: props.color, strokeWidth: 2 }
          : undefined,
    }
  })

  return {
    id: projectId,
    name: (await db.from('projects').select('name').eq('id', projectId).single()).data?.name ?? 'Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    graph: { nodes: graphNodes, edges: graphEdges },
    entitySchema,
    relSchema,
    conceptSchema,
  }
}
