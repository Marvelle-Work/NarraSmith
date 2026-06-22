import { useMemo, useState } from 'react'
import type { Edge } from '@xyflow/react'
import type { GraphNode, AssetData, CanvasImage } from './types'
import type { ConceptSchemaType } from './conceptSchema'
import { SIZE_LEVELS } from './types'

type Props = {
  nodes: GraphNode[]
  edges: Edge[]
  conceptSchemas: ConceptSchemaType[]
  assets: AssetData[]
  canvasImages: CanvasImage[]
  onSelectNode: (id: string) => void
  onSelectEdge: (id: string) => void
  onToggleAssetPin: (id: string) => void
  onFocusCanvasImage: (id: string) => void
  onClose: () => void
}

export function WorldIndexPanel({ nodes, edges, conceptSchemas, assets, canvasImages, onSelectNode, onSelectEdge, onToggleAssetPin, onFocusCanvasImage, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const q = search.trim().toLowerCase()

  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  const isOpen = (key: string) => !(collapsed[key] ?? false)

  // ── Entities ──────────────────────────────────────────────────────────
  const entityGroups = useMemo(() => {
    const filtered = nodes.filter(n =>
      !q
      || n.data.label.toLowerCase().includes(q)
      || n.data.entityType.toLowerCase().includes(q)
      || (n.data.description ?? '').toLowerCase().includes(q),
    )
    const map: Record<string, GraphNode[]> = {}
    for (const n of filtered) {
      const t = n.data.entityType || 'Unknown'
      ;(map[t] ??= []).push(n)
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, ns]) => ({ type, nodes: ns.sort((a, b) => a.data.label.localeCompare(b.data.label)) }))
  }, [nodes, q])

  const totalEntities = entityGroups.reduce((sum, g) => sum + g.nodes.length, 0)

  // ── Connections ───────────────────────────────────────────────────────
  const filteredEdges = useMemo(() => {
    const nameOf = (id: string) => nodes.find(n => n.id === id)?.data.label ?? id
    return edges
      .map(e => ({
        edge: e,
        src: nameOf(e.source),
        tgt: nameOf(e.target),
        label: typeof e.label === 'string' ? e.label : '',
      }))
      .filter(({ src, tgt, label }) =>
        !q
        || src.toLowerCase().includes(q)
        || tgt.toLowerCase().includes(q)
        || label.toLowerCase().includes(q),
      )
      .sort((a, b) => a.src.localeCompare(b.src))
  }, [edges, nodes, q])

  // ── Concepts ──────────────────────────────────────────────────────────
  const hasAnyConcepts = useMemo(() =>
    nodes.some(n => Object.values(n.data.concepts ?? {}).some(arr => arr.length > 0)),
    [nodes],
  )

  const conceptGroups = useMemo(() => {
    return conceptSchemas
      .map(cs => {
        const items = nodes.flatMap(node => {
          const instances = node.data.concepts?.[cs.id] ?? []
          return instances
            .filter(inst => {
              if (!q) return true
              const label = inst.label || cs.name
              return (
                label.toLowerCase().includes(q)
                || node.data.label.toLowerCase().includes(q)
                || cs.name.toLowerCase().includes(q)
              )
            })
            .map(inst => ({ node, inst }))
        })
        return { schema: cs, items }
      })
      .filter(g => g.items.length > 0)
  }, [nodes, conceptSchemas, q])

  const totalConcepts = conceptGroups.reduce((sum, g) => sum + g.items.length, 0)

  // ── Assets ────────────────────────────────────────────────────────────
  const assetGroups = useMemo(() => {
    const nameOf = (id: string) => nodes.find(n => n.id === id)?.data.label ?? id
    const filtered = assets.filter(a =>
      !q
      || a.title.toLowerCase().includes(q)
      || a.entries.some(e => e.label.toLowerCase().includes(q))
      || a.linkedEntityIds.some(eid => nameOf(eid).toLowerCase().includes(q)),
    )
    const pinned = filtered.filter(a => a.isPinnedOnCanvas)
    const linked = filtered.filter(a => !a.isPinnedOnCanvas && a.linkedEntityIds.length > 0)
    const unlinked = filtered.filter(a => !a.isPinnedOnCanvas && a.linkedEntityIds.length === 0)
    return { pinned, linked, unlinked }
  }, [assets, nodes, q])

  const totalAssets = assetGroups.pinned.length + assetGroups.linked.length + assetGroups.unlinked.length

  // ── Canvas Images ─────────────────────────────────────────────────────
  const filteredCanvasImages = useMemo(() => {
    return canvasImages.filter(ci =>
      !q || ci.title.toLowerCase().includes(q),
    )
  }, [canvasImages, q])

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 2000,
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 14,
        width: 'min(680px, 95vw)', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid #e4e4e7', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#18181b', flexShrink: 0 }}>
            World Index
          </h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search entities, connections, concepts…"
            autoFocus
            style={{
              flex: 1, padding: '6px 11px',
              border: '1px solid #d4d4d8', borderRadius: 7,
              fontSize: 13, color: '#18181b', outline: 'none',
              background: '#fafafa',
            }}
          />
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* ── Entities ── */}
          <IndexSection
            label="Entities" count={totalEntities}
            open={isOpen('entities')} onToggle={() => toggle('entities')}
          >
            {entityGroups.length === 0
              ? <EmptyRow text={q ? 'No entities match' : 'No entities yet'} />
              : entityGroups.map(({ type, nodes: typeNodes }) => (
                <div key={type}>
                  <TypeHeading text={`${type} (${typeNodes.length})`} />
                  {typeNodes.map(n => {
                    const sizeLevel = n.data.sizeLevel ?? 3
                    const sizeInfo = SIZE_LEVELS.find(s => s.level === sizeLevel)
                    return (
                      <IndexRow
                        key={n.id}
                        onClick={() => { onSelectNode(n.id); onClose() }}
                      >
                        <span style={{ fontWeight: 600, color: '#18181b', flex: 1 }}>{n.data.label}</span>
                        {n.data.description && (
                          <span style={descStyle}>{n.data.description}</span>
                        )}
                        {sizeInfo && sizeLevel !== 3 && (
                          <Pill text={sizeInfo.label} color="#52525b" bg="#f4f4f5" />
                        )}
                      </IndexRow>
                    )
                  })}
                </div>
              ))
            }
          </IndexSection>

          {/* ── Connections ── */}
          <IndexSection
            label="Connections" count={filteredEdges.length}
            open={isOpen('connections')} onToggle={() => toggle('connections')}
          >
            {filteredEdges.length === 0
              ? <EmptyRow text={q ? 'No connections match' : 'No connections yet'} />
              : filteredEdges.map(({ edge, src, tgt, label }) => {
                const edgeColor = (edge.data?.color ?? edge.data?.schemaColor) as string | undefined
                return (
                  <IndexRow key={edge.id} onClick={() => { onSelectEdge(edge.id); onClose() }}>
                    <span style={{ fontWeight: 600, color: '#18181b' }}>{src}</span>
                    <span style={{ color: '#d4d4d8', fontSize: 12 }}>→</span>
                    {label && (
                      <Pill text={label} color={edgeColor ?? '#71717a'} bg={edgeColor ? `${edgeColor}18` : '#f4f4f5'} />
                    )}
                    <span style={{ color: '#d4d4d8', fontSize: 12 }}>→</span>
                    <span style={{ fontWeight: 600, color: '#18181b' }}>{tgt}</span>
                  </IndexRow>
                )
              })
            }
          </IndexSection>

          {/* ── Concepts ── */}
          {hasAnyConcepts && (
            <IndexSection
              label="Concepts" count={totalConcepts}
              open={isOpen('concepts')} onToggle={() => toggle('concepts')}
            >
              {conceptGroups.length === 0
                ? <EmptyRow text="No concepts match" />
                : conceptGroups.map(({ schema, items }) => (
                  <div key={schema.id}>
                    <TypeHeading text={`${schema.name.endsWith('s') ? schema.name : `${schema.name}s`} (${items.length})`} />
                    {items.map(({ node, inst }) => (
                      <IndexRow key={inst.id} onClick={() => { onSelectNode(node.id); onClose() }}>
                        <span style={{ fontWeight: 600, color: '#18181b', flex: 1 }}>
                          {inst.label || `${schema.name} ${items.findIndex(i => i.inst.id === inst.id) + 1}`}
                        </span>
                        <Pill text={node.data.label} color="#7e22ce" bg="#faf0fe" />
                      </IndexRow>
                    ))}
                  </div>
                ))
              }
            </IndexSection>
          )}

          {/* ── Assets ── */}
          <IndexSection
            label="Assets" count={totalAssets}
            open={isOpen('assets')} onToggle={() => toggle('assets')}
          >
            {totalAssets === 0
              ? <EmptyRow text={q ? 'No assets match' : 'No assets yet'} />
              : <>
                {assetGroups.pinned.length > 0 && (
                  <div>
                    <TypeHeading text={`Pinned (${assetGroups.pinned.length})`} />
                    {assetGroups.pinned.map(a => (
                      <AssetRow key={a.id} asset={a} nodes={nodes} onTogglePin={onToggleAssetPin} />
                    ))}
                  </div>
                )}
                {assetGroups.linked.length > 0 && (
                  <div>
                    <TypeHeading text={`Linked (${assetGroups.linked.length})`} />
                    {assetGroups.linked.map(a => (
                      <AssetRow key={a.id} asset={a} nodes={nodes} onTogglePin={onToggleAssetPin} />
                    ))}
                  </div>
                )}
                {assetGroups.unlinked.length > 0 && (
                  <div>
                    <TypeHeading text={`Unlinked (${assetGroups.unlinked.length})`} />
                    {assetGroups.unlinked.map(a => (
                      <AssetRow key={a.id} asset={a} nodes={nodes} onTogglePin={onToggleAssetPin} />
                    ))}
                  </div>
                )}
              </>
            }
          </IndexSection>

          {/* ── Canvas Images ── */}
          {canvasImages.length > 0 && (
            <IndexSection
              label="Canvas Images" count={filteredCanvasImages.length}
              open={isOpen('canvas-images')} onToggle={() => toggle('canvas-images')}
            >
              {filteredCanvasImages.length === 0
                ? <EmptyRow text="No canvas images match" />
                : filteredCanvasImages.map(ci => (
                  <IndexRow key={ci.id} onClick={() => { onFocusCanvasImage(ci.id); onClose() }}>
                    <span style={{ fontWeight: 600, color: '#18181b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ci.title}
                    </span>
                    <span style={{ fontSize: 11, color: '#a1a1aa' }}>{ci.width}x{ci.height}</span>
                    {ci.locked && <Pill text="Locked" color="#71717a" bg="#f4f4f5" />}
                  </IndexRow>
                ))
              }
            </IndexSection>
          )}

          {/* Global empty state */}
          {nodes.length === 0 && edges.length === 0 && assets.length === 0 && canvasImages.length === 0 && (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#a1a1aa', fontSize: 14 }}>
              Your world is empty — add entities to get started
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function IndexSection({ label, count, open, onToggle, children }: {
  label: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ border: '1px solid #e4e4e7', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 14px', background: '#fafafa', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? '1px solid #e4e4e7' : 'none',
        }}
      >
        <span style={{ fontSize: 9, color: '#a1a1aa', flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.7 }}>
          {label}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700,
          background: '#e4e4e7', color: '#52525b',
          padding: '1px 8px', borderRadius: 999,
        }}>
          {count}
        </span>
      </button>
      {open && (
        <div style={{ padding: '6px 10px 10px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function IndexRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '5px 8px', borderRadius: 6, border: 'none',
        background: hover ? '#f4f4f5' : 'transparent',
        cursor: 'pointer', textAlign: 'left', fontSize: 13,
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  )
}

function TypeHeading({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#a1a1aa',
      textTransform: 'uppercase', letterSpacing: 0.6,
      padding: '8px 8px 3px',
    }}>
      {text}
    </div>
  )
}

function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color,
      background: bg, padding: '1px 7px', borderRadius: 4,
      flexShrink: 0, maxWidth: 140,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ padding: '10px 8px', fontSize: 13, color: '#a1a1aa' }}>{text}</div>
  )
}

