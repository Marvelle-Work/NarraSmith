import { useEffect, useRef, useState } from 'react'
import type { RelationshipType } from './relationshipSchema'

type Props = {
  sourceLabel: string
  targetLabel: string
  relationshipTypes: RelationshipType[]
  onSelect: (label: string, relationshipTypeId?: string) => void
  onCancel: () => void
}

export function RelationshipModal({ sourceLabel, targetLabel, relationshipTypes, onSelect, onCancel }: Props) {
  const [value, setValue] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const confirm = () => {
    const trimmed = value.trim()
    if (trimmed) onSelect(trimmed, selectedTypeId ?? undefined)
  }

  const selectType = (t: RelationshipType) => {
    setValue(t.name)
    setSelectedTypeId(t.id)
  }

  const onType = (v: string) => {
    setValue(v)
    // If user manually edits away from the selected type's name, drop the typeId
    if (selectedTypeId) {
      const typeName = relationshipTypes.find(t => t.id === selectedTypeId)?.name ?? ''
      if (v !== typeName) setSelectedTypeId(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 14,
        padding: '28px 24px 20px',
        width: 360,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#18181b' }}>
          What is this relationship?
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#71717a' }}>
          <strong style={{ color: '#18181b' }}>{sourceLabel}</strong>
          {' → '}
          <strong style={{ color: '#18181b' }}>{targetLabel}</strong>
        </p>

        <input
          ref={inputRef}
          value={value}
          onChange={e => onType(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm() }}
          placeholder="Describe this relationship…"
          style={{
            width: '100%', padding: '9px 12px',
            border: '1.5px solid #d4d4d8', borderRadius: 8,
            fontSize: 14, color: '#18181b',
            boxSizing: 'border-box', outline: 'none',
            marginBottom: 14,
          }}
        />

        {/* Schema type chips */}
        {relationshipTypes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {relationshipTypes.map(rt => {
              const active = selectedTypeId === rt.id
              const color = rt.defaultColor ?? '#a1a1aa'
              return (
                <button
                  key={rt.id}
                  onClick={() => selectType(rt)}
                  title={rt.description}
                  style={{
                    padding: '4px 10px', borderRadius: 999,
                    border: `1.5px solid ${color}`,
                    background: active ? `${color}22` : 'transparent',
                    color,
                    fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  {rt.name}
                </button>
              )
            })}
          </div>
        )}

        <button
          onClick={confirm}
          disabled={!value.trim()}
          style={{
            width: '100%', padding: '10px',
            background: value.trim() ? '#18181b' : '#e4e4e7',
            color: value.trim() ? '#fff' : '#a1a1aa',
            border: 'none', borderRadius: 8,
            fontWeight: 600, fontSize: 14,
            cursor: value.trim() ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}
        >
          Add Relationship
        </button>

        <button
          onClick={onCancel}
          style={{
            marginTop: 10, width: '100%', padding: '7px',
            background: 'transparent', border: 'none',
            color: '#a1a1aa', fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel (Esc)
        </button>
      </div>
    </div>
  )
}
