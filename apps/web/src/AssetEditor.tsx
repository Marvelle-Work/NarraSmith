import { useState } from 'react'
import type { AssetData, AssetEntry, AssetEntryType } from './types'
import { isUrl } from './types'
import { PlayButton } from './PlayButton'

type Props = {
  assets: AssetData[]
  entityId: string
  onAdd: (asset: AssetData) => void
  onUpdate: (asset: AssetData) => void
  onLink: (assetId: string, entityId: string) => void
  onUnlink: (assetId: string, entityId: string) => void
  onTogglePin: (assetId: string) => void
}

const ENTRY_TYPES: { value: AssetEntryType; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Image' },
  { value: 'music', label: 'Music' },
  { value: 'document', label: 'Doc' },
  { value: 'custom', label: 'Custom' },
]

const TEMPLATES: { label: string; entries: Omit<AssetEntry, 'id'>[] }[] = [
  { label: 'Music Pack', entries: [
    { type: 'music', label: 'Theme', value: '', isLinkified: false },
    { type: 'music', label: 'Battle', value: '', isLinkified: false },
    { type: 'music', label: 'Ambient', value: '', isLinkified: false },
  ]},
  { label: 'Image Pack', entries: [
    { type: 'image', label: 'Portrait', value: '', isLinkified: false },
    { type: 'image', label: 'Scene', value: '', isLinkified: false },
    { type: 'image', label: 'Map', value: '', isLinkified: false },
  ]},
  { label: 'Document Pack', entries: [
    { type: 'document', label: 'Lore', value: '', isLinkified: false },
    { type: 'document', label: 'Notes', value: '', isLinkified: false },
  ]},
  { label: 'Mixed', entries: [
    { type: 'image', label: 'Image', value: '', isLinkified: false },
    { type: 'link', label: 'Reference', value: '', isLinkified: false },
    { type: 'custom', label: 'Notes', value: '', isLinkified: false },
  ]},
  { label: 'Custom', entries: [] },
]

