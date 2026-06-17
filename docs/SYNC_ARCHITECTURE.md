# Narrasmith — Sync Architecture Design (Phase 3)

> Status: **Design only.** No Supabase calls, no auth, no network requests.
> Implementation target: Phase 4 (future).

---

## 1. Core Principle

**localStorage is the authoritative source of truth** for all project data.
Any future cloud persistence is a sync layer on top of it — not a replacement.

The system must remain fully functional offline. Cloud sync is additive,
never load-bearing.

---

## 2. Data Separation

### 2.1 What is RAW (stored)

Only raw, user-authored data is persisted. Nothing derived.

| Category | What is stored |
|---|---|
| Nodes | `id`, `position`, `data.label`, `data.entityType`, `data.typeId`, `data.fields`, `data.description`, `data.color`, `data.sizeLevel` |
| Edges | `id`, `source`, `target`, `label`, `data.labelT`, `data.color`, `data.relationshipTypeId`, `data.description` |
| Entity schema | `SchemaType[]` — id, name, parentId, fields[] |
| Relationship schema | `RelationshipType[]` — id, name, parentId, description, defaultColor |

### 2.2 What is DERIVED (never stored)

Derived values are recomputed at runtime from the raw data above.

| Derived value | Source | Where computed |
|---|---|---|
| Resolved entity fields | `typeId` + `SchemaType[]` (parent chain) | `resolveFields()` in `schema.ts` |
| Resolved relationship type | `relationshipTypeId` + `RelationshipType[]` (parent chain) | `resolveRelationshipType()` in `relationshipSchema.ts` |
| Edge `schemaColor` snapshot | `relationshipTypeId` → resolved `defaultColor` | `resolveEdgeStyle()` in `GraphEditor.tsx`, re-synced via `useEffect` on `relTypes` change |
| Node visual size / font | `sizeLevel` → `SIZE_LEVELS[level]` | `CircleNode.tsx` at render time |
| Edge stroke style | `data.color` → `data.schemaColor` → `edgeStyleForLabel(label)` | `RelationshipEdge.tsx` at render time |

> **Rule:** `schemaColor` on edges is a render-performance snapshot, not authoritative data.
> It is re-derived whenever `relTypes` changes. The sync layer must NOT treat it as
> canonical — it can be omitted from cloud writes and reconstructed on load.

---

## 3. Storage Structure (Phase 2 — current)

All data lives in a single localStorage key: **`narrasmith-projects`**

```
narrasmith-projects: ProjectStore {
  version: 1
  activeProjectId: string
  projects: {
    [projectId]: ProjectData {
      id: string
      name: string
      createdAt: string
      graph: {
        nodes: RawNode[]
        edges: RawEdge[]
      }
      entitySchema: SchemaType[]
      relSchema: RelationshipType[]
    }
  }
}
```

Separate key for UI preference (not project data, not synced):
```
narrasmith-ui-mode: 'story' | 'system'
```

---

## 4. Schema Handling Rules

1. **Schema types are per-project.** `entitySchema` and `relSchema` live inside
   `ProjectData`. There is no global schema. Two projects may define the same
   type name independently.

2. **Inheritance is always resolved at runtime.** `SchemaType.parentId` and
   `RelationshipType.parentId` are stored as references. The resolved field list
   is never stored — it is recomputed by `resolveFields()` / `resolveRelationshipType()`
   on every render.

3. **Child overrides parent by name (case-insensitive).** If a child type defines
   a field with the same name as a parent field, the child's version wins.

4. **Schema deletion is non-cascading.** Deleting a `SchemaType` unlinks its
   children (sets `parentId: undefined`) but does not delete them. Entity nodes
   that referenced the deleted type retain their `typeId` but will resolve to
   no fields (graceful degradation).

5. **`typeId` on nodes is a soft reference.** If the referenced `SchemaType` no
   longer exists, the node continues to function — it just shows no schema fields.
   No error is thrown. The sync layer must preserve this soft-reference semantics.

---

## 5. Relationship Handling Rules

1. **`relationshipTypeId` on edges is a soft reference.** If the referenced
   `RelationshipType` is deleted, the edge retains its `label` and `data.color`
   but loses the type association. It falls back to `edgeStyleForLabel(label)`.

