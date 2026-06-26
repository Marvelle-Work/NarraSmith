import { uid } from './schema'
import type { RelationshipDirection } from './types'

export type { RelationshipDirection }

export type RelationshipType = {
  id: string
  name: string
  parentId?: string
  description?: string
  defaultColor?: string
  defaultDirection?: RelationshipDirection
}

export const REL_SCHEMA_STORAGE_KEY = 'narrasmith-relationship-schema'

export const DEFAULT_RELATIONSHIP_TYPES: RelationshipType[] = [
  { id: 'rel-opposes',    name: 'Opposes',    description: 'Active conflict or opposition',  defaultColor: '#ef4444' },
  { id: 'rel-allies',     name: 'Allies',     description: 'Cooperation or friendship',      defaultColor: '#22c55e' },
  { id: 'rel-betrays',    name: 'Betrays',    description: 'Trust violated or broken',       defaultColor: '#f97316' },
  { id: 'rel-influences', name: 'Influences', description: 'One shapes or affects another',  defaultColor: '#8b5cf6' },
  { id: 'rel-created-by', name: 'Created by', description: 'Origin or authorship',           defaultColor: '#3b82f6' },
  { id: 'rel-related-to', name: 'Related to', description: 'General association',            defaultColor: '#94a3b8' },
]

export function loadRelationshipTypes(): RelationshipType[] {
  try {
    const raw = localStorage.getItem(REL_SCHEMA_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as RelationshipType[]
  } catch {}
  return DEFAULT_RELATIONSHIP_TYPES
}

export function saveRelationshipTypes(types: RelationshipType[]): void {
  localStorage.setItem(REL_SCHEMA_STORAGE_KEY, JSON.stringify(types))
}

// Walk parent chain; child overrides parent field-by-field when non-empty.
export function resolveRelationshipType(id: string, types: RelationshipType[]): RelationshipType | null {
  const type = types.find(t => t.id === id)
  if (!type) return null
  if (!type.parentId) return type
  const parent = resolveRelationshipType(type.parentId, types)
  if (!parent) return type
  return {
    id: type.id,
    parentId: type.parentId,
    name:             type.name             || parent.name,
    description:      type.description      || parent.description,
    defaultColor:     type.defaultColor     || parent.defaultColor,
    ...(type.defaultDirection ?? parent.defaultDirection
      ? { defaultDirection: type.defaultDirection ?? parent.defaultDirection }
      : {}),
  }
}

export { uid }
