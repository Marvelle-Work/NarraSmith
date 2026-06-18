import { useEffect, useState } from 'react'
import type { FieldBlock } from './types'
import { uid } from './schema'

type Props = {
  fieldName: string
  blocks: FieldBlock[]
  onChange: (blocks: FieldBlock[]) => void
}

export function FieldBlockEditor({ fieldName, blocks, onChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const addBlock = () => {
    const template = blocks.length > 0
      ? Object.keys(blocks[blocks.length - 1].values).map(k => [k, ''] as [string, string])
      : []
    const b: FieldBlock = { id: uid(), label: '', values: Object.fromEntries(template) }
    onChange([...blocks, b])
  }

  const duplicateBlock = (block: FieldBlock) => {
    const copy: FieldBlock = {
      id: uid(),
      label: block.label ? `${block.label} (copy)` : '',
      values: { ...block.values },
    }
    const idx = blocks.findIndex(b => b.id === block.id)
    const next = [...blocks]
    next.splice(idx + 1, 0, copy)
    onChange(next)
  }

  const removeBlock = (id: string) => onChange(blocks.filter(b => b.id !== id))

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id)
    if (idx < 0) return
    const next = [...blocks]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  const patchBlock = (id: string, patch: Partial<FieldBlock>) =>
    onChange(blocks.map(b => (b.id === id ? { ...b, ...patch } : b)))

  const addEntry = (blockId: string, block: FieldBlock) => {
    const count = Object.keys(block.values).length
    patchBlock(blockId, { values: { ...block.values, [`field${count + 1}`]: '' } })
  }

  const updateEntryKey = (blockId: string, block: FieldBlock, oldKey: string, newKey: string) => {
    const trimmed = newKey.trim()
    if (!trimmed || trimmed === oldKey) return
    const entries = Object.entries(block.values).map(
      ([k, v]) => [k === oldKey ? trimmed : k, v] as [string, string],
    )
    patchBlock(blockId, { values: Object.fromEntries(entries) })
  }

  const updateEntryValue = (blockId: string, block: FieldBlock, key: string, value: string) =>
    patchBlock(blockId, { values: { ...block.values, [key]: value } })

  const removeEntry = (blockId: string, block: FieldBlock, key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [key]: _removed, ...rest } = block.values
    patchBlock(blockId, { values: rest })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((block, i) => {
        const isCollapsed = collapsed.has(block.id)
        const entries = Object.entries(block.values)
        const displayLabel = block.label || `${fieldName} ${i + 1}`

        return (
          <div
            key={block.id}
            style={{ border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 8px',
              background: '#f4f4f5',
              borderBottom: isCollapsed ? 'none' : '1px solid #e4e4e7',
            }}>
              <button onClick={() => toggleCollapse(block.id)} style={miniBtn} title={isCollapsed ? 'Expand' : 'Collapse'}>
                {isCollapsed ? '▶' : '▼'}
              </button>
              <input
                value={block.label ?? ''}
                onChange={e => patchBlock(block.id, { label: e.target.value })}
                placeholder={displayLabel}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  fontSize: 12, fontWeight: 600, color: '#18181b',
                  outline: 'none', minWidth: 0,
                }}
              />
              <button onClick={() => moveBlock(block.id, -1)} disabled={i === 0} style={miniBtn} title="Move up">▲</button>
              <button onClick={() => moveBlock(block.id, 1)} disabled={i === blocks.length - 1} style={miniBtn} title="Move down">▼</button>
              <button onClick={() => duplicateBlock(block)} style={miniBtn} title="Duplicate">⧉</button>
              <button onClick={() => removeBlock(block.id)} style={{ ...miniBtn, color: '#ef4444' }} title="Remove">✕</button>
            </div>

            {/* Entries */}
            {!isCollapsed && (
              <div style={{ padding: '8px 8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entries.map(([key, value]) => (
                  <EntryRow
                    key={key}
                    keyName={key}
                    value={value}
                    onUpdateKey={newKey => updateEntryKey(block.id, block, key, newKey)}
                    onUpdateValue={val => updateEntryValue(block.id, block, key, val)}
                    onDelete={() => removeEntry(block.id, block, key)}
                  />
                ))}
                <button
                  onClick={() => addEntry(block.id, block)}
                  style={{
                    marginTop: 2, padding: '3px 8px',
                    background: 'transparent', border: '1px dashed #d4d4d8',
                    borderRadius: 5, fontSize: 11, color: '#71717a',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  + Add detail
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={addBlock}
        style={{
          padding: '5px 10px',
          background: 'transparent', border: '1px dashed #d4d4d8',
          borderRadius: 6, fontSize: 12, fontWeight: 600,
          color: '#52525b', cursor: 'pointer',
        }}
      >
        + Add {fieldName}
      </button>
    </div>
  )
}

// ── Entry row (owns local key-editing state to avoid cursor jumps) ──────────

function EntryRow({ keyName, value, onUpdateKey, onUpdateValue, onDelete }: {
  keyName: string
  value: string
  onUpdateKey: (k: string) => void
  onUpdateValue: (v: string) => void
  onDelete: () => void
}) {
  const [editingKey, setEditingKey] = useState(keyName)

  useEffect(() => { setEditingKey(keyName) }, [keyName])

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input
        value={editingKey}
        onChange={e => setEditingKey(e.target.value)}
        onBlur={() => {
          if (!editingKey.trim()) {
            setEditingKey(keyName)
          } else if (editingKey.trim() !== keyName) {
            onUpdateKey(editingKey.trim())
          }
        }}
        style={{ ...entryInput, flex: '0 0 85px', fontWeight: 600, color: '#52525b' }}
        placeholder="Key"
      />
      <span style={{ color: '#d4d4d8', fontSize: 12, flexShrink: 0 }}>:</span>
      <input
        value={value}
        onChange={e => onUpdateValue(e.target.value)}
        style={{ ...entryInput, flex: 1 }}
        placeholder="Value"
      />
      <button onClick={onDelete} style={{ ...miniBtn, color: '#a1a1aa', flexShrink: 0 }}>✕</button>
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

const entryInput: React.CSSProperties = {
  padding: '3px 6px',
  border: '1px solid #e4e4e7', borderRadius: 5,
  fontSize: 12, color: '#18181b', background: '#fafafa',
  outline: 'none', boxSizing: 'border-box',
}
