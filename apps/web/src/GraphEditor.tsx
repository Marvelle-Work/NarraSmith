import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Edge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CircleNode } from './CircleNode'
import { RelationshipEdge } from './RelationshipEdge'
import { RelationshipModal } from './RelationshipModal'
import {
  ENTITY_TYPE_PRESETS, entityColors, edgeStyleForLabel,
  type GraphNode, type NodeData, type EntityType,
} from './types'

const nodeTypes = { circle: CircleNode }
const edgeTypes = { relationship: RelationshipEdge }

const STORAGE_KEY = 'narrasmith-graph'

const DEFAULT_GRAPH: { nodes: GraphNode[]; edges: Edge[] } = {
  nodes: [
    { id: '1', type: 'circle', position: { x: 100, y: 100 }, data: { label: 'Ignia',  entityType: 'Character', description: '' } },
    { id: '2', type: 'circle', position: { x: 400, y: 100 }, data: { label: 'Abraxas', entityType: 'Character', description: '' } },
  ],
  edges: [{
    id: 'e1', source: '1', target: '2', label: 'Opposes',
    type: 'relationship', data: { labelT: 0.5 },
    ...edgeStyleForLabel('Opposes'),
  }],
}

function loadGraph(): { nodes: GraphNode[]; edges: Edge[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as { nodes: any[]; edges: Edge[] }
      const nodes: GraphNode[] = saved.nodes.map((n: any) => ({
        ...n,
        type: 'circle',
        data: {
          label: n.data.label ?? 'Untitled',
          entityType: (n.data.entityType ?? n.data.category ?? 'Character') as EntityType,
          description: n.data.description ?? '',
        },
      }))
      const edges: Edge[] = (saved.edges as any[]).map((e: any) => ({
        ...e,
        type: 'relationship',
        data: { labelT: e.data?.labelT ?? 0.5 },
      }))
      return { nodes, edges }
    }
  } catch {}
  return DEFAULT_GRAPH
}

