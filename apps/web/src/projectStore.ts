import { DEFAULT_SCHEMA_TYPES, type SchemaType } from './schema'
import { DEFAULT_RELATIONSHIP_TYPES, type RelationshipType } from './relationshipSchema'

// ── Types ───────────────────────────────────────────────────────────────

export type ProjectGraph = {
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
}

export type ProjectData = {
  id: string
  name: string
  createdAt: string
  graph: ProjectGraph
  entitySchema: SchemaType[]
  relSchema: RelationshipType[]
}

export type ProjectStore = {
  version: 1
  activeProjectId: string
  projects: Record<string, ProjectData>
}

// ── Storage keys ────────────────────────────────────────────────────────

const STORE_KEY = 'narrasmith-projects'

// Legacy flat keys written by the pre-Phase-2 implementation.
// Read once during migration, then removed.
const LEGACY_GRAPH_KEY      = 'narrasmith-graph'
const LEGACY_SCHEMA_KEY     = 'narrasmith-schema'
const LEGACY_REL_SCHEMA_KEY = 'narrasmith-relationship-schema'

// ── Helpers ─────────────────────────────────────────────────────────────

export function makeDefaultProject(id = 'default', name = 'My World'): ProjectData {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    graph: { nodes: [], edges: [] },
    entitySchema: DEFAULT_SCHEMA_TYPES,
    relSchema: DEFAULT_RELATIONSHIP_TYPES,
  }
}

export function getActiveProject(store: ProjectStore): ProjectData {
  return (
    store.projects[store.activeProjectId] ??
    Object.values(store.projects)[0] ??
    makeDefaultProject()
  )
}

// ── Migration ───────────────────────────────────────────────────────────

// One-time migration from the pre-Phase-2 flat localStorage keys into the
// project-scoped structure. Returns null if no legacy data exists.
function migrateFromLegacy(): ProjectStore | null {
  const rawGraph      = localStorage.getItem(LEGACY_GRAPH_KEY)
  const rawSchema     = localStorage.getItem(LEGACY_SCHEMA_KEY)
  const rawRelSchema  = localStorage.getItem(LEGACY_REL_SCHEMA_KEY)

  if (!rawGraph && !rawSchema && !rawRelSchema) return null

  const project = makeDefaultProject()
  try { if (rawGraph)     project.graph        = JSON.parse(rawGraph) }     catch {}
  try { if (rawSchema)    project.entitySchema = JSON.parse(rawSchema) }    catch {}
  try { if (rawRelSchema) project.relSchema    = JSON.parse(rawRelSchema) } catch {}

  return {
    version: 1,
    activeProjectId: 'default',
    projects: { default: project },
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export function loadProjectStore(): ProjectStore {
  // 1. Try reading the new unified store.
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as ProjectStore
  } catch {}

  // 2. Try migrating from legacy flat keys (existing users).
  const migrated = migrateFromLegacy()
  if (migrated) {
    saveProjectStore(migrated)
    localStorage.removeItem(LEGACY_GRAPH_KEY)
    localStorage.removeItem(LEGACY_SCHEMA_KEY)
    localStorage.removeItem(LEGACY_REL_SCHEMA_KEY)
    return migrated
  }

  // 3. Brand-new user — return an empty default store (no save yet).
  return {
    version: 1,
    activeProjectId: 'default',
    projects: { default: makeDefaultProject() },
  }
}

export function saveProjectStore(store: ProjectStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}
