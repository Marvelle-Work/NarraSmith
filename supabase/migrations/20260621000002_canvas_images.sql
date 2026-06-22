-- Canvas Images: spatial visual references on the infinite graph canvas.
-- Fifth pillar alongside Entities, Relationships, Concepts, and Assets.

create table if not exists canvas_images (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  client_id       text not null,
  title           text not null,
  image_url       text not null,
  position_x      double precision not null default 0,
  position_y      double precision not null default 0,
  width           double precision not null default 400,
  height          double precision not null default 300,
  rotation        double precision not null default 0,
  opacity         double precision not null default 1,
  locked          boolean not null default false,
  z_index         integer not null default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint canvas_images_project_client_id unique (project_id, client_id)
);

alter table canvas_images enable row level security;

create policy "Users can manage own project canvas_images"
  on canvas_images for all
  using (
    project_id in (
      select id from projects where owner_id = auth.uid()
    )
  );
