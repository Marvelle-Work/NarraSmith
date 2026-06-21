-- Asset Nodes: structured media containers, fourth pillar alongside
-- Entities, Relationships, and Concepts.

create table if not exists asset_nodes (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  client_id       text not null,
  title           text not null,
  entries         jsonb not null default '[]',
  linked_entity_ids jsonb not null default '[]',
  is_pinned_on_canvas boolean not null default false,
  position_x      double precision,
  position_y      double precision,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint asset_nodes_project_client_id unique (project_id, client_id)
);

-- RLS: same pattern as other tables — enforced at API layer via
-- service-role client, but policy exists for completeness.
alter table asset_nodes enable row level security;

create policy "Users can manage own project asset_nodes"
  on asset_nodes for all
  using (
    project_id in (
      select id from projects where owner_id = auth.uid()
    )
  );

-- Migrate legacy assets from project_data JSONB into asset_nodes.
-- Idempotent: skips rows where (project_id, client_id) already exists.
insert into asset_nodes (project_id, client_id, title, entries, linked_entity_ids, is_pinned_on_canvas, position_x, position_y)
select
  p.id as project_id,
  a->>'id' as client_id,
  coalesce(a->>'title', 'Untitled') as title,
  coalesce(a->'entries', '[]'::jsonb) as entries,
  coalesce(a->'linkedEntityIds', '[]'::jsonb) as linked_entity_ids,
  coalesce((a->>'isPinnedOnCanvas')::boolean, false) as is_pinned_on_canvas,
  (a->'position'->>'x')::double precision as position_x,
  (a->'position'->>'y')::double precision as position_y
from projects p,
     jsonb_array_elements(
       case
         when p.project_data->'assets' is not null
           and jsonb_typeof(p.project_data->'assets') = 'array'
         then p.project_data->'assets'
         else '[]'::jsonb
       end
     ) as a
where a->>'id' is not null
on conflict (project_id, client_id) do nothing;
