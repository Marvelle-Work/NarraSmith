-- Phase 6: Extend tables to support full frontend model + import pipeline

-- ── node_types: add parent inheritance and description ──────────────────
ALTER TABLE node_types
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES node_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- ── relationship_types: add color, description, parent ──────────────────
ALTER TABLE relationship_types
  ADD COLUMN IF NOT EXISTS default_color TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES relationship_types(id) ON DELETE SET NULL;

-- ── concept_types: new table for concept schemas ────────────────────────
CREATE TABLE IF NOT EXISTS concept_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  schema_json JSONB NOT NULL DEFAULT '{"fields": []}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE concept_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "concept_types: project owner access"
  ON concept_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = concept_types.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = concept_types.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- ── projects: add import_hash for deduplication ─────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS import_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_import_hash
  ON projects(import_hash) WHERE import_hash IS NOT NULL;
