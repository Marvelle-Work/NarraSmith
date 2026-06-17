import { useState } from 'react'
import type { ConceptInstance, FieldBlock, GraphNode, NodeData } from './types'
import type { ConceptSchemaType } from './conceptSchema'
import type { SchemaField } from './schema'
import { uid } from './schema'
import { FieldBlockEditor } from './FieldBlockEditor'

type Props = {
  node: GraphNode
  conceptSchemas: ConceptSchemaType[]
  allowedConceptIds: string[]
  onUpdate: (patch: Partial<NodeData>) => void
}

export function ConceptObjectEditor({ node, conceptSchemas, allowedConceptIds, onUpdate }: Props) {
  const visibleSchemas = allowedConceptIds
    .map(id => conceptSchemas.find(cs => cs.id === id))
    .filter(Boolean) as ConceptSchemaType[]

  if (visibleSchemas.length === 0) return null

  const updateInstances = (schemaId: string, instances: ConceptInstance[]) => {
    const next = { ...(node.data.concepts ?? {}), [schemaId]: instances }
    onUpdate({ concepts: next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visibleSchemas.map(cs => (
        <ConceptSection
          key={cs.id}
          schema={cs}
          instances={(node.data.concepts ?? {})[cs.id] ?? []}
          onChange={insts => updateInstances(cs.id, insts)}
        />
      ))}
    </div>
  )
}

// ── Per-concept-type section ──────────────────────────────────────────────

function ConceptSection({ schema, instances, onChange }: {
  schema: ConceptSchemaType
  instances: ConceptInstance[]
  onChange: (instances: ConceptInstance[]) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const addInstance = () => {
    const inst: ConceptInstance = { id: uid(), label: '', typeId: schema.id, values: {} }
    onChange([...instances, inst])
  }

  const duplicateInstance = (inst: ConceptInstance) => {
    const copy: ConceptInstance = {
      id: uid(),
      label: inst.label ? `${inst.label} (copy)` : '',
      typeId: inst.typeId,
      values: { ...inst.values },
    }
    const idx = instances.findIndex(i => i.id === inst.id)
    const next = [...instances]
    next.splice(idx + 1, 0, copy)
    onChange(next)
  }

  const removeInstance = (id: string) => onChange(instances.filter(i => i.id !== id))

  const moveInstance = (id: string, dir: -1 | 1) => {
    const idx = instances.findIndex(i => i.id === id)
    if (idx < 0) return
    const next = [...instances]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  const patchInstance = (id: string, patch: Partial<ConceptInstance>) =>
    onChange(instances.map(i => (i.id === id ? { ...i, ...patch } : i)))

  const pluralName = schema.name.endsWith('s') ? schema.name : `${schema.name}s`

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '3px 0', marginBottom: collapsed ? 0 : 6, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 9, color: '#a1a1aa' }}>{collapsed ? '▶' : '▼'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {pluralName}
        </span>
        {instances.length > 0 && (
          <span style={{ fontSize: 11, color: '#a1a1aa' }}>({instances.length})</span>
        )}
      </button>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {instances.map((inst, i) => (
            <ConceptInstanceCard
              key={inst.id}
              schema={schema}
              instance={inst}
              index={i}
              total={instances.length}
              onMove={dir => moveInstance(inst.id, dir)}
              onDuplicate={() => duplicateInstance(inst)}
              onDelete={() => removeInstance(inst.id)}
              onPatch={patch => patchInstance(inst.id, patch)}
            />
          ))}
          <button
            onClick={addInstance}
            style={{
              padding: '5px 10px', background: 'transparent',
              border: '1px dashed #d4d4d8', borderRadius: 6,
              fontSize: 12, fontWeight: 600, color: '#52525b', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            + Add {schema.name}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Individual concept instance ───────────────────────────────────────────

function ConceptInstanceCard({ schema, instance, index, total, onMove, onDuplicate, onDelete, onPatch }: {
  schema: ConceptSchemaType
  instance: ConceptInstance
  index: number
  total: number
  onMove: (dir: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
  onPatch: (patch: Partial<ConceptInstance>) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const displayLabel = instance.label || `${schema.name} ${index + 1}`

  const updateValue = (fieldId: string, value: string | FieldBlock[]) =>
    onPatch({ values: { ...instance.values, [fieldId]: value } })

  return (
    <div style={{ border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 8px', background: '#faf0fe',
        borderBottom: collapsed ? 'none' : '1px solid #e4e4e7',
      }}>
        <button onClick={() => setCollapsed(c => !c)} style={miniBtn} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▶' : '▼'}
        </button>
        <input
          value={instance.label ?? ''}
          onChange={e => onPatch({ label: e.target.value })}
          placeholder={displayLabel}
          style={{
            flex: 1, background: 'transparent', border: 'none',
            fontSize: 12, fontWeight: 600, color: '#18181b',
            outline: 'none', minWidth: 0,
          }}
        />
        <button onClick={() => onMove(-1)} disabled={index === 0} style={miniBtn} title="Move up">▲</button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} style={miniBtn} title="Move down">▼</button>
        <button onClick={onDuplicate} style={miniBtn} title="Duplicate">⧉</button>
        <button onClick={onDelete} style={{ ...miniBtn, color: '#ef4444' }} title="Delete">✕</button>
      </div>

      {/* Fields */}
      {!collapsed && (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {schema.fields.length === 0 && (
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>No fields defined for this concept type</span>
          )}
          {schema.fields.map(f => (
            <FieldRow
              key={f.id}
              field={f}
              value={instance.values[f.id]}
              onChange={val => updateValue(f.id, val)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FieldRow({ field, value, onChange }: {
  field: SchemaField
  value: string | FieldBlock[] | undefined
  onChange: (val: string | FieldBlock[]) => void
}) {
  if (field.isBlock) {
    const blocks = Array.isArray(value) ? (value as FieldBlock[]) : []
    return (
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>
          {field.name}
        </span>
        <FieldBlockEditor
          fieldName={field.name}
          blocks={blocks}
          onChange={newBlocks => onChange(newBlocks)}
        />
      </div>
    )
  }

  const strValue = typeof value === 'string' ? value : ''
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a', flexShrink: 0, minWidth: 72 }}>
        {field.name}
      </span>
      <input
        value={strValue}
        onChange={e => onChange(e.target.value)}
        placeholder={field.description ?? ''}
        style={{
          flex: 1, padding: '4px 8px',
          border: '1px solid #e4e4e7', borderRadius: 5,
          fontSize: 12, color: '#18181b', background: '#fafafa',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const miniBtn: React.CSSProperties = {
  width: 20, height: 20, padding: 0, fontSize: 10,
  border: '1px solid #e4e4e7', borderRadius: 4,
  background: '#fff', cursor: 'pointer', color: '#71717a',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