function entryId() {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function assetId() {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function AssetEditor({ assets, entityId, onAdd, onUpdate, onLink, onUnlink, onTogglePin }: Props) {
  const [view, setView] = useState<'list' | 'picker' | 'create'>('list')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const linked = assets.filter(a => a.linkedEntityIds.includes(entityId))
  const unlinked = assets.filter(a => !a.linkedEntityIds.includes(entityId))

  const handleCreateFromTemplate = (templateIdx: number) => {
    const tmpl = TEMPLATES[templateIdx]
    const asset: AssetData = {
      id: assetId(),
      title: tmpl.label === 'Custom' ? 'Untitled Asset' : tmpl.label,
      linkedEntityIds: [entityId],
      isPinnedOnCanvas: true,
      entries: tmpl.entries.map(e => ({ ...e, id: entryId() })),
    }
    onAdd(asset)
    setView('list')
    setExpandedId(asset.id)
  }

  const addEntry = (asset: AssetData, type: AssetEntryType) => {
    onUpdate({
      ...asset,
      entries: [...asset.entries, { id: entryId(), type, label: '', value: '', isLinkified: false }],
    })
  }

  const updateEntry = (asset: AssetData, eid: string, updates: Partial<AssetEntry>) => {
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

  const removeEntry = (asset: AssetData, eid: string) => {
    onUpdate({ ...asset, entries: asset.entries.filter(e => e.id !== eid) })
  }

  // ── Picker view ──────────────────────────────────────────────────────
  if (view === 'picker') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={sectionLabel}>Link Existing Asset</span>
        {unlinked.length === 0 ? (
          <span style={{ fontSize: 12, color: '#a1a1aa', padding: '6px 0' }}>No unlinked assets in project</span>
        ) : (
          unlinked.map(a => (
            <button
              key={a.id}
              onClick={() => { onLink(a.id, entityId); setView('list') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', borderRadius: 5, textAlign: 'left',
                border: '1px solid #e4e4e7', background: '#fff',
                color: '#18181b', fontSize: 12, cursor: 'pointer', width: '100%',
              }}
            >
              <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
              <span style={{ fontSize: 10, color: '#a1a1aa' }}>{a.entries.length} entries</span>
            </button>
          ))
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button onClick={() => setView('create')} style={actionBtn}>+ Create New</button>
          <button onClick={() => setView('list')} style={cancelSmBtn}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── Create view ──────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={sectionLabel}>Choose Template</span>
        {TEMPLATES.map((tmpl, i) => (
          <button
            key={tmpl.label}
            onClick={() => handleCreateFromTemplate(i)}
            style={{
              padding: '7px 10px', borderRadius: 5, textAlign: 'left',
              border: '1px solid #e4e4e7', background: '#fff',
              color: '#18181b', fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}
          >
            {tmpl.label}
            <span style={{ color: '#a1a1aa', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
              {tmpl.entries.length > 0 ? `${tmpl.entries.length} entries` : 'empty'}
            </span>
          </button>
        ))}
        <button onClick={() => setView('list')} style={{ ...cancelSmBtn, alignSelf: 'flex-end' }}>Cancel</button>
      </div>
    )
  }

  // ── List view (default) ──────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {linked.length === 0 && (
        <span style={{ fontSize: 13, color: '#a1a1aa' }}>No assets linked</span>
      )}

      {linked.map(asset => {
        const expanded = expandedId === asset.id
        return (
          <div key={asset.id} style={{
            background: '#fff', border: '1px solid #e4e4e7', borderRadius: 6,
            overflow: 'hidden',
          }}>
            <div
              onClick={() => setExpandedId(expanded ? null : asset.id)}
              style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 10, color: '#a1a1aa' }}>{expanded ? '▼' : '▶'}</span>
              <span style={badgeStyle}>{asset.entries.length}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {asset.title}
              </span>
              {asset.isPinnedOnCanvas && <span style={{ fontSize: 9, color: '#a1a1aa' }}>pinned</span>}
            </div>

            {expanded && (
              <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  value={asset.title}
                  onChange={e => onUpdate({ ...asset, title: e.target.value })}
                  style={formInput}
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

                <div style={{ display: 'flex', gap: 4, marginTop: 2, borderTop: '1px solid #f4f4f5', paddingTop: 6 }}>
                  <button onClick={() => onTogglePin(asset.id)} style={chipBtn}>
                    {asset.isPinnedOnCanvas ? 'Unpin' : 'Pin to Canvas'}
                  </button>
                  <button onClick={() => onUnlink(asset.id, entityId)} style={{ ...chipBtn, color: '#dc2626' }}>
                    Unlink
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button onClick={() => setView('picker')} style={addAssetBtn}>+ Add Asset</button>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#52525b',
  textTransform: 'uppercase', letterSpacing: 0.5,
}
const badgeStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: '#6366f1',
  background: '#ede9fe', padding: '1px 4px', borderRadius: 3,
  textTransform: 'uppercase',
}
const chipBtn: React.CSSProperties = {
  fontSize: 11, color: '#6366f1', cursor: 'pointer',
  background: 'none', border: 'none', padding: 0, fontWeight: 600,
}
const formInput: React.CSSProperties = {
  padding: '5px 7px', border: '1px solid #d4d4d8', borderRadius: 4,
  fontSize: 12, color: '#18181b', background: '#fff',
  width: '100%', boxSizing: 'border-box', outline: 'none',
}
const addAssetBtn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6,
  border: '1px dashed #d4d4d8', background: '#fafafa',
  color: '#71717a', fontWeight: 600, fontSize: 12,
  cursor: 'pointer', textAlign: 'center',
}
const addEntryBtn: React.CSSProperties = {
  padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
  border: '1px solid #e4e4e7', background: '#fff', color: '#52525b', cursor: 'pointer',
}
const delBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#dc2626',
  cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '0 2px',
}
const actionBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 5, border: 'none',
  background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 11, cursor: 'pointer',
}
const cancelSmBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 5, border: '1px solid #d4d4d8',
  background: '#fff', color: '#52525b', fontWeight: 600, fontSize: 11, cursor: 'pointer',
}
