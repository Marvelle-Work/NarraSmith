import type { SchemaType } from './schema'
import type { RelationshipType } from './relationshipSchema'
import type { ConceptSchemaType } from './conceptSchema'
import type { ProjectGraph, ProjectData, ProjectStore } from './projectStore'
import { getActiveProject, saveProjectStore } from './projectStore'
import { uid } from './schema'

// ── Export format ───────────────────────────────────────────────────────

export type NarrasmithExport = {
  format: 'narrasmith-project'
  version: 1
  exportedAt: string

  project: {
    id: string
    name: string
    createdAt: string
  }

  entitySchema: SchemaType[]
  relationshipSchema: RelationshipType[]
  conceptSchema: ConceptSchemaType[]

  graph: ProjectGraph
}

// ── Import preview summary ──────────────────────────────────────────────

export type ImportPreview = {
  projectName: string
  nodeCount: number
  edgeCount: number
  entitySchemaCount: number
  relationshipSchemaCount: number
  conceptSchemaCount: number
}

// ── Merge types ─────────────────────────────────────────────────────────

export type MergePreview = {
  nodesToAdd: number
  edgesToAdd: number
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
  entitySchemasAdded: number
  entitySchemasSkipped: number
  relSchemasAdded: number
  relSchemasSkipped: number
  conceptSchemasAdded: number
  conceptSchemasSkipped: number
}

// ── Export ───────────────────────────────────────────────────────────────

export function buildExportPayload(store: ProjectStore): { json: string; fileName: string } {
  const project = getActiveProject(store)
  const payload: NarrasmithExport = {
    format: 'narrasmith-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
    },
    entitySchema: project.entitySchema,
    relationshipSchema: project.relSchema,
    conceptSchema: project.conceptSchema,
    graph: project.graph,
  }

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return {
    json: JSON.stringify(payload, null, 2),
    fileName: `${slug || 'project'}.narrasmith.json`,
  }
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

// ── Validation ──────────────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true; data: NarrasmithExport }
  | { ok: false; error: string }

export function validateImportFile(raw: string): ValidationResult {
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

  if (obj.format !== 'narrasmith-project') {
    return { ok: false, error: 'Not a Narrasmith project file (missing format header).' }
  }

  if (obj.version !== 1) {
    return { ok: false, error: `Unsupported version: ${obj.version}. This app supports version 1.` }
  }

  if (!obj.project || typeof obj.project !== 'object') {
    return { ok: false, error: 'Missing project metadata.' }
  }

  if (!obj.graph || typeof obj.graph !== 'object') {
    return { ok: false, error: 'Missing graph data.' }
  }

  const graph = obj.graph as Record<string, unknown>
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { ok: false, error: 'Graph must contain nodes and edges arrays.' }
  }

  if (!Array.isArray(obj.entitySchema)) {
    return { ok: false, error: 'Missing entitySchema array.' }
  }

  if (!Array.isArray(obj.relationshipSchema)) {
    return { ok: false, error: 'Missing relationshipSchema array.' }
  }

  if (!Array.isArray(obj.conceptSchema)) {
    return { ok: false, error: 'Missing conceptSchema array.' }
  }

  return { ok: true, data: parsed as NarrasmithExport }
}

// ── Preview ─────────────────────────────────────────────────────────────

export function buildImportPreview(data: NarrasmithExport): ImportPreview {
  return {
    projectName: (data.project as Record<string, unknown>)?.name as string ?? 'Untitled',
    nodeCount: data.graph.nodes.length,
    edgeCount: data.graph.edges.length,
    entitySchemaCount: data.entitySchema.length,
    relationshipSchemaCount: data.relationshipSchema.length,
    conceptSchemaCount: data.conceptSchema.length,
  }
}

// ── Import as new project ────────────────────────────────────────────────

export function importProject(data: NarrasmithExport, store: ProjectStore): ProjectStore {
  const newId = `project-${uid()}`

  const project: ProjectData = {
    id: newId,
    name: (data.project as Record<string, unknown>)?.name as string ?? 'Imported Project',
    createdAt: (data.project as Record<string, unknown>)?.createdAt as string ?? new Date().toISOString(),
    graph: data.graph,
    entitySchema: data.entitySchema,
    relSchema: data.relationshipSchema,
    conceptSchema: data.conceptSchema,
  }

  const next: ProjectStore = {
    ...store,
    activeProjectId: newId,
    projects: {
      ...store.projects,
      [newId]: project,
    },
  }

  saveProjectStore(next)
  return next
}

// ── Merge into existing project ─────────────────────────────────────────

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
    if (!newId) return node
    return { ...node, id: newId }
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
  data: NarrasmithExport,
  currentProject: ProjectData,
): MergePreview {
  const existingEntityNames = new Set(currentProject.entitySchema.map(s => s.name.toLowerCase()))
  const existingRelNames = new Set(currentProject.relSchema.map(s => s.name.toLowerCase()))
  const existingConceptNames = new Set(currentProject.conceptSchema.map(s => s.name.toLowerCase()))

  let entityAdd = 0, entitySkip = 0
  for (const s of data.entitySchema) {
    if (existingEntityNames.has(s.name.toLowerCase())) entitySkip++; else entityAdd++
  }
  let relAdd = 0, relSkip = 0
  for (const s of data.relationshipSchema) {
    if (existingRelNames.has(s.name.toLowerCase())) relSkip++; else relAdd++
  }
  let conceptAdd = 0, conceptSkip = 0
  for (const s of data.conceptSchema) {
    if (existingConceptNames.has(s.name.toLowerCase())) conceptSkip++; else conceptAdd++
  }

  return {
    nodesToAdd: data.graph.nodes.length,
    edgesToAdd: data.graph.edges.length,
    entitySchemasToAdd: entityAdd,
    entitySchemasToSkip: entitySkip,
    relSchemasToAdd: relAdd,
    relSchemasToSkip: relSkip,
    conceptSchemasToAdd: conceptAdd,
    conceptSchemasToSkip: conceptSkip,
  }
}

export function mergeIntoProject(
  data: NarrasmithExport,
  currentProject: ProjectData,
): { project: ProjectData; report: MergeReport } {
  const existingNodeIds = new Set(
    currentProject.graph.nodes.map(n => (n as { id?: string }).id ?? ''),
  )

  const nodeRemap = buildNodeIdRemap(existingNodeIds, data.graph.nodes)
  const remappedNodes = remapNodes(data.graph.nodes, nodeRemap)
  const remappedEdges = remapEdges(data.graph.edges, nodeRemap)

  const entityResult = deduplicateByName(currentProject.entitySchema, data.entitySchema)
  const relResult = deduplicateByName(currentProject.relSchema, data.relationshipSchema)
  const conceptResult = deduplicateByName(currentProject.conceptSchema, data.conceptSchema)

  const project: ProjectData = {
    ...currentProject,
    graph: {
      nodes: [...currentProject.graph.nodes, ...remappedNodes],
      edges: [...currentProject.graph.edges, ...remappedEdges],
    },
    entitySchema: entityResult.merged,
    relSchema: relResult.merged,
    conceptSchema: conceptResult.merged,
  }

  const report: MergeReport = {
    nodesAdded: remappedNodes.length,
    edgesAdded: remappedEdges.length,
    entitySchemasAdded: entityResult.added,
    entitySchemasSkipped: entityResult.skipped,
    relSchemasAdded: relResult.added,
    relSchemasSkipped: relResult.skipped,
    conceptSchemasAdded: conceptResult.added,
    conceptSchemasSkipped: conceptResult.skipped,
  }

  return { project, report }
}
