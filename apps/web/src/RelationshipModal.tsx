import { useEffect, useRef, useState } from 'react'
import { RELATIONSHIP_OPTIONS, type RelationshipType } from './types'

const PRESET_COLORS: Record<RelationshipType, string> = {
  'Opposes':    '#ef4444',
  'Allies':     '#22c55e',
  'Related to': '#94a3b8',
  'Created by': '#3b82f6',
  'Influences': '#8b5cf6',
}

type Props = {
  sourceLabel: string
  targetLabel: string
  onSelect: (label: string) => void
  onCancel: () => void
}

export function RelationshipModal({ sourceLabel, targetLabel, onSelect, onCancel }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const confirm = () => {
    const trimmed = value.trim()
    if (trimmed) onSelect(trimmed)
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
        width: 340,
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
          onChange={e => setValue(e.target.value)}
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {RELATIONSHIP_OPTIONS.map(preset => (
            <button
              key={preset}
              onClick={() => setValue(preset)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: `1.5px solid ${PRESET_COLORS[preset]}`,
                background: value === preset ? `${PRESET_COLORS[preset]}18` : 'transparent',
                color: PRESET_COLORS[preset],
                fontWeight: 600, fontSize: 12,
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
            >
              {preset}
            </button>
          ))}
        </div>

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
