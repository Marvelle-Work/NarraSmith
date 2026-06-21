import type { Json } from '@narrasmith/shared-types'
import { db } from '../db.js'

export async function rebuildProjectSnapshot(
  projectId: string,
): Promise<Record<string, unknown>> {
  const [nodesRes, relsRes, nodeTypesRes, relTypesRes, conceptTypesRes, projectRes] =
    await Promise.all([
      db.from('nodes').select('*').eq('project_id', projectId),
      db.from('relationships').select('*').eq('project_id', projectId),
      db.from('node_types').select('*').eq('project_id', projectId),
      db.from('relationship_types').select('*').eq('project_id', projectId),
      db.from('concept_types').select('*').eq('project_id', projectId),
      db.from('projects').select('name, created_at').eq('id', projectId).single(),
    ])

  // UUID → client_id lookups for FK resolution
  const nodeTypeClientId = new Map(
    (nodeTypesRes.data ?? []).map(nt => [nt.id, nt.client_id]),
  )
  const nodeClientId = new Map(
    (nodesRes.data ?? []).map(n => [n.id, n.client_id]),
  )
  const relTypeClientId = new Map(
    (relTypesRes.data ?? []).map(rt => [rt.id, rt.client_id]),
  )

  const entitySchema = (nodeTypesRes.data ?? []).map(nt => ({
    id: nt.client_id,
    name: nt.name,
    parentId: nt.parent_id ? nodeTypeClientId.get(nt.parent_id) ?? undefined : undefined,
    fields: (nt.schema_json as any)?.fields ?? [],
    conceptSchemaIds: (nt.schema_json as any)?.conceptSchemaIds ?? undefined,
  }))

  const relSchema = (relTypesRes.data ?? []).map(rt => ({
    id: rt.client_id,
    name: rt.name,
    description: rt.description ?? undefined,
    defaultColor: rt.default_color ?? undefined,
    parentId: rt.parent_id ? relTypeClientId.get(rt.parent_id) ?? undefined : undefined,
  }))

  const conceptSchema = (conceptTypesRes.data ?? []).map(ct => ({
    id: ct.client_id,
    name: ct.name,
    description: ct.description ?? undefined,
    fields: (ct.schema_json as any)?.fields ?? [],
  }))

  const graphNodes = (nodesRes.data ?? []).map(n => {
    const props = (n.properties_json ?? {}) as Record<string, any>
    return {
      id: n.client_id,
      type: 'circle',
      position: { x: n.position_x ?? 0, y: n.position_y ?? 0 },
      data: {
        label: n.title,
        entityType: props.entityType ?? 'Character',
        typeId: nodeTypeClientId.get(n.node_type_id) ?? undefined,
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
      id: r.client_id,
      source: nodeClientId.get(r.source_node_id) ?? r.source_node_id,
      target: nodeClientId.get(r.target_node_id) ?? r.target_node_id,
      sourceHandle: props.sourceHandle ?? undefined,
      targetHandle: props.targetHandle ?? undefined,
      label: props.label ?? undefined,
      type: 'relationship',
      data: {
        labelT: props.labelT ?? 0.5,
        color: props.color ?? undefined,
        schemaColor: props.schemaColor ?? undefined,
        relationshipTypeId: relTypeClientId.get(r.relationship_type_id) ?? undefined,
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

  const now = new Date().toISOString()
  return {
    id: projectId,
    name: projectRes.data?.name ?? 'Project',
    createdAt: projectRes.data?.created_at ?? now,
    updatedAt: now,
    graph: { nodes: graphNodes, edges: graphEdges },
    entitySchema,
    relSchema,
    conceptSchema,
  }
}
