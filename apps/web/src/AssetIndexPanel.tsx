import { useState, useMemo } from 'react'
import type { AttachmentAsset, AssetEntry, AssetEntryType, GraphNode } from './types'
import { isUrl } from './types'
import { PlayButton } from './PlayButton'

type Props = {
  assets: AttachmentAsset[]
  nodes: GraphNode[]
  onUpdate: (asset: AttachmentAsset) => void
  onRemove: (assetId: string) => void
  onTogglePin: (assetId: string) => void
  onClose: () => void
}

const ENTRY_TYPES: { value: AssetEntryType; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Image' },
  { value: 'music', label: 'Music' },
  { value: 'document', label: 'Doc' },
  { value: 'custom', label: 'Custom' },
]

function entryId() {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function AssetIndexPanel({ assets, nodes, onUpdate, onRemove, onTogglePin, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const q = search.trim().toLowerCase()

  const nameOf = (id: string) => nodes.find(n => n.id === id)?.data.label ?? id

  const filtered = useMemo(() => {
    return assets.filter(a =>
      !q
      || a.title.toLowerCase().includes(q)
      || a.entries.some(e => e.label.toLowerCase().includes(q) || e.value.toLowerCase().includes(q))
      || a.linkedEntityIds.some(eid => nameOf(eid).toLowerCase().includes(q)),
    )
  }, [assets, nodes, q])

  const pinned = filtered.filter(a => a.isPinnedOnCanvas)
  const linked = filtered.filter(a => !a.isPinnedOnCanvas && a.linkedEntityIds.length > 0)
  const unlinked = filtered.filter(a => !a.isPinnedOnCanvas && a.linkedEntityIds.length === 0)

  const addEntry = (asset: AttachmentAsset, type: AssetEntryType) => {
    onUpdate({
      ...asset,
      entries: [...asset.entries, { id: entryId(), type, label: '', value: '', isLinkified: false }],
    })
  }

  const updateEntry = (asset: AttachmentAsset, eid: string, updates: Partial<AssetEntry>) => {
    onUpdate({
      ...asset,
      entries: asset.entries.map(e => {
        if (e.id !== eid) return e
        const merged = { ...e, ...updates }
        if ('value' in updates) merged.isLinkified = isUrl(merged.value)
        return merged
      }),
    })
  }

  const removeEntry = (asset: AttachmentAsset, eid: string) => {
    onUpdate({ ...asset, entries: asset.entries.filter(e => e.id !== eid) })
  }

  function renderGroup(label: string, items: AttachmentAsset[]) {
    if (items.length === 0) return null
    return (
      <div>
        <div style={groupHeading}>{label} ({items.length})</div>
        {items.map(asset => {
          const expanded = expandedId === asset.id
          const linkedNames = asset.linkedEntityIds.map(nameOf)
          return (
            <div key={asset.id} style={{ border: '1px solid #e4e4e7', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedId(expanded ? null : asset.id)}
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ fontSize: 10, color: '#a1a1aa' }}>{expanded ? '▼' : '▶'}</span>
                <span style={badge}>{asset.entries.length}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.title}
                </span>
                {linkedNames.length > 0 && (
                  <span style={{ fontSize: 11, color: '#a1a1aa', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {linkedNames.join(', ')}
                  </span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onTogglePin(asset.id) }}
                  style={{ ...chipBtn, color: asset.isPinnedOnCanvas ? '#dc2626' : '#6366f1' }}
                >
                  {asset.isPinnedOnCanvas ? 'Unpin' : 'Pin'}
                </button>
              </div>

              {expanded && (
                <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #f4f4f5' }}>
                  <input
                    value={asset.title}
                    onChange={e => onUpdate({ ...asset, title: e.target.value })}
                    style={{ ...formInput, marginTop: 8 }}
                    placeholder="Asset title"
                  />

                  {asset.entries.map(entry => (
                    <div key={entry.id} style={{
                      padding: '6px 8px', background: '#f9fafb',
                      border: '1px solid #f4f4f5', borderRadius: 5,
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <select
                          value={entry.type}
                          onChange={e => updateEntry(asset, entry.id, { type: e.target.value as AssetEntryType })}
                          style={{ ...formInput, width: 'auto', padding: '2px 4px', fontSize: 10 }}
                        >
                          {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input
                          value={entry.label}
                          onChange={e => updateEntry(asset, entry.id, { label: e.target.value })}
                          placeholder="Label"
                          style={{ ...formInput, flex: 1, fontSize: 11 }}
                        />
                        <button onClick={() => removeEntry(asset, entry.id)} style={delBtn}>x</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          value={entry.value}
                          onChange={e => updateEntry(asset, entry.id, { value: e.target.value })}
                          placeholder="URL or text"
                          style={{ ...formInput, flex: 1, fontSize: 11 }}
                        />
                        {entry.type === 'music' && entry.isLinkified && (
                          <PlayButton url={entry.value} title={entry.label || asset.title} />
                        )}
                        {entry.isLinkified && (
                          <a href={entry.value} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, color: '#6366f1', whiteSpace: 'nowrap' }}>Open</a>
                        )}
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {ENTRY_TYPES.map(t => (
                      <button key={t.value} onClick={() => addEntry(asset, t.value)} style={addEntryBtn}>+ {t.label}</button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 2, borderTop: '1px solid #f4f4f5', paddingTop: 6 }}>
                    <button onClick={() => onTogglePin(asset.id)} style={chipBtn}>
                      {asset.isPinnedOnCanvas ? 'Unpin from Canvas' : 'Pin to Canvas'}
                    </button>
                    <button onClick={() => onRemove(asset.id)} style={{ ...chipBtn, color: '#dc2626' }}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)', zIndex: 2000,
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 14,
        width: 'min(560px, 95vw)', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid #e4e4e7', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#18181b', flexShrink: 0 }}>
            Assets
          </h2>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>{assets.length} total</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets..."
            autoFocus
            style={{
              flex: 1, padding: '6px 11px',
              border: '1px solid #d4d4d8', borderRadius: 7,
              fontSize: 13, color: '#18181b', outline: 'none', background: '#fafafa',
            }}
          />
          <button onClick={onClose} style={closeBtn}>x</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#a1a1aa', fontSize: 14 }}>
              {q ? 'No assets match your search' : 'No assets yet — create one from the + menu'}
            </div>
          ) : (
            <>
              {renderGroup('Pinned', pinned)}
              {renderGroup('Linked', linked)}
              {renderGroup('Unlinked', unlinked)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const groupHeading: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#a1a1aa',
  textTransform: 'uppercase', letterSpacing: 0.6,
  padding: '8px 4px 4px',
}
const badge: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: '#6366f1',
  background: '#ede9fe', padding: '1px 4px', borderRadius: 3,
}
const chipBtn: React.CSSProperties = {
  fontSize: 11, color: '#6366f1', cursor: 'pointer',
  background: 'none', border: 'none', padding: 0, fontWeight: 600,
  flexShrink: 0,
}
const formInput: React.CSSProperties = {
  padding: '5px 7px', border: '1px solid #d4d4d8', borderRadius: 4,
  fontSize: 12, color: '#18181b', background: '#fff',
  width: '100%', boxSizing: 'border-box', outline: 'none',
}
const addEntryBtn: React.CSSProperties = {
  padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
  border: '1px solid #e4e4e7', background: '#fff', color: '#52525b', cursor: 'pointer',
}
const delBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#dc2626',
  cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '0 2px',
}
const closeBtn: React.CSSProperties = {
  width: 28, height: 28, flexShrink: 0,
  border: '1px solid #e4e4e7', borderRadius: 6,
  background: '#fafafa', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, color: '#71717a', padding: 0,
}
