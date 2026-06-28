import type { SchemaType } from './schema'
import type { RelationshipType } from './relationshipSchema'
import type { ConceptSchemaType } from './conceptSchema'
import type { Asset, AttachmentAsset, AssetEntry, CanvasImageAsset, NotebookAsset, NotebookDocument, Block, SizeLevel } from './types'
import type { ProjectGraph, ProjectData, ProjectStore } from './projectStore'
import { getActiveProject, saveProjectStore } from './projectStore'
import { uid } from './schema'
import { logger } from './lib/logger'

// ═══════════════════════════════════════════════════════════════════════════
// v2 Format — World / Pages separation
// World owns objects. Pages own layouts.
// ═══════════════════════════════════════════════════════════════════════════

export type WorldEntity = {
  id: string
  label: string
  entityType: string
  typeId?: string
  fields?: Record<string, unknown>
  description?: string
  color?: string
  sizeLevel?: SizeLevel
  concepts?: Record<string, unknown[]>
  profileImageUrl?: string
  labelColor?: string
  rootGlowColor?: string
}

// WorldAsset is the serialized form of AttachmentAsset in the export format.
// CanvasImageAssets are stored separately in the page's canvasImages array.
export type WorldAsset = {
  id: string
  title: string
  linkedEntityIds: string[]
  entries: AssetEntry[]
}

// CanvasImageRecord matches the old CanvasImage shape for export format stability.
export type CanvasImageRecord = {
  id: string
  title: string
  imageUrl: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  zIndex: number
}

export type WorldRelationship = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  relationshipTypeId?: string
  description?: string
  whyItMatters?: string
  color?: string
  schemaColor?: string
  labelT?: number
}

export type WorldNotebook = {
  id: string
  title: string
  description?: string
  tags?: string[]
  linkedEntityIds?: string[]
  documents: { id: string; title: string; createdAt: string; updatedAt: string; content: Block[] }[]
}

export type NarrasmithWorld = {
  entities: WorldEntity[]
  assets: WorldAsset[]
  relationships: WorldRelationship[]
  entitySchemas: SchemaType[]
  relationshipSchemas: RelationshipType[]
  conceptSchemas: ConceptSchemaType[]
  notebooks?: WorldNotebook[]
}

export type PageEntityLayout = {
  entityId: string
  x: number
  y: number
}

export type PageAssetLayout = {
  assetId: string
  x: number
  y: number
}

export type NarrasmithPage = {
  id: string
  name: string
  viewport?: unknown
  rootEntityId?: string
  entityLayouts: PageEntityLayout[]
  assetLayouts: PageAssetLayout[]
  canvasImages: CanvasImageRecord[]
}

export type NarrasmithExportV2 = {
  format: 'narrasmith-project'
  version: 2
  exportedAt: string
  project: {
    id: string
    name: string
    createdAt: string
    updatedAt?: string
  }
  world: NarrasmithWorld
  pages: NarrasmithPage[]
}

// ═══════════════════════════════════════════════════════════════════════════
// v1 Format — kept for backward-compatible import only
// ═══════════════════════════════════════════════════════════════════════════

export type NarrasmithExport = {
  format: 'narrasmith-project'
  version: 1
  exportedAt: string
  project: {
    id: string
    name: string
    createdAt: string
    updatedAt?: string
  }
  entitySchema: SchemaType[]
  relationshipSchema: RelationshipType[]
  conceptSchema: ConceptSchemaType[]
  graph: ProjectGraph
  assets?: WorldAsset[]
  canvasImages?: CanvasImageRecord[]
}

// ── Fragment format ─────────────────────────────────────────────────────

export type NarrasmithFragment = {
  format: 'narrasmith-fragment'
  version: 1
  name?: string
  entitySchema?: SchemaType[]
  relationshipSchema?: RelationshipType[]
  conceptSchema?: ConceptSchemaType[]
  assets?: WorldAsset[]
  canvasImages?: CanvasImageRecord[]
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
}

// ── Unified mergeable content (internal) ───────────────────────────────

export type MergeableContent = {
  entitySchema: SchemaType[]
  relationshipSchema: RelationshipType[]
  conceptSchema: ConceptSchemaType[]
  graph: ProjectGraph
  assets: Asset[]
}

// ── Serialization helpers ──────────────────────────────────────────────

function worldAssetToAttachment(a: WorldAsset, pos?: { x: number; y: number }): AttachmentAsset {
  const now = new Date().toISOString()
  return {
    id: a.id,
    kind: 'attachment',
    title: a.title,
    tags: [],
    createdAt: now,
    updatedAt: now,
    linkedEntityIds: a.linkedEntityIds,
    isPinnedOnCanvas: !!pos,
    ...(pos && { position: pos }),
    entries: a.entries ?? [],
  }
}

