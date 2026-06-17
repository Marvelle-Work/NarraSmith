import { useState } from 'react'
import type { ConceptSchemaType } from './conceptSchema'
import type { SchemaField } from './schema'
import { uid } from './schema'

type Props = {
  conceptSchemas: ConceptSchemaType[]
  onChange: (schemas: ConceptSchemaType[]) => void
  onClose: () => void
}

export function ConceptSchemaEditorPanel({ conceptSchemas, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>(conceptSchemas[0]?.id ?? '')

  const selected = conceptSchemas.find(cs => cs.id === selectedId) ?? null

  function addType() {
    const id = `concept-${uid()}`
    const cs: ConceptSchemaType = { id, name: 'New Concept', fields: [] }
    onChange([...conceptSchemas, cs])
    setSelectedId(id)
  }

  function updateSelected(patch: Partial<ConceptSchemaType>) {
    if (!selected) return
    onChange(conceptSchemas.map(cs => cs.id === selected.id ? { ...cs, ...patch } : cs))
  }

  function deleteSelected() {
    const next = conceptSchemas.filter(cs => cs.id !== selected?.id)
    onChange(next)
    setSelectedId(next[0]?.id ?? '')
  }

  function addField() {
    if (!selected) return
    const f: SchemaField = { id: `cf-${uid()}`, name: 'New Field', description: '' }
    updateSelected({ fields: [...selected.fields, f] })
  }

  function updateField(fieldId: string, patch: Partial<SchemaField>) {
    if (!selected) return
    updateSelected({ fields: selected.fields.map(f => f.id === fieldId ? { ...f, ...patch } : f) })
  }

  function deleteField(fieldId: string) {
    if (!selected) return
    updateSelected({ fields: selected.fields.filter(f => f.id !== fieldId) })
  }

  function moveField(fieldId: string, dir: -1 | 1) {
    if (!selected) return
    const idx = selected.fields.findIndex(f => f.id === fieldId)
    if (idx < 0) return
    const next = [...selected.fields]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    updateSelected({ fields: next })
  }

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
        background: '#fff', borderRadius: 14,
        width: 'min(720px, 95vw)', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e4e4e7', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#18181b' }}>
              Concept Schema Editor
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#71717a' }}>
              Define reusable mechanics — Techniques, Items, Spells, Skills — and attach them to entity types
            </p>
          </div>
          <button onClick={onClose} style={iconBtn}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: concept type list */}
          <div style={{
            width: 200, borderRight: '1px solid #e4e4e7',
            display: 'flex', flexDirection: 'column', background: '#fafafa',
          }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
              {conceptSchemas.length === 0 && (
                <p style={{ padding: '8px 16px', fontSize: 13, color: '#a1a1aa' }}>No concepts yet</p>
              )}
              {conceptSchemas.map(cs => {
                const active = cs.id === selectedId
                return (
                  <button
                    key={cs.id}
                    onClick={() => setSelectedId(cs.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 16px',
                      background: active ? '#faf0fe' : 'transparent',
                      border: 'none',
                      borderLeft: active ? '3px solid #a855f7' : '3px solid transparent',
                      color: active ? '#7e22ce' : '#18181b',
                      fontSize: 13, fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {cs.name}
                    {cs.fields.length > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: active ? '#a855f7' : '#a1a1aa' }}>
                        {cs.fields.length}f
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid #e4e4e7' }}>
              <button onClick={addType} style={ghostBtn}>+ New Concept</button>
            </div>
          </div>

          {/* Right: editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a1a1aa', fontSize: 14 }}>
                Select a concept to edit
              </div>
            ) : (
              <>
                <EditorField label="Name">
                  <input
                    value={selected.name}
                    onChange={e => updateSelected({ name: e.target.value })}
                    style={{ ...textInput, fontSize: 16, fontWeight: 600 }}
                  />
                </EditorField>

                <EditorField label="Description">
                  <input
                    value={selected.description ?? ''}
                    onChange={e => updateSelected({ description: e.target.value || undefined })}
                    placeholder="Optional description of what this concept represents"
                    style={textInput}
                  />
                </EditorField>

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                          <button onClick={() => moveField(f.id, -1)} disabled={i === 0} style={arrowBtn}>▲</button>
                          <button onClick={() => moveField(f.id, 1)} disabled={i === selected.fields.length - 1} style={arrowBtn}>▼</button>
                        </div>
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
                            placeholder="Hint shown when editing concept instances"
                            style={{ ...textInput, fontSize: 12, color: '#71717a' }}
                          />
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 12, color: '#52525b', cursor: 'pointer', userSelect: 'none',
                          }}>
                            <input
                              type="checkbox"
                              checked={f.isBlock ?? false}
                              onChange={e => updateField(f.id, { isBlock: e.target.checked })}
                              style={{ cursor: 'pointer' }}
                            />
                            Structured blocks (repeatable groups)
                          </label>
                        </div>
                        <button onClick={() => deleteField(f.id)} style={iconBtn}>✕</button>
                      </div>
                    ))}
                    <button onClick={addField} style={ghostBtn}>+ Add Field</button>
                  </div>
                </EditorField>

                <div style={{ paddingTop: 8, borderTop: '1px solid #fee2e2', marginTop: 'auto' }}>
                  <button
                    onClick={deleteSelected}
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

const textInput: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #d4d4d8', borderRadius: 6,
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
  padding: '7px 12px', background: 'transparent', border: '1px dashed #d4d4d8',
  borderRadius: 6, fontSize: 13, fontWeight: 600,
  color: '#52525b', cursor: 'pointer', width: '100%', textAlign: 'left',
}

const arrowBtn: React.CSSProperties = {
  width: 18, height: 18, padding: 0, fontSize: 9,
  border: '1px solid #e4e4e7', borderRadius: 4,
  background: '#fafafa', cursor: 'pointer', color: '#71717a',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
}
