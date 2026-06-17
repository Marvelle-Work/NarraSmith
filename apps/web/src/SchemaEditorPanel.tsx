import { useState } from 'react'
import type { SchemaType, SchemaField } from './schema'
import { resolveFields, uid } from './schema'

type Props = {
  schemaTypes: SchemaType[]
  onChange: (types: SchemaType[]) => void
  onClose: () => void
}

export function SchemaEditorPanel({ schemaTypes, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>(schemaTypes[0]?.id ?? '')

  const selected = schemaTypes.find(t => t.id === selectedId) ?? null

  // ── type-level mutations ──────────────────────────────────────────────
  function addType() {
    const id = `schema-${uid()}`
    onChange([...schemaTypes, { id, name: 'New Type', fields: [] }])
    setSelectedId(id)
  }

  function updateType(patch: Partial<SchemaType>) {
    onChange(schemaTypes.map(t => t.id === selectedId ? { ...t, ...patch } : t))
  }

  function deleteType() {
    // Unlink children instead of cascade-deleting them
    const next = schemaTypes
      .filter(t => t.id !== selectedId)
      .map(t => t.parentId === selectedId ? { ...t, parentId: undefined } : t)
    onChange(next)
    setSelectedId(next[0]?.id ?? '')
  }

  // ── field-level mutations ─────────────────────────────────────────────
  function addField() {
    if (!selected) return
    const field: SchemaField = { id: `field-${uid()}`, name: 'New Field', description: '' }
    updateType({ fields: [...selected.fields, field] })
  }

  function updateField(fieldId: string, patch: Partial<SchemaField>) {
    if (!selected) return
    updateType({ fields: selected.fields.map(f => f.id === fieldId ? { ...f, ...patch } : f) })
  }

  function deleteField(fieldId: string) {
    if (!selected) return
    updateType({ fields: selected.fields.filter(f => f.id !== fieldId) })
  }

  function moveField(fieldId: string, dir: -1 | 1) {
    if (!selected) return
    const idx = selected.fields.findIndex(f => f.id === fieldId)
    if (idx < 0) return
    const next = [...selected.fields]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    updateType({ fields: next })
  }

  // ── tree helpers ──────────────────────────────────────────────────────
  const roots = schemaTypes.filter(t => !t.parentId)
  const childrenOf = (id: string) => schemaTypes.filter(t => t.parentId === id)
  const inheritedFields = selected
    ? resolveFields(selected.id, schemaTypes).filter(f => f.inherited)
    : []

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
        width: 'min(760px, 95vw)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #e4e4e7',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#18181b' }}>
              Schema Editor
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#71717a' }}>
              Define entity types and their storytelling fields — all values are plain text
            </p>
          </div>
          <button onClick={onClose} style={iconBtn}>✕</button>
        </div>

        {/* ── Body ── */}
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
                />
              ))}
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid #e4e4e7' }}>
              <button onClick={addType} style={ghostBtn}>+ New Type</button>
            </div>
          </div>

          {/* Right: type editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a1a1aa', fontSize: 14 }}>
                Select a type to edit
              </div>
            ) : (
              <>
                {/* Name */}
                <EditorField label="Name">
                  <input
                    value={selected.name}
                    onChange={e => updateType({ name: e.target.value })}
                    style={{ ...textInput, fontSize: 16, fontWeight: 600 }}
                  />
                </EditorField>

                {/* Parent */}
                <EditorField label="Inherits From">
                  <select
                    value={selected.parentId ?? ''}
                    onChange={e => updateType({ parentId: e.target.value || undefined })}
                    style={textInput}
                  >
                    <option value="">— None —</option>
                    {schemaTypes
                      .filter(t => t.id !== selected.id)
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    }
                  </select>
                </EditorField>

                {/* Inherited fields (read-only) */}
                {inheritedFields.length > 0 && (
                  <EditorField label={`Inherited from ${schemaTypes.find(t => t.id === selected.parentId)?.name ?? 'parent'}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {inheritedFields.map(f => (
                        <div key={f.id} style={{
                          padding: '6px 10px',
                          background: '#f4f4f5', borderRadius: 6,
                          display: 'flex', gap: 8, fontSize: 13,
                        }}>
                          <span style={{ fontWeight: 600, color: '#52525b', minWidth: 90 }}>{f.name}</span>
                          <span style={{ color: '#a1a1aa' }}>{f.description}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                            ↑ {f.fromTypeName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </EditorField>
                )}

                {/* Own fields */}
                <EditorField label="Fields">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.fields.length === 0 && (
                      <p style={{ margin: 0, fontSize: 13, color: '#a1a1aa' }}>No fields yet — add one below</p>
                    )}
                    {selected.fields.map((f, i) => (
                      <div key={f.id} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        padding: '10px 12px',
                        border: '1px solid #e4e4e7', borderRadius: 8,
                        background: '#fff',
                      }}>
                        {/* Reorder */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                          <button onClick={() => moveField(f.id, -1)} disabled={i === 0} style={arrowBtn}>▲</button>
                          <button onClick={() => moveField(f.id, 1)} disabled={i === selected.fields.length - 1} style={arrowBtn}>▼</button>
                        </div>
                        {/* Inputs */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            value={f.name}
                            onChange={e => updateField(f.id, { name: e.target.value })}
                            placeholder="Field name"
                            style={textInput}
                          />
                          <input
                            value={f.description ?? ''}
                            onChange={e => updateField(f.id, { description: e.target.value })}
                            placeholder="Hint shown as placeholder when editing entities"
                            style={{ ...textInput, fontSize: 12, color: '#71717a' }}
                          />
                        </div>
                        <button onClick={() => deleteField(f.id)} style={iconBtn}>✕</button>
                      </div>
                    ))}
                    <button onClick={addField} style={ghostBtn}>+ Add Field</button>
                  </div>
                </EditorField>

                {/* Delete */}
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

function TypeTree({ type, depth, selectedId, onSelect, childrenOf }: {
  type: SchemaType
  depth: number
  selectedId: string
  onSelect: (id: string) => void
  childrenOf: (id: string) => SchemaType[]
}) {
  const active = type.id === selectedId
  return (
    <>
      <button
        onClick={() => onSelect(type.id)}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: `7px 16px 7px ${14 + depth * 14}px`,
          background: active ? '#f3f0ff' : 'transparent',
          border: 'none',
          borderLeft: active ? '3px solid #7c3aed' : '3px solid transparent',
          color: active ? '#5b21b6' : '#18181b',
          fontSize: 13, fontWeight: active ? 600 : 400,
          cursor: 'pointer',
        }}
      >
        {depth > 0 && <span style={{ color: '#c4c4c7', marginRight: 5 }}>└</span>}
        {type.name}
        {type.fields.length > 0 && (
          <span style={{ marginLeft: 6, fontSize: 11, color: active ? '#7c3aed' : '#a1a1aa' }}>
            {type.fields.length}f
          </span>
        )}
      </button>
      {childrenOf(type.id).map(child => (
        <TypeTree key={child.id} type={child} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect} childrenOf={childrenOf} />
      ))}
    </>
  )
}

function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#52525b',
        textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        {label}
      </span>
      {children}
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

const arrowBtn: React.CSSProperties = {
  width: 18, height: 18, padding: 0, fontSize: 9,
  border: '1px solid #e4e4e7', borderRadius: 4,
  background: '#fafafa', cursor: 'pointer', color: '#71717a',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
}