export function GraphEditor() {
  const { screenToFlowPosition } = useReactFlow()
  const initial = useMemo(() => loadGraph(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [pendingConn, setPendingConn] = useState<Connection | null>(null)

  const selectedNode = useMemo(
    () => selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null,
    [nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) ?? null : null,
    [edges, selectedEdgeId],
  )
  const selectedRelationships = useMemo(() => {
    if (!selectedNodeId) return { outgoing: [], incoming: [] }
    const label = (id: string) => nodes.find(n => n.id === id)?.data.label ?? id
    return {
      outgoing: edges.filter(e => e.source === selectedNodeId)
        .map(e => ({ label: typeof e.label === 'string' ? e.label : '', peer: label(e.target) })),
      incoming: edges.filter(e => e.target === selectedNodeId)
        .map(e => ({ label: typeof e.label === 'string' ? e.label : '', peer: label(e.source) })),
    }
  }, [selectedNodeId, edges, nodes])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }))
  }, [nodes, edges])

  const createEntityAt = useCallback((position: { x: number; y: number }) => {
    const id = `node-${Date.now()}`
    setNodes(nds => [...nds, {
      id, type: 'circle', position,
      data: { label: 'Untitled', entityType: 'Character' as EntityType, description: '' },
    }])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }, [setNodes])

  const createEntityAtCenter = useCallback(() => {
    createEntityAt(screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
  }, [screenToFlowPosition, createEntityAt])

  // Double-click canvas to place entity
  const onCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('.react-flow__node')) return
    if (target.closest('.react-flow__edge')) return
    if (target.closest('.react-flow__controls')) return
    if (target.closest('.react-flow__minimap')) return
    createEntityAt(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }, [screenToFlowPosition, createEntityAt])

  // Enter key to add entity at canvas center
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !pendingConn) {
        createEntityAtCenter()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [createEntityAtCenter, pendingConn])

  // Intercept connection to ask for relationship type
  const onConnect = useCallback((conn: Connection) => setPendingConn(conn), [])

  const confirmRelationship = useCallback((label: string) => {
    if (!pendingConn) return
    setEdges(eds => addEdge({
      ...pendingConn,
      id: `edge-${Date.now()}`,
      label,
      type: 'relationship',
      data: { labelT: 0.5 },
      ...edgeStyleForLabel(label),
    }, eds))
    setPendingConn(null)
  }, [pendingConn, setEdges])

  const onNodeClick: NodeMouseHandler<GraphNode> = useCallback((_e, node) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
  }, [])
  const onEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
  }, [])
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  const updateNode = useCallback((updates: Partial<NodeData>) => {
    if (!selectedNodeId) return
    setNodes(nds => nds.map(n =>
      n.id === selectedNodeId ? { ...n, data: { ...n.data, ...updates } } : n,
    ))
  }, [selectedNodeId, setNodes])

  const updateEdgeLabel = useCallback((label: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      // Don't overwrite a user-set colour with the preset-label colour
      const keepStyle = e.data?.color ? {} : edgeStyleForLabel(label)
      return { ...e, label, ...keepStyle }
    }))
  }, [selectedEdgeId, setEdges])

  const updateEdgeColor = useCallback((color: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e =>
      e.id === selectedEdgeId
        ? { ...e, data: { ...e.data, color: color || undefined } }
        : e,
    ))
  }, [selectedEdgeId, setEdges])

  const pendingSource = pendingConn ? nodes.find(n => n.id === pendingConn.source)?.data.label ?? '' : ''
  const pendingTarget = pendingConn ? nodes.find(n => n.id === pendingConn.target)?.data.label ?? '' : ''

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', fontFamily: 'system-ui, sans-serif' }}>
      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }} onDoubleClick={onCanvasDoubleClick}>
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
          <button
            onClick={createEntityAtCenter}
            style={{
              padding: '8px 14px',
              background: '#18181b', color: '#fff',
              border: 'none', borderRadius: 6,
              cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            + New Entity
          </button>
          <span style={{ marginLeft: 10, fontSize: 12, color: '#71717a' }}>
            or double-click canvas · Enter
          </span>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          zoomOnDoubleClick={false}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Side panel */}
      {(selectedNode || selectedEdge) && (
        <aside style={{
          width: 280, padding: '24px 20px',
          borderLeft: '1px solid #e4e4e7', background: '#fafafa',
          display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto',
        }}>
          {selectedNode && (
            <>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#18181b' }}>Entity</h2>

              <Field label="Name">
                <input
                  value={selectedNode.data.label}
                  onChange={e => updateNode({ label: e.target.value })}
                  style={inputStyle}
                />
              </Field>

              <Field label="Type">
                <input
                  value={selectedNode.data.entityType}
                  onChange={e => updateNode({ entityType: e.target.value })}
                  placeholder="e.g. Deity, Artefact, Faction…"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {ENTITY_TYPE_PRESETS.map(preset => {
                    const c = entityColors(preset)
                    const active = selectedNode.data.entityType === preset
                    return (
                      <button
                        key={preset}
                        onClick={() => updateNode({ entityType: preset })}
                        style={{
                          padding: '3px 9px',
                          borderRadius: 999,
                          border: `1.5px solid ${c.border}`,
                          background: active ? c.bg : 'transparent',
                          color: c.text,
                          fontWeight: 600, fontSize: 11,
                          cursor: 'pointer',
                          opacity: active ? 1 : 0.55,
                          transition: 'opacity 0.12s, background 0.12s',
                        }}
                      >
                        {preset}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <Field label="Color">
                <ColorPicker
                  value={selectedNode.data.color}
                  onChange={color => updateNode({ color: color || undefined })}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={selectedNode.data.description ?? ''}
                  onChange={e => updateNode({ description: e.target.value })}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>

              <Field label="Relationships">
                {selectedRelationships.outgoing.length === 0 && selectedRelationships.incoming.length === 0 ? (
                  <span style={{ fontSize: 13, color: '#a1a1aa' }}>None</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedRelationships.outgoing.map((r, i) => (
                      <RelChip key={i} direction="out" peer={r.peer} label={r.label} />
                    ))}
                    {selectedRelationships.incoming.map((r, i) => (
                      <RelChip key={i} direction="in" peer={r.peer} label={r.label} />
                    ))}
                  </div>
                )}
              </Field>
            </>
          )}

          {selectedEdge && (
            <>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#18181b' }}>Relationship</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#52525b' }}>
                <span style={{ fontWeight: 600, color: '#18181b' }}>
                  {nodes.find(n => n.id === selectedEdge.source)?.data.label ?? selectedEdge.source}
                </span>
                <span style={{ color: '#a1a1aa' }}>→</span>
                <span style={{ fontWeight: 600, color: '#18181b' }}>
                  {nodes.find(n => n.id === selectedEdge.target)?.data.label ?? selectedEdge.target}
                </span>
              </div>
              <Field label="Label">
                <input
                  autoFocus
                  value={typeof selectedEdge.label === 'string' ? selectedEdge.label : ''}
                  onChange={e => updateEdgeLabel(e.target.value)}
                  placeholder="e.g. Opposes, Loves…"
                  style={inputStyle}
                />
              </Field>
              <Field label="Color">
                <ColorPicker
                  value={selectedEdge.data?.color as string | undefined}
                  onChange={updateEdgeColor}
                />
              </Field>
            </>
          )}
        </aside>
      )}

      {pendingConn && (
        <RelationshipModal
          sourceLabel={pendingSource}
          targetLabel={pendingTarget}
          onSelect={confirmRelationship}
          onCancel={() => setPendingConn(null)}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

const SWATCHES = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#18181b', '#71717a',
]

function ColorPicker({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {/* Clear / default swatch */}
      <button
        title="Default (entity type colour)"
        onClick={() => onChange('')}
        style={{
          width: 22, height: 22, borderRadius: '50%', padding: 0, cursor: 'pointer',
          background: '#fff',
          border: !value ? '2.5px solid #18181b' : '1.5px solid #d4d4d8',
          fontSize: 12, lineHeight: '18px', color: '#a1a1aa',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>

      {SWATCHES.map(s => (
        <button
          key={s}
          title={s}
          onClick={() => onChange(s)}
          style={{
            width: 22, height: 22, borderRadius: '50%', padding: 0,
            background: s, cursor: 'pointer',
            border: value === s ? '2.5px solid #18181b' : '2px solid transparent',
            outline: value === s ? '2px solid #fff' : 'none',
            outlineOffset: -3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      ))}

      {/* Custom colour input — styled as a rainbow swatch */}
      <label title="Custom colour" style={{ cursor: 'pointer', display: 'flex' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)',
          border: (value && !SWATCHES.includes(value)) ? '2.5px solid #18181b' : '1.5px solid #d4d4d8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
        <input
          type="color"
          value={value && value.startsWith('#') ? value : '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  )
}

function RelChip({ direction, peer, label }: { direction: 'in' | 'out'; peer: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 8px',
      background: '#fff', border: '1px solid #e4e4e7', borderRadius: 6,
      fontSize: 13, color: '#18181b',
    }}>
      <span style={{ fontWeight: 700, color: direction === 'out' ? '#6366f1' : '#f59e0b' }}>
        {direction === 'out' ? '→' : '←'}
      </span>
      <span style={{ fontWeight: 600 }}>{peer}</span>
      {label && <span style={{ color: '#71717a', marginLeft: 'auto', fontSize: 12 }}>{label}</span>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #d4d4d8', borderRadius: 6,
  fontSize: 14, color: '#18181b', background: '#fff',
  width: '100%', boxSizing: 'border-box', outline: 'none',
}