function AssetRow({ asset, nodes, onTogglePin }: { asset: AssetData; nodes: GraphNode[]; onTogglePin: (id: string) => void }) {
  const entrySummary = asset.entries.slice(0, 3).map(e => e.label || e.type).join(', ')
  const linkedNames = asset.linkedEntityIds
    .map(eid => nodes.find(n => n.id === eid)?.data.label)
    .filter(Boolean)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '5px 8px', borderRadius: 6, fontSize: 13,
    }}>
      <span style={{ fontWeight: 600, color: '#18181b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {asset.title}
      </span>
      {entrySummary && <span style={{ fontSize: 11, color: '#a1a1aa', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entrySummary}</span>}
      {linkedNames.length > 0 && linkedNames.map((name, i) => (
        <Pill key={i} text={name!} color="#6366f1" bg="#ede9fe" />
      ))}
      <button
        onClick={() => onTogglePin(asset.id)}
        style={{
          fontSize: 10, fontWeight: 600, cursor: 'pointer',
          background: 'none', border: 'none', padding: '2px 4px',
          color: asset.isPinnedOnCanvas ? '#dc2626' : '#6366f1',
          flexShrink: 0,
        }}
      >
        {asset.isPinnedOnCanvas ? 'Unpin' : 'Pin'}
      </button>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const closeBtn: React.CSSProperties = {
  width: 28, height: 28, flexShrink: 0,
  border: '1px solid #e4e4e7', borderRadius: 6,
  background: '#fafafa', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, color: '#71717a', padding: 0,
}

const descStyle: React.CSSProperties = {
  fontSize: 12, color: '#a1a1aa',
  maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
