export type { Json, FieldType, FieldDefinition, NodeTypeSchema, RelationshipTypeSchema, Database } from './database.types.js'

// ── Row convenience types ─────────────────────────────────────────────────────

import type { Database } from './database.types.js'

type Tables = Database['public']['Tables']

export type Project          = Tables['projects']['Row']
export type NodeType         = Tables['node_types']['Row']
export type Node             = Tables['nodes']['Row']
export type RelationshipType = Tables['relationship_types']['Row']
export type Relationship     = Tables['relationships']['Row']

// ── Insert / Update convenience types ────────────────────────────────────────

export type InsertProject          = Tables['projects']['Insert']
export type InsertNodeType         = Tables['node_types']['Insert']
export type InsertNode             = Tables['nodes']['Insert']
export type InsertRelationshipType = Tables['relationship_types']['Insert']
export type InsertRelationship     = Tables['relationships']['Insert']

export type UpdateProject          = Tables['projects']['Update']
export type UpdateNodeType         = Tables['node_types']['Update']
export type UpdateNode             = Tables['nodes']['Update']
export type UpdateRelationshipType = Tables['relationship_types']['Update']
export type UpdateRelationship     = Tables['relationships']['Update']
