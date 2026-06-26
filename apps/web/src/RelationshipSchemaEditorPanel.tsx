import { useState } from 'react'
import { ColorPicker } from './ColorPicker'
import {
  resolveRelationshipType, uid,
  type RelationshipType, type RelationshipDirection,
} from './relationshipSchema'

type Props = {
  relationshipTypes: RelationshipType[]
  onChange: (types: RelationshipType[]) => void
  onClose: () => void
}

export function RelationshipSchemaEditorPanel({ relationshipTypes, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>(relationshipTypes[0]?.id ?? '')

  const selected = relationshipTypes.find(t => t.id === selectedId) ?? null

  function addType() {
    const id = `rel-${uid()}`
    onChange([...relationshipTypes, { id, name: 'New Type' }])
    setSelectedId(id)
  }

  function updateType(patch: Partial<RelationshipType>) {
    onChange(relationshipTypes.map(t => t.id === selectedId ? { ...t, ...patch } : t))
  }

  function deleteType() {
    const next = relationshipTypes
      .filter(t => t.id !== selectedId)
      .map(t => t.parentId === selectedId ? { ...t, parentId: undefined } : t)
    onChange(next)
    setSelectedId(next[0]?.id ?? '')
  }

  const roots = relationshipTypes.filter(t => !t.parentId)
  const childrenOf = (id: string) => relationshipTypes.filter(t => t.parentId === id)

  const resolvedSelected = selected ? resolveRelationshipType(selected.id, relationshipTypes) : null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 2000,
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 14,
        width: 'min(680px, 95vw)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #e4e4e7',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#18181b' }}>
              Relationship Schema
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#71717a' }}>
              Define relationship types and their default colors — for narrative clarity, not enforcement
            </p>
          </div>
          <button onClick={onClose} style={iconBtn}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: type list */}
          <div style={{
            width: 210,
            borderRight: '1px solid #e4e4e7',
            display: 'flex', flexDirection: 'column',
            background: '#fafafa',
          }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
              {roots.length === 0 && (
                <p style={{ padding: '8px 16px', fontSize: 13, color: '#a1a1aa' }}>No types yet</p>
              )}
              {roots.map(t => (
                <TypeTree
                  key={t.id}
                  type={t}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  childrenOf={childrenOf}
                  allTypes={relationshipTypes}
                />
              ))}
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid #e4e4e7' }}>
              <button onClick={addType} style={ghostBtn}>+ New Type</button>
            </div>
          </div>

          {/* Right: editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a1a1aa', fontSize: 14 }}>
                Select a type to edit
              </div>
            ) : (
              <>
                <EditorField label="Name">
                  <input
                    value={selected.name}
                    onChange={e => updateType({ name: e.target.value })}
                    style={{ ...textInput, fontSize: 16, fontWeight: 600 }}
                  />
                </EditorField>

                <EditorField label="Description">
                  <input
                    value={selected.description ?? ''}
                    onChange={e => updateType({ description: e.target.value })}
                    placeholder="What does this relationship mean in your story?"
                    style={textInput}
                  />
                  {selected.parentId && resolvedSelected?.description && resolvedSelected.description !== selected.description && (
                    <span style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>
                      ↑ inherited: {resolvedSelected.description}
                    </span>
                  )}
                </EditorField>

                <EditorField label="Inherits From">
                  <select
                    value={selected.parentId ?? ''}
                    onChange={e => updateType({ parentId: e.target.value || undefined })}
                    style={textInput}
                  >
                    <option value="">— None —</option>
                    {relationshipTypes
                      .filter(t => t.id !== selected.id)
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    }
                  </select>
                </EditorField>

                <EditorField label="Default Color">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ColorPicker
                      value={selected.defaultColor}
                      onChange={c => updateType({ defaultColor: c || undefined })}
                    />
                    {selected.parentId && !selected.defaultColor && resolvedSelected?.defaultColor && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a1a1aa' }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: resolvedSelected.defaultColor, flexShrink: 0,
                        }} />
                        ↑ inherited from parent
                      </div>
                    )}
                  </div>
                </EditorField>

                <EditorField label="Default Direction">
                  <SchemaDirectionControl
                    direction={selected.defaultDirection ?? 'undirected'}
                    onChange={d => updateType({ ...(d === 'undirected' ? { defaultDirection: undefined } : { defaultDirection: d }) })}
                  />
                  {selected.parentId && !selected.defaultDirection && resolvedSelected?.defaultDirection && (
                    <span style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>
                      ↑ inherited: {resolvedSelected.defaultDirection}
                    </span>
                  )}
                </EditorField>

                <div style={{ paddingTop: 8, borderTop: '1px solid #fee2e2', marginTop: 'auto' }}>
                  <button
                    onClick={deleteType}
                    style={{
                      padding: '7px 14px',
                      background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: 6, color: '#dc2626',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Delete "{selected.name}"
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function TypeTree({ type, depth, selectedId, onSelect, childrenOf, allTypes }: {
  type: RelationshipType
  depth: number
  selectedId: string
  onSelect: (id: string) => void
  childrenOf: (id: string) => RelationshipType[]
  allTypes: RelationshipType[]
}) {
  const active = type.id === selectedId
  const resolved = resolveRelationshipType(type.id, allTypes)
  const color = resolved?.defaultColor ?? '#a1a1aa'

  return (
    <>
      <button
        onClick={() => onSelect(type.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', textAlign: 'left',
          padding: `7px 16px 7px ${14 + depth * 14}px`,
          background: active ? '#f3f0ff' : 'transparent',
          border: 'none',
          borderLeft: active ? '3px solid #7c3aed' : '3px solid transparent',
          color: active ? '#5b21b6' : '#18181b',
          fontSize: 13, fontWeight: active ? 600 : 400,
          cursor: 'pointer',
        }}
      >
        {depth > 0 && <span style={{ color: '#c4c4c7', marginRight: 2 }}>└</span>}
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, flexShrink: 0,
          border: '1.5px solid rgba(0,0,0,0.1)',
        }} />
        {type.name}
      </button>
      {childrenOf(type.id).map(child => (
        <TypeTree
          key={child.id}
          type={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          childrenOf={childrenOf}
          allTypes={allTypes}
        />
      ))}
    </>
  )
}

function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function SchemaDirectionControl({ direction, onChange }: { direction: RelationshipDirection; onChange: (d: RelationshipDirection) => void }) {
  const opts: { value: RelationshipDirection; label: string; title: string }[] = [
    { value: 'undirected',    label: '—',  title: 'No default (undirected)' },
    { value: 'directed',      label: '→',  title: 'Directed (A → B)' },
    { value: 'bidirectional', label: '⇄', title: 'Bidirectional (A ⇄ B)' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {opts.map(opt => (
        <button
          key={opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '5px 0', fontFamily: 'inherit',
            border: `1.5px solid ${direction === opt.value ? '#7c3aed' : '#d4d4d8'}`,
            borderRadius: 6,
            background: direction === opt.value ? '#f3f0ff' : 'transparent',
            color: direction === opt.value ? '#5b21b6' : '#52525b',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const textInput: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #d4d4d8', borderRadius: 6,
  fontSize: 14, color: '#18181b', background: '#fff',
  width: '100%', boxSizing: 'border-box', outline: 'none',
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, flexShrink: 0,
  border: '1px solid #e4e4e7', borderRadius: 6,
  background: '#fafafa', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, color: '#71717a', padding: 0,
}

const ghostBtn: React.CSSProperties = {
  padding: '7px 12px',
  background: 'transparent', border: '1px dashed #d4d4d8',
  borderRadius: 6, fontSize: 13, fontWeight: 600,
  color: '#52525b', cursor: 'pointer', width: '100%',
  textAlign: 'left',
}
