import type { Json } from '@narrasmith/shared-types'
import { db } from '../db.js'

export async function rebuildProjectSnapshot(
  projectId: string,
): Promise<Record<string, unknown>> {
  const [nodesRes, relsRes, nodeTypesRes, relTypesRes, conceptTypesRes, assetNodesRes, canvasImagesRes, projectRes] =
    await Promise.all([
      db.from('nodes').select('*').eq('project_id', projectId),
      db.from('relationships').select('*').eq('project_id', projectId),
      db.from('node_types').select('*').eq('project_id', projectId),
      db.from('relationship_types').select('*').eq('project_id', projectId),
      db.from('concept_types').select('*').eq('project_id', projectId),
      db.from('asset_nodes').select('*').eq('project_id', projectId),
      db.from('canvas_images').select('*').eq('project_id', projectId),
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

  const assets = (assetNodesRes.data ?? []).map(an => ({
    id: an.client_id,
    title: an.title,
    entries: an.entries ?? [],
    linkedEntityIds: an.linked_entity_ids ?? [],
    isPinnedOnCanvas: an.is_pinned_on_canvas,
    ...(an.position_x != null && an.position_y != null
      ? { position: { x: an.position_x, y: an.position_y } }
      : {}),
  }))

  // Pinned assets become canvas nodes + tether edges
  const assetCanvasNodes = assets
    .filter(a => a.isPinnedOnCanvas && a.position)
    .map(a => {
      const entries = Array.isArray(a.entries) ? a.entries as any[] : []
      const summary = entries.slice(0, 3).map((e: any) => e.label || e.type).join(', ')
      return {
        id: `asset-node-${a.id}`,
        type: 'asset',
        position: a.position,
        data: {
          assetId: a.id,
          title: a.title,
          entryCount: entries.length,
          entrySummary: summary,
        },
      }
    })

  const tetherEdges = assets
    .filter(a => a.isPinnedOnCanvas)
    .flatMap(a => {
      const linkedIds = Array.isArray(a.linkedEntityIds) ? a.linkedEntityIds as string[] : []
      const existingNodeIds = new Set(graphNodes.map((n: any) => n.id))
      return linkedIds
        .filter(eid => existingNodeIds.has(eid))
        .map(eid => ({
          id: `tether-${a.id}-${eid}`,
          source: `asset-node-${a.id}`,
          target: eid,
          type: 'tether',
        }))
    })

  const canvasImages = (canvasImagesRes.data ?? []).map(ci => ({
    id: ci.client_id,
    title: ci.title,
    imageUrl: ci.image_url,
    x: ci.position_x,
    y: ci.position_y,
    width: ci.width,
    height: ci.height,
    rotation: ci.rotation,
    opacity: ci.opacity,
    locked: ci.locked,
    zIndex: ci.z_index,
  }))

  const canvasImageNodes = canvasImages.map(ci => ({
    id: `canvas-img-${ci.id}`,
    type: 'canvas-image',
    position: { x: ci.x, y: ci.y },
    draggable: !ci.locked,
    zIndex: ci.zIndex - 1000,
    data: {
      canvasImageId: ci.id,
      title: ci.title,
      imageUrl: ci.imageUrl,
      width: ci.width,
      height: ci.height,
      rotation: ci.rotation,
      opacity: ci.opacity,
      locked: ci.locked,
    },
  }))

  const now = new Date().toISOString()
  return {
    id: projectId,
    name: projectRes.data?.name ?? 'Project',
    createdAt: projectRes.data?.created_at ?? now,
    updatedAt: now,
    graph: {
      nodes: [...canvasImageNodes, ...graphNodes, ...assetCanvasNodes],
      edges: [...graphEdges, ...tetherEdges],
    },
    entitySchema,
    relSchema,
    conceptSchema,
    assets,
    canvasImages,
  }
}
