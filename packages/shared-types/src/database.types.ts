// Auto-regenerate after schema changes:
//   supabase gen types typescript --project-id <your-project-id> > packages/shared-types/src/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Schema JSON shapes ────────────────────────────────────────────────────────

export type SchemaFieldJson = {
  id: string
  name: string
  description?: string
  defaultValue?: string
  isBlock?: boolean
}

export type NodeTypeSchemaJson = {
  fields: SchemaFieldJson[]
  conceptSchemaIds?: string[]
}

export type RelationshipTypeSchemaJson = {
  fields: SchemaFieldJson[]
}

export type ConceptTypeSchemaJson = {
  fields: SchemaFieldJson[]
}

// Legacy types kept for backward compat
export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select'
export type FieldDefinition = {
  name: string
  type: FieldType
  required?: boolean
  options?: string[]
}
export type NodeTypeSchema = NodeTypeSchemaJson
export type RelationshipTypeSchema = RelationshipTypeSchemaJson

// ── Supabase Database type ────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          created_at: string | null
          project_data: Json | null
          project_data_version: number
          updated_at: string | null
          share_id: string | null
          visibility: string
          import_hash: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          created_at?: string | null
          project_data?: Json | null
          project_data_version?: number
          updated_at?: string | null
          share_id?: string | null
          visibility?: string
          import_hash?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          created_at?: string | null
          project_data?: Json | null
          project_data_version?: number
          updated_at?: string | null
          share_id?: string | null
          visibility?: string
          import_hash?: string | null
        }
        Relationships: []
      }
      node_types: {
        Row: {
          id: string
          client_id: string
          project_id: string
          name: string
          icon: string | null
          color: string | null
          description: string | null
          parent_id: string | null
          schema_json: NodeTypeSchemaJson
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          project_id: string
          name: string
          icon?: string | null
          color?: string | null
          description?: string | null
          parent_id?: string | null
          schema_json: NodeTypeSchemaJson
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          project_id?: string
          name?: string
          icon?: string | null
          color?: string | null
          description?: string | null
          parent_id?: string | null
          schema_json?: NodeTypeSchemaJson
          created_at?: string | null
        }
        Relationships: []
      }
      nodes: {
        Row: {
          id: string
          client_id: string
          project_id: string
          node_type_id: string
          title: string
          properties_json: Record<string, Json> | null
          position_x: number | null
          position_y: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          project_id: string
          node_type_id: string
          title: string
          properties_json?: Record<string, Json> | null
          position_x?: number | null
          position_y?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          project_id?: string
          node_type_id?: string
          title?: string
          properties_json?: Record<string, Json> | null
          position_x?: number | null
          position_y?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      relationship_types: {
        Row: {
          id: string
          client_id: string
          project_id: string
          name: string
          description: string | null
          default_color: string | null
          parent_id: string | null
          schema_json: RelationshipTypeSchemaJson | null
        }
        Insert: {
          id?: string
          client_id: string
          project_id: string
          name: string
          description?: string | null
          default_color?: string | null
          parent_id?: string | null
          schema_json?: RelationshipTypeSchemaJson | null
        }
        Update: {
          id?: string
          client_id?: string
          project_id?: string
          name?: string
          description?: string | null
          default_color?: string | null
          parent_id?: string | null
          schema_json?: RelationshipTypeSchemaJson | null
        }
        Relationships: []
      }
      relationships: {
        Row: {
          id: string
          client_id: string
          project_id: string
          source_node_id: string
          target_node_id: string
          relationship_type_id: string
          properties_json: Record<string, Json> | null
        }
        Insert: {
          id?: string
          client_id: string
          project_id: string
          source_node_id: string
          target_node_id: string
          relationship_type_id: string
          properties_json?: Record<string, Json> | null
        }
        Update: {
          id?: string
          client_id?: string
          project_id?: string
          source_node_id?: string
          target_node_id?: string
          relationship_type_id?: string
          properties_json?: Record<string, Json> | null
        }
        Relationships: []
      }
      concept_types: {
        Row: {
          id: string
          client_id: string
          project_id: string
          name: string
          description: string | null
          schema_json: ConceptTypeSchemaJson
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          project_id: string
          name: string
          description?: string | null
          schema_json: ConceptTypeSchemaJson
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          project_id?: string
          name?: string
          description?: string | null
          schema_json?: ConceptTypeSchemaJson
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