function canvasImageRecordToAsset(ci: CanvasImageRecord): CanvasImageAsset {
  const now = new Date().toISOString()
  return {
    id: ci.id,
    kind: 'canvas-image',
    title: ci.title,
    tags: [],
    createdAt: now,
    updatedAt: now,
    linkedEntityIds: [],
    isPinnedOnCanvas: true,
    position: { x: ci.x, y: ci.y },
    imageUrl: ci.imageUrl,
    width: ci.width,
    height: ci.height,
    rotation: ci.rotation ?? 0,
    opacity: ci.opacity ?? 1,
    locked: ci.locked ?? false,
    zIndex: ci.zIndex ?? 0,
  }
}

function attachmentToWorldAsset(a: AttachmentAsset): WorldAsset {
  return { id: a.id, title: a.title, linkedEntityIds: a.linkedEntityIds, entries: a.entries }
}

function notebookAssetToWorld(a: NotebookAsset): WorldNotebook {
  return {
    id: a.id,
    title: a.title,
    ...(a.description != null && { description: a.description }),
    ...(a.tags?.length && { tags: a.tags }),
    ...(a.linkedEntityIds.length && { linkedEntityIds: a.linkedEntityIds }),
    documents: a.documents.map(d => ({
      id: d.id,
      title: d.title,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      content: d.content as Block[],
    })),
  }
}

function worldNotebookToAsset(n: WorldNotebook): NotebookAsset {
  const now = new Date().toISOString()
  return {
    id: n.id,
    kind: 'notebook',
    title: n.title,
    description: n.description,
    tags: n.tags ?? [],
    createdAt: now,
    updatedAt: now,
    linkedEntityIds: n.linkedEntityIds ?? [],
    isPinnedOnCanvas: false,
    documents: (n.documents ?? []).map((d): NotebookDocument => ({
      id: d.id,
      title: d.title,
      createdAt: d.createdAt ?? now,
      updatedAt: d.updatedAt ?? now,
      content: (d.content ?? []) as Block[],
    })),
  }
}

