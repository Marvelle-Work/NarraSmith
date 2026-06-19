import { DEFAULT_SCHEMA_TYPES, type SchemaType, uid } from './schema'
import { DEFAULT_RELATIONSHIP_TYPES, type RelationshipType } from './relationshipSchema'
import { DEFAULT_CONCEPT_SCHEMAS, type ConceptSchemaType } from './conceptSchema'
import type { ProjectTemplate } from './templates'

// ── Types ───────────────────────────────────────────────────────────────

export type ProjectGraph = {
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  rootNodeId?: string
}

export type ProjectData = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  graph: ProjectGraph
  entitySchema: SchemaType[]
  relSchema: RelationshipType[]
  conceptSchema: ConceptSchemaType[]
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

export function makeDefaultProject(id?: string, name = 'My World'): ProjectData {
  const now = new Date().toISOString()
  return {
    id: id ?? `project-${uid()}`,
    name,
    createdAt: now,
    updatedAt: now,
    graph: { nodes: [], edges: [] },
    entitySchema: DEFAULT_SCHEMA_TYPES,
    relSchema: DEFAULT_RELATIONSHIP_TYPES,
    conceptSchema: DEFAULT_CONCEPT_SCHEMAS,
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

  const project = makeDefaultProject('default')
  try { if (rawGraph)     project.graph        = JSON.parse(rawGraph) }     catch {}
  try { if (rawSchema)    project.entitySchema = JSON.parse(rawSchema) }    catch {}
  try { if (rawRelSchema) project.relSchema    = JSON.parse(rawRelSchema) } catch {}

  return {
    version: 1,
    activeProjectId: 'default',
    projects: { default: project },
  }
}

function normalizeStore(store: ProjectStore): ProjectStore {
  for (const p of Object.values(store.projects)) {
    if (!p.conceptSchema) p.conceptSchema = DEFAULT_CONCEPT_SCHEMAS
    if (!p.updatedAt) p.updatedAt = p.createdAt
  }
  return store
}

// ── Public API ───────────────────────────────────────────────────────────

export function loadProjectStore(): ProjectStore {
  // 1. Try reading the new unified store.
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return normalizeStore(JSON.parse(raw) as ProjectStore)
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
  const defaultProject = makeDefaultProject()
  return {
    version: 1,
    activeProjectId: defaultProject.id,
    projects: { [defaultProject.id]: defaultProject },
  }
}

export function saveProjectStore(store: ProjectStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

// ── Project operations ──────────────────────────────────────────────────

export function createProject(store: ProjectStore, name?: string): ProjectStore {
  const project = makeDefaultProject(undefined, name ?? 'My World')
  return {
    ...store,
    activeProjectId: project.id,
    projects: { ...store.projects, [project.id]: project },
  }
}

export function renameProject(store: ProjectStore, projectId: string, name: string): ProjectStore {
  const project = store.projects[projectId]
  if (!project) return store
  return {
    ...store,
    projects: {
      ...store.projects,
      [projectId]: { ...project, name, updatedAt: new Date().toISOString() },
    },
  }
}

export function duplicateProject(store: ProjectStore, projectId: string): ProjectStore {
  const source = store.projects[projectId]
  if (!source) return store
  const now = new Date().toISOString()
  const newProject: ProjectData = {
    ...JSON.parse(JSON.stringify(source)),
    id: `project-${uid()}`,
    name: `${source.name} Copy`,
    createdAt: now,
    updatedAt: now,
  }
  return {
    ...store,
    projects: { ...store.projects, [newProject.id]: newProject },
  }
}

export function deleteProject(store: ProjectStore, projectId: string): ProjectStore {
  const { [projectId]: _, ...rest } = store.projects
  const remaining = Object.keys(rest)

  if (remaining.length === 0) {
    const fallback = makeDefaultProject()
    return {
      ...store,
      activeProjectId: fallback.id,
      projects: { [fallback.id]: fallback },
    }
  }

  const activeProjectId = store.activeProjectId === projectId
    ? remaining[0]
    : store.activeProjectId

  return { ...store, activeProjectId, projects: rest }
}

export function setActiveProject(store: ProjectStore, projectId: string): ProjectStore {
  if (!store.projects[projectId]) return store
  return { ...store, activeProjectId: projectId }
}

export function createProjectFromTemplate(store: ProjectStore, template: ProjectTemplate, name?: string): ProjectStore {
  const now = new Date().toISOString()
  const project: ProjectData = {
    id: `project-${uid()}`,
    name: name ?? template.name,
    createdAt: now,
    updatedAt: now,
    graph: JSON.parse(JSON.stringify(template.graph)),
    entitySchema: JSON.parse(JSON.stringify(template.entitySchema)),
    relSchema: JSON.parse(JSON.stringify(template.relSchema)),
    conceptSchema: JSON.parse(JSON.stringify(template.conceptSchema)),
  }
  return {
    ...store,
    activeProjectId: project.id,
    projects: { ...store.projects, [project.id]: project },
  }
}

export function updateProjectTimestamp(store: ProjectStore, projectId: string): ProjectStore {
  const project = store.projects[projectId]
  if (!project) return store
  return {
    ...store,
    projects: {
      ...store.projects,
      [projectId]: { ...project, updatedAt: new Date().toISOString() },
    },
  }
}
