-- Phase 6: Add blob storage, versioning, and sharing to projects

ALTER TABLE projects
  ADD COLUMN project_data JSONB,
  ADD COLUMN project_data_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN share_id UUID UNIQUE,
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'view'));

CREATE INDEX idx_projects_share_id ON projects(share_id) WHERE share_id IS NOT NULL;
