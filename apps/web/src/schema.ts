export type SchemaField = {
  id: string
  name: string
  description?: string
  defaultValue?: string
}

export type SchemaType = {
  id: string
  name: string
  parentId?: string
  fields: SchemaField[]
}

export type ResolvedField = SchemaField & {
  inherited: boolean
  fromTypeName: string
}

export const SCHEMA_STORAGE_KEY = 'narrasmith-schema'

export const DEFAULT_SCHEMA_TYPES: SchemaType[] = [
  {
    id: 'schema-character',
    name: 'Character',
    fields: [
      { id: 'f-char-role',       name: 'Role',       description: 'e.g. Protagonist, Antagonist, Mentor' },
      { id: 'f-char-motivation', name: 'Motivation', description: 'What drives this character?' },
      { id: 'f-char-arc',        name: 'Arc',        description: 'How does this character change over time?' },
    ],
  },
  {
    id: 'schema-event',
    name: 'Event',
    fields: [
      { id: 'f-event-when',        name: 'When',        description: 'When does this occur in the story?' },
      { id: 'f-event-trigger',     name: 'Trigger',     description: 'What causes this event?' },
      { id: 'f-event-consequence', name: 'Consequence', description: 'What changes after this event?' },
    ],
  },
  {
    id: 'schema-location',
    name: 'Location',
    fields: [
      { id: 'f-loc-atmosphere',   name: 'Atmosphere',   description: 'The mood or feel of this place' },
      { id: 'f-loc-significance', name: 'Significance', description: 'Why does this place matter to the story?' },
      { id: 'f-loc-inhabitants',  name: 'Inhabitants',  description: 'Who or what lives here?' },
    ],
  },
  {
    id: 'schema-object',
    name: 'Object',
    fields: [
      { id: 'f-obj-function',     name: 'Function',     description: 'What does this object do?' },
      { id: 'f-obj-origin',       name: 'Origin',       description: 'Where did it come from?' },
      { id: 'f-obj-significance', name: 'Significance', description: 'Why does this object matter to the story?' },
    ],
  },
]

export function loadSchemaTypes(): SchemaType[] {
  try {
    const raw = localStorage.getItem(SCHEMA_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SchemaType[]
  } catch {}
  return DEFAULT_SCHEMA_TYPES
}

export function saveSchemaTypes(types: SchemaType[]): void {
  localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(types))
}

// Walk the parent chain and return all fields, inherited first.
// Child fields with the same name (case-insensitive) override parent fields.
export function resolveFields(typeId: string, schemaTypes: SchemaType[]): ResolvedField[] {
  const type = schemaTypes.find(t => t.id === typeId)
  if (!type) return []

  const parentFields = type.parentId ? resolveFields(type.parentId, schemaTypes) : []
  const ownNames = new Set(type.fields.map(f => f.name.toLowerCase()))

  const inherited = parentFields
    .filter(f => !ownNames.has(f.name.toLowerCase()))

  const own: ResolvedField[] = type.fields.map(f => ({
    ...f,
    inherited: false,
    fromTypeName: type.name,
  }))

  return [...inherited, ...own]
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
