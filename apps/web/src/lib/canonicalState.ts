import type { ProjectData } from '../projectStore'
import { normalizeProjectAssets } from '../projectStore'

// CanonicalProjectState is the single source of truth written to and read from the DB.
// It is structurally identical to ProjectData with a schemaVersion discriminant added.
export type CanonicalProjectState = ProjectData & { schemaVersion: 2 }

// Build a canonical blob from the current in-memory project.
// Stamps updatedAt to now; caller passes the already-normalized asset array.
export function buildCanonicalState(project: ProjectData): CanonicalProjectState {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    conceptSchema: project.conceptSchema ?? [],
    assets: project.assets ?? [],
    schemaVersion: 2,
  }
}

// Hydrate a canonical blob (or any legacy ProjectData) into a clean ProjectData.
// Runs normalizeProjectAssets so all load paths share one normalization layer.
export function hydrateFromCanonical(raw: unknown): ProjectData {
  const r = raw as any
  return {
    id: r.id ?? '',
    name: r.name ?? 'Untitled',
    createdAt: r.createdAt ?? new Date().toISOString(),
    updatedAt: r.updatedAt ?? new Date().toISOString(),
    graph: r.graph ?? { nodes: [], edges: [] },
    entitySchema: r.entitySchema ?? [],
    relSchema: r.relSchema ?? [],
    conceptSchema: r.conceptSchema ?? [],
    assets: normalizeProjectAssets(r),
  }
}
