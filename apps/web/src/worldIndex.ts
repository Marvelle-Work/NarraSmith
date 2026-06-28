import type { ProjectData } from './projectStore'
import type { ConceptInstance } from './types'

// ── Types ─────────────────────────────────────────────────────────────────

export type WorldIndexKind = 'entity' | 'asset' | 'concept' | 'relationship'

export type WorldIndexEntry = {
  id: string
  kind: WorldIndexKind
  label: string
  subKind?: string   // entityType | assetKind | conceptSchemaId | relationshipTypeId
  description?: string
}

export type WorldIndex = {
  entries: WorldIndexEntry[]
  search(query: string, limit?: number): WorldIndexEntry[]
  resolve(id: string): WorldIndexEntry | undefined
}

// ── Builder ───────────────────────────────────────────────────────────────

export function buildWorldIndex(project: ProjectData): WorldIndex {
  const entries: WorldIndexEntry[] = []

  // Entities and their concept instances
  for (const node of project.graph.nodes as any[]) {
    if (node.type !== 'circle') continue
    entries.push({
      id: node.id,
      kind: 'entity',
      label: node.data?.label ?? '',
      subKind: node.data?.entityType,
      description: node.data?.description,
    })
    for (const [schemaId, instances] of Object.entries(node.data?.concepts ?? {})) {
      for (const inst of instances as ConceptInstance[]) {
        entries.push({
          id: inst.id,
          kind: 'concept',
          label: inst.label || schemaId,
          subKind: schemaId,
        })
      }
    }
  }

  // Assets (all kinds)
  for (const asset of project.assets) {
    entries.push({
      id: asset.id,
      kind: 'asset',
      label: asset.title,
      subKind: asset.kind,
    })
  }

  // Relationships
  for (const edge of project.graph.edges as any[]) {
    if (edge.type !== 'relationship') continue
    entries.push({
      id: edge.id,
      kind: 'relationship',
      label: typeof edge.label === 'string' ? edge.label : '',
      subKind: edge.data?.relationshipTypeId,
    })
  }

  function search(query: string, limit = 20): WorldIndexEntry[] {
    const q = query.toLowerCase().trim()
    if (!q) return []
    return entries
      .filter(e => e.label.toLowerCase().includes(q))
      .slice(0, limit)
  }

  function resolve(id: string): WorldIndexEntry | undefined {
    return entries.find(e => e.id === id)
  }

  return { entries, search, resolve }
}
