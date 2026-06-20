-- Add client_id TEXT column to all relational tables.
-- client_id stores the frontend-generated ID (e.g. "schema-character", "node-123").
-- The UUID primary key remains the internal FK reference.
-- UNIQUE(project_id, client_id) allows upsert-by-client-id within a project.

-- ── node_types ─────────────────────────────────────────────────────────────────
ALTER TABLE node_types ADD COLUMN IF NOT EXISTS client_id TEXT;
UPDATE node_types SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE node_types ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE node_types ADD CONSTRAINT uq_node_types_project_client
  UNIQUE (project_id, client_id);

-- ── nodes ──────────────────────────────────────────────────────────────────────
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS client_id TEXT;
UPDATE nodes SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE nodes ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE nodes ADD CONSTRAINT uq_nodes_project_client
  UNIQUE (project_id, client_id);

-- ── relationship_types ─────────────────────────────────────────────────────────
ALTER TABLE relationship_types ADD COLUMN IF NOT EXISTS client_id TEXT;
UPDATE relationship_types SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE relationship_types ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE relationship_types ADD CONSTRAINT uq_relationship_types_project_client
  UNIQUE (project_id, client_id);

-- ── relationships ──────────────────────────────────────────────────────────────
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS client_id TEXT;
UPDATE relationships SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE relationships ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE relationships ADD CONSTRAINT uq_relationships_project_client
  UNIQUE (project_id, client_id);

-- ── concept_types ──────────────────────────────────────────────────────────────
ALTER TABLE concept_types ADD COLUMN IF NOT EXISTS client_id TEXT;
UPDATE concept_types SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE concept_types ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE concept_types ADD CONSTRAINT uq_concept_types_project_client
  UNIQUE (project_id, client_id);