function canvasImageAssetToRecord(a: CanvasImageAsset): CanvasImageRecord {
  return {
    id: a.id,
    title: a.title,
    imageUrl: a.imageUrl,
    x: a.position?.x ?? 0,
    y: a.position?.y ?? 0,
    width: a.width,
    height: a.height,
    rotation: a.rotation,
    opacity: a.opacity,
    locked: a.locked,
    zIndex: a.zIndex,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: reconstruct unified Asset[] from v2 world + page
// ═══════════════════════════════════════════════════════════════════════════

function buildAssetsFromV2(data: NarrasmithExportV2): {
  assets: Asset[]
  graph: ProjectGraph
} {
  const page: NarrasmithPage = data.pages?.[0] ?? {
    id: 'overview', name: 'Overview',
    entityLayouts: [], assetLayouts: [], canvasImages: [],
  }

  const layoutMap = new Map(page.entityLayouts.map(l => [l.entityId, { x: l.x, y: l.y }]))
  const assetLayoutMap = new Map(page.assetLayouts.map(l => [l.assetId, { x: l.x, y: l.y }]))

  // Entity circle nodes
  const entityNodes = data.world.entities.map((e, i) => {
    const pos = layoutMap.get(e.id) ?? { x: 100 + (i % 5) * 200, y: 100 + Math.floor(i / 5) * 200 }
    return {
      id: e.id,
      type: 'circle',
      position: pos,
      data: {
        label: e.label,
        entityType: e.entityType,
        typeId: e.typeId,
        fields: e.fields ?? {},
        description: e.description ?? '',
        color: e.color,
        sizeLevel: e.sizeLevel ?? 3,
        concepts: e.concepts,
        profileImageUrl: e.profileImageUrl,
        labelColor: e.labelColor,
        rootGlowColor: e.rootGlowColor,
        isRoot: e.id === page.rootEntityId || undefined,
      },
    }
  })

  // Attachment assets from world.assets
  const attachmentAssets: AttachmentAsset[] = data.world.assets.map(a =>
    worldAssetToAttachment(a, assetLayoutMap.get(a.id)),
  )

  // Canvas image assets from page.canvasImages
  const canvasImageAssets: CanvasImageAsset[] = (page.canvasImages ?? []).map(canvasImageRecordToAsset)

  // Notebook assets from world.notebooks
  const notebookAssets: NotebookAsset[] = (data.world.notebooks ?? []).map(worldNotebookToAsset)

  const assets: Asset[] = [...attachmentAssets, ...canvasImageAssets, ...notebookAssets]

  const entityNodeIds = new Set(entityNodes.map(n => n.id))

  // Asset canvas nodes (pinned attachment assets only)
  const assetCanvasNodes = attachmentAssets
    .filter(a => a.isPinnedOnCanvas && a.position)
    .map(a => {
      const summary = a.entries.slice(0, 3).map(e => e.label || e.type).join(', ')
      return {
        id: `asset-node-${a.id}`,
        type: 'asset',
        position: a.position!,
        data: { assetId: a.id, title: a.title, entryCount: a.entries.length, entrySummary: summary },
      }
    })

  // Tether edges for pinned attachment assets
  const tetherEdges = attachmentAssets
    .filter(a => a.isPinnedOnCanvas)
    .flatMap(a =>
      a.linkedEntityIds
        .filter(eid => entityNodeIds.has(eid))
        .map(eid => ({
          id: `tether-${a.id}-${eid}`,
          source: `asset-node-${a.id}`,
          target: eid,
          type: 'tether',
        }))
    )

  // Relationship edges
  const relEdges = data.world.relationships.map(r => ({
    id: r.id,
    source: r.source,
    target: r.target,
    ...(r.sourceHandle != null && { sourceHandle: r.sourceHandle }),
    ...(r.targetHandle != null && { targetHandle: r.targetHandle }),
    ...(r.label != null && { label: r.label }),
    type: 'relationship',
    data: {
      labelT: r.labelT ?? 0.5,
      color: r.color,
      schemaColor: r.schemaColor,
      relationshipTypeId: r.relationshipTypeId,
      description: r.description,
      whyItMatters: r.whyItMatters,
    },
  }))

  // Canvas image React Flow nodes
  const canvasImageNodes = canvasImageAssets.map(ci => ({
    id: `canvas-img-${ci.id}`,
    type: 'canvas-image',
    position: ci.position ?? { x: 0, y: 0 },
    draggable: !ci.locked,
    selectable: true,
    data: {
      canvasImageId: ci.id,
      title: ci.title,
      imageUrl: ci.imageUrl,
      width: ci.width,
      height: ci.height,
      rotation: ci.rotation ?? 0,
      opacity: ci.opacity ?? 1,
      locked: ci.locked ?? false,
    },
  }))

  return {
    assets,
    graph: {
      nodes: [...canvasImageNodes, ...entityNodes, ...assetCanvasNodes] as any,
      edges: [...relEdges, ...tetherEdges] as any,
      rootNodeId: page.rootEntityId,
    },
  }
}

function toMergeable(data: NarrasmithExportV2 | NarrasmithExport | NarrasmithFragment): MergeableContent {
  if (data.format === 'narrasmith-fragment') {
    const d = data as NarrasmithFragment
    const now = new Date().toISOString()
    const attachments: AttachmentAsset[] = (d.assets ?? []).map(a => worldAssetToAttachment(a))
    const canvasImages: CanvasImageAsset[] = (d.canvasImages ?? []).map(canvasImageRecordToAsset)
    return {
      entitySchema: d.entitySchema ?? [],
      relationshipSchema: d.relationshipSchema ?? [],
      conceptSchema: d.conceptSchema ?? [],
      graph: { nodes: d.nodes, edges: d.edges },
      assets: [...attachments, ...canvasImages],
    }
  }
  if ((data as any).version === 2) {
    const d = data as NarrasmithExportV2
    const { assets, graph } = buildAssetsFromV2(d)
    return {
      entitySchema: d.world.entitySchemas,
      relationshipSchema: d.world.relationshipSchemas,
      conceptSchema: d.world.conceptSchemas,
      graph,
      assets,
    }
  }
  // v1
  const d = data as NarrasmithExport
  const attachments: AttachmentAsset[] = (d.assets ?? []).map(a => worldAssetToAttachment(a))
  const canvasImages: CanvasImageAsset[] = (d.canvasImages ?? []).map(canvasImageRecordToAsset)
  return {
    entitySchema: d.entitySchema,
    relationshipSchema: d.relationshipSchema,
    conceptSchema: d.conceptSchema,
    graph: d.graph,
    assets: [...attachments, ...canvasImages],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Preview / merge summary types
// ═══════════════════════════════════════════════════════════════════════════

export type ImportPreview = {
  projectName: string
  nodeCount: number
  assetCount: number
  edgeCount: number
  entitySchemaCount: number
  relationshipSchemaCount: number
  conceptSchemaCount: number
}

export type MergePreview = {
  nodesToAdd: number
  edgesToAdd: number
  assetsToAdd: number
  entitySchemasToAdd: number
  entitySchemasToSkip: number
  relSchemasToAdd: number
  relSchemasToSkip: number
  conceptSchemasToAdd: number
  conceptSchemasToSkip: number
}

export type MergeReport = {
  nodesAdded: number
  edgesAdded: number
  assetsAdded: number
  entitySchemasAdded: number
  entitySchemasSkipped: number
  relSchemasAdded: number
  relSchemasSkipped: number
  conceptSchemasAdded: number
  conceptSchemasSkipped: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Export (always v2)
// ═══════════════════════════════════════════════════════════════════════════

export function buildExportPayload(store: ProjectStore, projectId?: string): { json: string; fileName: string } {
  logger.info('EXPORT', 'Building v2 export payload', { projectId: projectId ?? store.activeProjectId })
  const project = projectId ? store.projects[projectId] ?? getActiveProject(store) : getActiveProject(store)
  const allNodes = project.graph.nodes as any[]
  const allEdges = project.graph.edges as any[]

  const circleNodes = allNodes.filter(n => n.type === 'circle')
  const entities: WorldEntity[] = circleNodes.map(n => ({
    id: n.id,
    label: n.data?.label ?? 'Untitled',
    entityType: n.data?.entityType ?? 'Character',
    ...(n.data?.typeId != null          && { typeId: n.data.typeId }),
    ...(n.data?.fields != null          && { fields: n.data.fields }),
    ...(n.data?.description != null     && { description: n.data.description }),
    ...(n.data?.color != null           && { color: n.data.color }),
    ...(n.data?.sizeLevel != null       && { sizeLevel: n.data.sizeLevel }),
    ...(n.data?.concepts != null        && { concepts: n.data.concepts }),
    ...(n.data?.profileImageUrl != null && { profileImageUrl: n.data.profileImageUrl }),
    ...(n.data?.labelColor != null      && { labelColor: n.data.labelColor }),
    ...(n.data?.rootGlowColor != null   && { rootGlowColor: n.data.rootGlowColor }),
  }))

  const entityLayouts: PageEntityLayout[] = circleNodes
    .filter(n => n.position)
    .map(n => ({ entityId: n.id, x: n.position.x, y: n.position.y }))

  // Split unified assets by kind for the v2 format
  const attachmentAssets = (project.assets ?? []).filter((a): a is AttachmentAsset => a.kind === 'attachment')
  const canvasImageAssets = (project.assets ?? []).filter((a): a is CanvasImageAsset => a.kind === 'canvas-image')
  const notebookAssets = (project.assets ?? []).filter((a): a is NotebookAsset => a.kind === 'notebook')

  const worldAssets: WorldAsset[] = attachmentAssets.map(attachmentToWorldAsset)
  const assetLayouts: PageAssetLayout[] = attachmentAssets
    .filter(a => a.isPinnedOnCanvas && a.position)
    .map(a => ({ assetId: a.id, x: a.position!.x, y: a.position!.y }))

  const canvasImageRecords: CanvasImageRecord[] = canvasImageAssets.map(canvasImageAssetToRecord)

  const relationships: WorldRelationship[] = allEdges
    .filter(e => e.type === 'relationship')
    .map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle != null             && { sourceHandle: e.sourceHandle }),
      ...(e.targetHandle != null             && { targetHandle: e.targetHandle }),
      ...(e.label != null                    && { label: e.label }),
      ...(e.data?.relationshipTypeId != null && { relationshipTypeId: e.data.relationshipTypeId }),
      ...(e.data?.description != null        && { description: e.data.description }),
      ...(e.data?.whyItMatters != null       && { whyItMatters: e.data.whyItMatters }),
      ...(e.data?.color != null              && { color: e.data.color }),
      ...(e.data?.schemaColor != null        && { schemaColor: e.data.schemaColor }),
      ...(e.data?.labelT != null && e.data.labelT !== 0.5 && { labelT: e.data.labelT }),
    }))

  const rootEntityId: string | undefined = (project.graph as any).rootNodeId ?? undefined

  const worldNotebooks: WorldNotebook[] = notebookAssets.map(notebookAssetToWorld)

  const payload: NarrasmithExportV2 = {
    format: 'narrasmith-project',
    version: 2,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    world: {
      entities,
      assets: worldAssets,
      relationships,
      entitySchemas: project.entitySchema,
      relationshipSchemas: project.relSchema,
      conceptSchemas: project.conceptSchema,
      ...(worldNotebooks.length && { notebooks: worldNotebooks }),
    },
    pages: [{
      id: 'overview',
      name: 'Overview',
      ...(rootEntityId && { rootEntityId }),
      entityLayouts,
      assetLayouts,
      canvasImages: canvasImageRecords,
    }],
  }

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const json = JSON.stringify(payload, null, 2)
  logger.debug('EXPORT', 'Export payload built', {
    entities: entities.length,
    relationships: relationships.length,
    assets: worldAssets.length,
    notebooks: worldNotebooks.length,
    canvasImages: canvasImageRecords.length,
    entitySchemas: project.entitySchema.length,
    bytes: json.length,
  })
  return { json, fileName: `${slug || 'project'}.narrasmith.json` }
}

export function downloadExportJson(json: string, fileName: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════

export type ValidationResult =
  | { ok: true; data: NarrasmithExportV2 | NarrasmithExport }
  | { ok: false; error: string }

export type ContentValidationResult =
  | { ok: true; kind: 'project'; data: NarrasmithExportV2 | NarrasmithExport }
  | { ok: true; kind: 'fragment'; data: NarrasmithFragment }
  | { ok: false; error: string }

export function validateImportFile(raw: string): ValidationResult {
  const result = validateImportContent(raw)
  if (!result.ok) return result
  if (result.kind === 'fragment') return { ok: false, error: 'Expected a project file, got a fragment.' }
  return { ok: true, data: result.data }
}

export function validateImportContent(raw: string): ContentValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'File is not valid JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'File does not contain a JSON object.' }
  }

  const obj = parsed as Record<string, unknown>

  if (obj.format === 'narrasmith-fragment') return validateFragment(obj, parsed)

  if (obj.format === 'narrasmith-project') {
    if (obj.version === 2) return validateProjectV2(obj, parsed)
    if (obj.version === 1) return validateProjectV1(obj, parsed)
    return { ok: false, error: `Unsupported project version: ${obj.version}. This app supports versions 1 and 2.` }
  }

  return { ok: false, error: 'Not a Narrasmith file (missing format header). Expected "narrasmith-project" or "narrasmith-fragment".' }
}