2. **Color priority chain (enforced in `RelationshipEdge.tsx`):**
   ```
   data.color (manual)
     → data.schemaColor (snapshot from schema)
       → style.stroke (set at creation from edgeStyleForLabel or schema)
   ```

3. **`schemaColor` is a snapshot, not canonical.** It is recomputed whenever
   `relTypes` changes (via `useEffect` in `GraphEditor`). The sync layer should
   omit `schemaColor` from cloud writes; it will be regenerated on load.

4. **Label and type name can diverge.** Once a user sets a label manually,
   it is independent of the `RelationshipType.name`. Renaming a schema type
   does NOT rename existing edge labels.

---

## 6. Sync Contract

### 6.1 Layers

```
┌─────────────────────────────────────────────┐
│  React State (runtime)                       │
│  nodes, edges, schemaTypes, relTypes         │
└──────────────┬──────────────────────────────┘
               │  read/write
┌──────────────▼──────────────────────────────┐
│  Local Model  (authoritative)                │
│  projectStore.ts → narrasmith-projects       │
└──────────────┬──────────────────────────────┘
               │  future: sync adapter
┌──────────────▼──────────────────────────────┐
│  Sync Adapter Layer  (not yet implemented)   │
│  - serializes ProjectData → Supabase format  │
│  - handles conflict resolution               │
│  - debounces writes (e.g. 2s idle)          │
│  - queues writes for offline replay          │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  External Persistence  (Supabase)            │
│  tables: projects, nodes, node_types,        │
│          relationships, relationship_types   │
└─────────────────────────────────────────────┘
```

### 6.2 Sync adapter responsibilities (design only)

The sync adapter will sit between `projectStore.ts` and Supabase. It must:

- **Never block the UI.** All writes are fire-and-forget. The local store
  is always written first; cloud write happens asynchronously after.

- **Last-write-wins** conflict resolution for the initial implementation.
  More sophisticated conflict handling (e.g. operational transforms) is
  out of scope.

- **Not sync derived data.** `schemaColor`, resolved fields, and computed
  styles are stripped before upload and regenerated after download.

- **Scope all records to a `project_id`.** Every row in every Supabase
  table is owned by a project, and every project is owned by a user
  (`owner_id = auth.uid()` via RLS).

### 6.3 What must NOT change for Phase 4 readiness

- `ProjectData` shape must remain the canonical local model.
- `saveProjectStore` / `loadProjectStore` remain the single I/O interface.
- The sync adapter calls `loadProjectStore()` on init and `saveProjectStore()`
  after a successful cloud pull — no direct localStorage access from the
  adapter.
- UI code never knows whether data came from local or cloud.

---

## 7. Schema→Supabase Table Mapping (future reference)

| Local field | Supabase table | Notes |
|---|---|---|
| `ProjectData.id` / `name` | `projects` | `owner_id` from auth |
| `ProjectData.graph.nodes[]` | `nodes` | position stored as JSONB |
| `ProjectData.entitySchema[]` | `node_types` | `parent_id` for inheritance |
| `node SchemaField[]` | `node_types.fields` JSONB | stored as array |
| `ProjectData.graph.edges[]` | `relationships` | label, color, labelT |
| `ProjectData.relSchema[]` | `relationship_types` | `parent_id`, `default_color` |

> The existing Supabase migration (`20260612000001_fks_and_rls.sql`) already
> defines the FK constraints and RLS policies for these tables. Column shapes
> will need a new migration to align with `ProjectData` (e.g. adding `fields`
> JSONB to `node_types`, `default_color` to `relationship_types`, etc.).

---

## 8. Phase 4 Readiness Checklist

Before implementing Supabase integration, verify:

- [ ] User auth is wired (Supabase Auth, session persisted)
- [ ] Each `ProjectData` has a stable UUID (`id`) used as the Supabase row key
- [ ] `makeDefaultProject()` generates a UUID `id` (currently uses `'default'`)
- [ ] A new migration aligns Supabase column shapes with `ProjectData`
- [ ] The sync adapter interface is defined as a TypeScript interface before
      implementation (enables swapping Supabase for another backend later)
- [ ] Offline queue is designed (IndexedDB or localStorage side-channel)
- [ ] Conflict resolution policy is decided (last-write-wins vs CRDT)
