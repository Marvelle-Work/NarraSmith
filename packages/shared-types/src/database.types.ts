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

export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select'

export type FieldDefinition = {
  name: string
  type: FieldType
  required?: boolean
  options?: string[] // only valid when type === 'select'
}

export type NodeTypeSchema = {
  fields: FieldDefinition[]
}

export type RelationshipTypeSchema = {
  fields: FieldDefinition[]
}

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
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      node_types: {
        Row: {
          id: string
          project_id: string
          name: string
          icon: string | null
          color: string | null
          schema_json: NodeTypeSchema
          created_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          icon?: string | null
          color?: string | null
          schema_json: NodeTypeSchema
          created_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          icon?: string | null
          color?: string | null
          schema_json?: NodeTypeSchema
          created_at?: string | null
        }
        Relationships: []
      }
      nodes: {
        Row: {
          id: string
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
          project_id: string
          name: string
          schema_json: RelationshipTypeSchema | null
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          schema_json?: RelationshipTypeSchema | null
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          schema_json?: RelationshipTypeSchema | null
        }
        Relationships: []
      }
      relationships: {
        Row: {
          id: string
          project_id: string
          source_node_id: string
          target_node_id: string
          relationship_type_id: string
          properties_json: Record<string, Json> | null
        }
        Insert: {
          id?: string
          project_id: string
          source_node_id: string
          target_node_id: string
          relationship_type_id: string
          properties_json?: Record<string, Json> | null
        }
        Update: {
          id?: string
          project_id?: string
          source_node_id?: string
          target_node_id?: string
          relationship_type_id?: string
          properties_json?: Record<string, Json> | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