function validateProjectV2(obj: Record<string, unknown>, parsed: unknown): ContentValidationResult {
  if (!obj.world || typeof obj.world !== 'object') return { ok: false, error: 'Missing world data.' }
  const w = obj.world as Record<string, unknown>
  if (!Array.isArray(w.entities))            return { ok: false, error: 'Missing world.entities array.' }
  if (!Array.isArray(w.assets))              return { ok: false, error: 'Missing world.assets array.' }
  if (!Array.isArray(w.relationships))       return { ok: false, error: 'Missing world.relationships array.' }
  if (!Array.isArray(w.entitySchemas))       return { ok: false, error: 'Missing world.entitySchemas array.' }
  if (!Array.isArray(w.relationshipSchemas)) return { ok: false, error: 'Missing world.relationshipSchemas array.' }
  if (!Array.isArray(w.conceptSchemas))      return { ok: false, error: 'Missing world.conceptSchemas array.' }
  if (!Array.isArray(obj.pages))             return { ok: false, error: 'Missing pages array.' }
  return { ok: true, kind: 'project', data: parsed as NarrasmithExportV2 }
}

function validateProjectV1(obj: Record<string, unknown>, parsed: unknown): ContentValidationResult {
  if (!obj.project || typeof obj.project !== 'object') return { ok: false, error: 'Missing project metadata.' }
  if (!obj.graph || typeof obj.graph !== 'object')     return { ok: false, error: 'Missing graph data.' }
  const graph = obj.graph as Record<string, unknown>
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { ok: false, error: 'Graph must contain nodes and edges arrays.' }
  }
  if (!Array.isArray(obj.entitySchema))       return { ok: false, error: 'Missing entitySchema array.' }
  if (!Array.isArray(obj.relationshipSchema)) return { ok: false, error: 'Missing relationshipSchema array.' }
  if (!Array.isArray(obj.conceptSchema))      return { ok: false, error: 'Missing conceptSchema array.' }
  return { ok: true, kind: 'project', data: parsed as NarrasmithExport }
}

