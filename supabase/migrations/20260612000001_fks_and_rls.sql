-- ============================================================
-- Foreign Keys
-- ============================================================

-- projects.owner_id → auth.users
ALTER TABLE projects
  ADD CONSTRAINT fk_projects_owner
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- node_types.project_id → projects
ALTER TABLE node_types
  ADD CONSTRAINT fk_node_types_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- nodes.project_id → projects
ALTER TABLE nodes
  ADD CONSTRAINT fk_nodes_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- nodes.node_type_id → node_types
-- RESTRICT: must delete nodes before deleting their type
ALTER TABLE nodes
  ADD CONSTRAINT fk_nodes_node_type
  FOREIGN KEY (node_type_id) REFERENCES node_types(id) ON DELETE RESTRICT;

-- relationship_types.project_id → projects
ALTER TABLE relationship_types
  ADD CONSTRAINT fk_relationship_types_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- relationships.project_id → projects
ALTER TABLE relationships
  ADD CONSTRAINT fk_relationships_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- relationships.source_node_id → nodes
-- CASCADE: deleting a node removes all edges attached to it
ALTER TABLE relationships
  ADD CONSTRAINT fk_relationships_source_node
  FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE;

-- relationships.target_node_id → nodes
ALTER TABLE relationships
  ADD CONSTRAINT fk_relationships_target_node
  FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE;

-- relationships.relationship_type_id → relationship_types
-- RESTRICT: must delete relationships before deleting their type
ALTER TABLE relationships
  ADD CONSTRAINT fk_relationships_type
  FOREIGN KEY (relationship_type_id) REFERENCES relationship_types(id) ON DELETE RESTRICT;


-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships      ENABLE ROW LEVEL SECURITY;

-- projects: only the owner can see or modify their own projects
CREATE POLICY "projects: owner access"
  ON projects FOR ALL
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- node_types: accessible only if the user owns the parent project
CREATE POLICY "node_types: project owner access"
  ON node_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = node_types.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = node_types.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- nodes: accessible only if the user owns the parent project
CREATE POLICY "nodes: project owner access"
  ON nodes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = nodes.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = nodes.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- relationship_types: accessible only if the user owns the parent project
CREATE POLICY "relationship_types: project owner access"
  ON relationship_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationship_types.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationship_types.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- relationships: accessible only if the user owns the parent project
CREATE POLICY "relationships: project owner access"
  ON relationships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationships.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationships.project_id
        AND projects.owner_id = auth.uid()
    )
  );