function validateFragment(obj: Record<string, unknown>, parsed: unknown): ContentValidationResult {
  if (obj.version !== 1) {
    return { ok: false, error: `Unsupported fragment version: ${obj.version}. This app supports version 1.` }
  }
  if (!Array.isArray(obj.nodes)) return { ok: false, error: 'Fragment must contain a nodes array.' }
  if (!Array.isArray(obj.edges)) return { ok: false, error: 'Fragment must contain an edges array.' }
  if (obj.entitySchema !== undefined && !Array.isArray(obj.entitySchema)) {
    return { ok: false, error: 'entitySchema must be an array if present.' }
  }
  if (obj.relationshipSchema !== undefined && !Array.isArray(obj.relationshipSchema)) {
    return { ok: false, error: 'relationshipSchema must be an array if present.' }
  }
  if (obj.conceptSchema !== undefined && !Array.isArray(obj.conceptSchema)) {
    return { ok: false, error: 'conceptSchema must be an array if present.' }
  }
  return { ok: true, kind: 'fragment', data: parsed as NarrasmithFragment }
}

// ═══════════════════════════════════════════════════════════════════════════
// Preview
// ═══════════════════════════════════════════════════════════════════════════

export function buildContentPreview(data: NarrasmithExportV2 | NarrasmithExport | NarrasmithFragment): ImportPreview {
  if (data.format === 'narrasmith-fragment') {
    const d = data as NarrasmithFragment
    return {
      projectName: d.name ?? 'Fragment',
      nodeCount: d.nodes?.length ?? 0,
      assetCount: d.assets?.length ?? 0,
      edgeCount: d.edges?.length ?? 0,
      entitySchemaCount: d.entitySchema?.length ?? 0,
      relationshipSchemaCount: d.relationshipSchema?.length ?? 0,
      conceptSchemaCount: d.conceptSchema?.length ?? 0,
    }
  }
  if ((data as any).version === 2) {
    const d = data as NarrasmithExportV2
    return {
      projectName: d.project?.name ?? 'Untitled',
      nodeCount: d.world.entities.length,
      assetCount: d.world.assets.length,
      edgeCount: d.world.relationships.length,
      entitySchemaCount: d.world.entitySchemas.length,
      relationshipSchemaCount: d.world.relationshipSchemas.length,
      conceptSchemaCount: d.world.conceptSchemas.length,
    }
  }
  const d = data as NarrasmithExport
  const circleNodes = (d.graph?.nodes as any[] ?? []).filter((n: any) => n.type === 'circle')
  const relEdges = (d.graph?.edges as any[] ?? []).filter((e: any) => e.type === 'relationship')
  return {
    projectName: (d.project as any)?.name ?? 'Untitled',
    nodeCount: circleNodes.length,
    assetCount: d.assets?.length ?? 0,
    edgeCount: relEdges.length,
    entitySchemaCount: d.entitySchema?.length ?? 0,
    relationshipSchemaCount: d.relationshipSchema?.length ?? 0,
    conceptSchemaCount: d.conceptSchema?.length ?? 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Import as new project
// ═══════════════════════════════════════════════════════════════════════════

export function importProject(data: NarrasmithExportV2 | NarrasmithExport, store: ProjectStore): ProjectStore {
  if ((data as any).version === 2) return importProjectV2(data as NarrasmithExportV2, store)
  return importProjectV1(data as NarrasmithExport, store)
}

function importProjectV2(data: NarrasmithExportV2, store: ProjectStore): ProjectStore {
  const newId = `project-${uid()}`
  const now = new Date().toISOString()
  logger.time('IMPORT_V2_BUILD_GRAPH')
  const { assets, graph } = buildAssetsFromV2(data)
  logger.timeEnd('IMPORT_V2_BUILD_GRAPH')

  const project: ProjectData = {
    id: newId,
    name: data.project?.name ?? 'Imported Project',
    createdAt: data.project?.createdAt ?? now,
    updatedAt: now,
    graph,
    entitySchema: data.world.entitySchemas,
    relSchema: data.world.relationshipSchemas,
    conceptSchema: data.world.conceptSchemas,
    assets,
  }

  logger.info('IMPORT', 'v2 project imported', {
    newId,
    name: project.name,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    entitySchemas: data.world.entitySchemas.length,
    assets: assets.length,
  })

  const next: ProjectStore = {
    ...store,
    activeProjectId: newId,
    projects: { ...store.projects, [newId]: project },
  }
  saveProjectStore(next)
  return next
}

function importProjectV1(data: NarrasmithExport, store: ProjectStore): ProjectStore {
  const newId = `project-${uid()}`
  const now = new Date().toISOString()

  let attachments: AttachmentAsset[] = (data.assets ?? []).map(a => worldAssetToAttachment(a))

  // Reconstruct from asset graph nodes if the assets field is absent (very old v1)
  if (attachments.length === 0) {
    const assetNodes = (data.graph?.nodes as any[] ?? []).filter((n: any) => n.type === 'asset')
    if (assetNodes.length > 0) {
      logger.warn('IMPORT', `v1 import: reconstructing ${assetNodes.length} asset(s) from graph nodes — entries will be empty`)
      attachments = assetNodes.map((n: any): AttachmentAsset => ({
        id: n.data?.assetId ?? n.id.replace('asset-node-', ''),
        kind: 'attachment',
        title: n.data?.title ?? 'Untitled Asset',
        tags: [],
        createdAt: now,
        updatedAt: now,
        linkedEntityIds: [],
        isPinnedOnCanvas: true,
        position: n.position,
        entries: [],
      }))
    }
  }

  const canvasImages: CanvasImageAsset[] = (data.canvasImages ?? []).map(canvasImageRecordToAsset)
  const assets: Asset[] = [...attachments, ...canvasImages]

  const project: ProjectData = {
    id: newId,
    name: (data.project as any)?.name ?? 'Imported Project',
    createdAt: (data.project as any)?.createdAt ?? now,
    updatedAt: now,
    graph: data.graph,
    entitySchema: data.entitySchema,
    relSchema: data.relationshipSchema,
    conceptSchema: data.conceptSchema,
    assets,
  }

  const next: ProjectStore = {
    ...store,
    activeProjectId: newId,
    projects: { ...store.projects, [newId]: project },
  }
  saveProjectStore(next)
  return next
}

// ═══════════════════════════════════════════════════════════════════════════
// Merge into existing project
// ═══════════════════════════════════════════════════════════════════════════

function deduplicateByName<T extends { name: string }>(
  existing: T[],
  incoming: T[],
): { merged: T[]; added: number; skipped: number } {
  const existingNames = new Set(existing.map(s => s.name.toLowerCase()))
  const toAdd: T[] = []
  let skipped = 0
  for (const item of incoming) {
    if (existingNames.has(item.name.toLowerCase())) {
      skipped++
    } else {
      toAdd.push(item)
      existingNames.add(item.name.toLowerCase())
    }
  }
  return { merged: [...existing, ...toAdd], added: toAdd.length, skipped }
}

function buildNodeIdRemap(
  existingNodeIds: Set<string>,
  incomingNodes: Record<string, unknown>[],
): Map<string, string> {
  const remap = new Map<string, string>()
  for (const node of incomingNodes) {
    const oldId = (node as { id?: string }).id ?? ''
    if (existingNodeIds.has(oldId) || remap.has(oldId)) {
      remap.set(oldId, `node-${uid()}`)
    }
  }
  return remap
}

function remapNodes(
  nodes: Record<string, unknown>[],
  remap: Map<string, string>,
): Record<string, unknown>[] {
  return nodes.map(node => {
    const oldId = (node as { id?: string }).id ?? ''
    const newId = remap.get(oldId)
    return newId ? { ...node, id: newId } : node
  })
}

function remapEdges(
  edges: Record<string, unknown>[],
  nodeRemap: Map<string, string>,
): Record<string, unknown>[] {
  return edges.map(edge => {
    const e = edge as { id?: string; source?: string; target?: string }
    return {
      ...edge,
      id: `edge-${uid()}`,
      source: nodeRemap.get(e.source ?? '') ?? e.source,
      target: nodeRemap.get(e.target ?? '') ?? e.target,
    }
  })
}

export function buildMergePreview(
  data: NarrasmithExportV2 | NarrasmithExport | NarrasmithFragment,
  currentProject: ProjectData,
): MergePreview {
  const m = toMergeable(data)
  const existingEntityNames  = new Set(currentProject.entitySchema.map(s => s.name.toLowerCase()))
  const existingRelNames     = new Set(currentProject.relSchema.map(s => s.name.toLowerCase()))
  const existingConceptNames = new Set(currentProject.conceptSchema.map(s => s.name.toLowerCase()))
  const existingAssetIds     = new Set((currentProject.assets ?? []).map(a => a.id))

  let entityAdd = 0, entitySkip = 0
  for (const s of m.entitySchema) {
    if (existingEntityNames.has(s.name.toLowerCase())) entitySkip++; else entityAdd++
  }
  let relAdd = 0, relSkip = 0
  for (const s of m.relationshipSchema) {
    if (existingRelNames.has(s.name.toLowerCase())) relSkip++; else relAdd++
  }
  let conceptAdd = 0, conceptSkip = 0
  for (const s of m.conceptSchema) {
    if (existingConceptNames.has(s.name.toLowerCase())) conceptSkip++; else conceptAdd++
  }

  const incomingEntityNodes = (m.graph.nodes as any[]).filter(n => n.type === 'circle')
  const incomingRelEdges    = (m.graph.edges as any[]).filter(e => e.type === 'relationship')
  const assetsToAdd         = m.assets.filter(a => !existingAssetIds.has(a.id)).length

  return {
    nodesToAdd: incomingEntityNodes.length,
    edgesToAdd: incomingRelEdges.length,
    assetsToAdd,
    entitySchemasToAdd: entityAdd,
    entitySchemasToSkip: entitySkip,
    relSchemasToAdd: relAdd,
    relSchemasToSkip: relSkip,
    conceptSchemasToAdd: conceptAdd,
    conceptSchemasToSkip: conceptSkip,
  }
}

export function mergeIntoProject(
  data: NarrasmithExportV2 | NarrasmithExport | NarrasmithFragment,
  currentProject: ProjectData,
): { project: ProjectData; report: MergeReport } {
  const m = toMergeable(data)

  const existingEntityIds = new Set(
    (currentProject.graph.nodes as any[])
      .filter(n => n.type === 'circle')
      .map(n => (n as { id?: string }).id ?? ''),
  )
  const incomingEntityNodes = (m.graph.nodes as any[]).filter(n => n.type === 'circle')
  const nodeRemap           = buildNodeIdRemap(existingEntityIds, incomingEntityNodes)
  const remappedNodes       = remapNodes(incomingEntityNodes, nodeRemap)

  const incomingRelEdges = (m.graph.edges as any[]).filter(e => e.type === 'relationship')
  const remappedEdges    = remapEdges(incomingRelEdges, nodeRemap)

  const entityResult  = deduplicateByName(currentProject.entitySchema, m.entitySchema)
  const relResult     = deduplicateByName(currentProject.relSchema, m.relationshipSchema)
  const conceptResult = deduplicateByName(currentProject.conceptSchema, m.conceptSchema)

  const existingAssetIds = new Set((currentProject.assets ?? []).map(a => a.id))
  const assetsToAdd      = m.assets.filter(a => !existingAssetIds.has(a.id))

  const mergedEntityIds = new Set([
    ...existingEntityIds,
    ...remappedNodes.map(n => (n as any).id as string),
  ])

  // Derive canvas nodes for newly-added pinned attachment assets
  const newAttachmentCanvasNodes: Record<string, unknown>[] = assetsToAdd
    .filter((a): a is AttachmentAsset => a.kind === 'attachment' && a.isPinnedOnCanvas && !!a.position)
    .map(a => {
      const summary = a.entries.slice(0, 3).map(e => e.label || e.type).join(', ')
      return {
        id: `asset-node-${a.id}`,
        type: 'asset',
        position: a.position!,
        data: { assetId: a.id, title: a.title, entryCount: a.entries.length, entrySummary: summary },
      }
    })

  const newTetherEdges: Record<string, unknown>[] = assetsToAdd
    .filter((a): a is AttachmentAsset => a.kind === 'attachment' && a.isPinnedOnCanvas)
    .flatMap(a =>
      a.linkedEntityIds
        .filter(eid => mergedEntityIds.has(eid))
        .map(eid => ({
          id: `tether-${a.id}-${eid}`,
          source: `asset-node-${a.id}`,
          target: eid,
          type: 'tether',
        }))
    )

  // Canvas image nodes for newly-added canvas image assets
  const newCanvasImageNodes: Record<string, unknown>[] = assetsToAdd
    .filter((a): a is CanvasImageAsset => a.kind === 'canvas-image')
    .map(ci => ({
      id: `canvas-img-${ci.id}`,
      type: 'canvas-image',
      position: ci.position ?? { x: 0, y: 0 },
      draggable: !ci.locked,
      selectable: true,
      data: {
        canvasImageId: ci.id,
        title: ci.title,
        imageUrl: ci.imageUrl,
        width: ci.width,
        height: ci.height,
        rotation: ci.rotation ?? 0,
        opacity: ci.opacity ?? 1,
        locked: ci.locked ?? false,
      },
    }))

  const project: ProjectData = {
    ...currentProject,
    graph: {
      ...currentProject.graph,
      nodes: [
        ...(currentProject.graph.nodes as any[]),
        ...remappedNodes,
        ...newAttachmentCanvasNodes,
        ...newCanvasImageNodes,
      ],
      edges: [
        ...(currentProject.graph.edges as any[]),
        ...remappedEdges,
        ...newTetherEdges,
      ],
    },
    entitySchema: entityResult.merged,
    relSchema: relResult.merged,
    conceptSchema: conceptResult.merged,
    assets: [...(currentProject.assets ?? []), ...assetsToAdd],
  }

  const report: MergeReport = {
    nodesAdded: remappedNodes.length,
    edgesAdded: remappedEdges.length,
    assetsAdded: assetsToAdd.length,
    entitySchemasAdded: entityResult.added,
    entitySchemasSkipped: entityResult.skipped,
    relSchemasAdded: relResult.added,
    relSchemasSkipped: relResult.skipped,
    conceptSchemasAdded: conceptResult.added,
    conceptSchemasSkipped: conceptResult.skipped,
  }

  return { project, report }
}
