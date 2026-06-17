import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { SchemaEditorPanel } from './SchemaEditorPanel'
import { RelationshipSchemaEditorPanel } from './RelationshipSchemaEditorPanel'
import { ColorPicker } from './ColorPicker'
import { entityColors, edgeStyleForLabel, SIZE_LEVELS, type GraphNode, type NodeData, type SizeLevel } from './types'
import {
  loadSchemaTypes, saveSchemaTypes, resolveFields,
  type SchemaType,
} from './schema'
import {
  loadRelationshipTypes, saveRelationshipTypes, resolveRelationshipType,
  type RelationshipType,
} from './relationshipSchema'

const nodeTypes = { circle: CircleNode }
const edgeTypes = { relationship: RelationshipEdge }

const GRAPH_KEY   = 'narrasmith-graph'
const UI_MODE_KEY = 'narrasmith-ui-mode'

type UIMode = 'story' | 'system'

const DEFAULT_GRAPH: { nodes: GraphNode[]; edges: Edge[] } = {
  nodes: [
    { id: '1', type: 'circle', position: { x: 100, y: 100 }, data: { label: 'Ignia',   entityType: 'Character', typeId: 'schema-character', fields: {}, description: '', sizeLevel: 3 } },
    { id: '2', type: 'circle', position: { x: 400, y: 100 }, data: { label: 'Abraxas', entityType: 'Character', typeId: 'schema-character', fields: {}, description: '', sizeLevel: 3 } },
  ],
  edges: [{
    id: 'e1', source: '1', target: '2', label: 'Opposes',
    type: 'relationship',
    data: { labelT: 0.5, relationshipTypeId: 'rel-opposes', schemaColor: '#ef4444' },
    style: { stroke: '#ef4444', strokeWidth: 2 },
  }],
}

function loadGraph(): { nodes: GraphNode[]; edges: Edge[] } {
  try {
    const raw = localStorage.getItem(GRAPH_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as { nodes: any[]; edges: any[] }
      const nodes: GraphNode[] = saved.nodes.map((n: any) => ({
        ...n,
        type: 'circle',
        data: {
          label:       n.data.label ?? 'Untitled',
          entityType:  n.data.entityType ?? n.data.category ?? 'Character',
          typeId:      n.data.typeId,
          fields:      n.data.fields ?? {},
          description: n.data.description ?? '',
          color:       n.data.color,
          sizeLevel:   (n.data.sizeLevel as SizeLevel | undefined) ?? 3,
        } satisfies NodeData,
      }))
      const edges: Edge[] = saved.edges.map((e: any) => ({
        ...e,
        type: 'relationship',
        data: {
          labelT:             e.data?.labelT ?? 0.5,
          color:              e.data?.color,
          schemaColor:        e.data?.schemaColor,
          relationshipTypeId: e.data?.relationshipTypeId,
          description:        e.data?.description,
        },
      }))
      return { nodes, edges }
    }
  } catch {}
  return DEFAULT_GRAPH
}

function resolveEdgeStyle(
  label: string,
  typeId: string | undefined,
  relTypes: RelationshipType[],
  manualColor: string | undefined,
): { style: React.CSSProperties; schemaColor: string | undefined } {
  if (manualColor) return { style: { stroke: manualColor, strokeWidth: 2 }, schemaColor: undefined }
  const resolved = typeId ? resolveRelationshipType(typeId, relTypes) : null
  const schemaColor = resolved?.defaultColor
  if (schemaColor) return { style: { stroke: schemaColor, strokeWidth: 2 }, schemaColor }
  return { style: edgeStyleForLabel(label).style, schemaColor: undefined }
}

export function GraphEditor() {
  const { screenToFlowPosition } = useReactFlow()
  const initial = useMemo(() => loadGraph(), [])

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [pendingConn, setPendingConn]       = useState<Connection | null>(null)
  const [showSchema, setShowSchema]         = useState(false)
  const [showRelSchema, setShowRelSchema]   = useState(false)

  // UI mode — story is default, system reveals schema controls
  const [mode, setMode] = useState<UIMode>(
    () => (localStorage.getItem(UI_MODE_KEY) as UIMode | null) ?? 'story',
  )
  useEffect(() => { localStorage.setItem(UI_MODE_KEY, mode) }, [mode])
  const story = mode === 'story'

  const toggleMode = useCallback(() => {
    setMode(m => {
      if (m === 'story') return 'system'
      // Switching back to story: close any open schema editors
      setShowSchema(false)
      setShowRelSchema(false)
      return 'story'
    })
  }, [])

  // Entity schema
  const [schemaTypes, setSchemaTypes] = useState<SchemaType[]>(() => loadSchemaTypes())
  const schemaRef = useRef(schemaTypes)
  useEffect(() => { schemaRef.current = schemaTypes }, [schemaTypes])
  useEffect(() => { saveSchemaTypes(schemaTypes) }, [schemaTypes])

  // Relationship schema
  const [relTypes, setRelTypes] = useState<RelationshipType[]>(() => loadRelationshipTypes())
  const relTypesRef = useRef(relTypes)
  useEffect(() => { relTypesRef.current = relTypes }, [relTypes])
  useEffect(() => { saveRelationshipTypes(relTypes) }, [relTypes])

  // Re-sync schemaColor when relationship schema changes
  useEffect(() => {
    setEdges(eds => eds.map(e => {
      const typeId = e.data?.relationshipTypeId as string | undefined
      if (!typeId || e.data?.color) return e
      const resolved = resolveRelationshipType(typeId, relTypes)
      const schemaColor = resolved?.defaultColor
      if (schemaColor === (e.data?.schemaColor as string | undefined)) return e
      const style = schemaColor ? { stroke: schemaColor, strokeWidth: 2 } : e.style
      return { ...e, style, data: { ...e.data, schemaColor } }
    }))
  }, [relTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Graph persistence
  useEffect(() => {
    localStorage.setItem(GRAPH_KEY, JSON.stringify({ nodes, edges }))
  }, [nodes, edges])

  // ── Derived selections ──────────────────────────────────────────────────
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
    const name = (id: string) => nodes.find(n => n.id === id)?.data.label ?? id
    return {
      outgoing: edges.filter(e => e.source === selectedNodeId)
        .map(e => ({ label: typeof e.label === 'string' ? e.label : '', peer: name(e.target) })),
      incoming: edges.filter(e => e.target === selectedNodeId)
        .map(e => ({ label: typeof e.label === 'string' ? e.label : '', peer: name(e.source) })),
    }
  }, [selectedNodeId, edges, nodes])

  const resolvedFields = useMemo(
    () => selectedNode?.data.typeId ? resolveFields(selectedNode.data.typeId, schemaTypes) : [],
    [selectedNode, schemaTypes],
  )

  // ── Entity creation ─────────────────────────────────────────────────────
  const createEntityAt = useCallback((position: { x: number; y: number }) => {
    const id = `node-${Date.now()}`
    const defaultSchema = schemaRef.current.find(t => t.name === 'Character')
    setNodes(nds => [...nds, {
      id, type: 'circle', position,
      data: { label: 'Untitled', entityType: 'Character', typeId: defaultSchema?.id, fields: {}, description: '', sizeLevel: 3 as SizeLevel },
    }])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }, [setNodes])

  const createEntityAtCenter = useCallback(() => {
    createEntityAt(screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
  }, [screenToFlowPosition, createEntityAt])

  const onCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('.react-flow__node')) return
    if (t.closest('.react-flow__edge')) return
    if (t.closest('.react-flow__controls')) return
    if (t.closest('.react-flow__minimap')) return
    createEntityAt(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }, [screenToFlowPosition, createEntityAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA'
          && !pendingConn && !showSchema && !showRelSchema)
        createEntityAtCenter()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [createEntityAtCenter, pendingConn, showSchema, showRelSchema])

  // ── Connections ─────────────────────────────────────────────────────────
  const onConnect = useCallback((conn: Connection) => setPendingConn(conn), [])

  const confirmRelationship = useCallback((label: string, relationshipTypeId?: string) => {
    if (!pendingConn) return
    const { style, schemaColor } = resolveEdgeStyle(label, relationshipTypeId, relTypesRef.current, undefined)
    setEdges(eds => addEdge({
      ...pendingConn,
      id: `edge-${Date.now()}`,
      label,
      type: 'relationship',
      style,
      data: { labelT: 0.5, relationshipTypeId, schemaColor },
    }, eds))
    setPendingConn(null)
  }, [pendingConn, setEdges])

  // ── Click handlers ──────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler<GraphNode> = useCallback((_e, node) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setShowSchema(false)
    setShowRelSchema(false)
  }, [])
  const onEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
    setShowSchema(false)
    setShowRelSchema(false)
  }, [])
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  // ── Data updaters ───────────────────────────────────────────────────────
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
      const manualColor = e.data?.color as string | undefined
      const typeId = e.data?.relationshipTypeId as string | undefined
      if (manualColor || typeId) return { ...e, label }
      return { ...e, label, ...edgeStyleForLabel(label) }
    }))
  }, [selectedEdgeId, setEdges])

  const updateEdgeDescription = useCallback((description: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e =>
      e.id !== selectedEdgeId ? e : { ...e, data: { ...e.data, description: description || undefined } }
    ))
  }, [selectedEdgeId, setEdges])

  const updateEdgeTypeId = useCallback((typeId: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      const resolved = resolveRelationshipType(typeId, relTypesRef.current)
      const schemaColor = resolved?.defaultColor
      const manualColor = e.data?.color as string | undefined
      const style = resolveEdgeStyle(typeof e.label === 'string' ? e.label : '', typeId, relTypesRef.current, manualColor)
      const label = (typeof e.label !== 'string' || e.label.trim() === '')
        ? (resolved?.name ?? e.label)
        : e.label
      return {
        ...e, label, style: style.style,
        data: { ...e.data, relationshipTypeId: typeId, schemaColor: manualColor ? undefined : schemaColor },
      }
    }))
  }, [selectedEdgeId, setEdges])

  const clearEdgeTypeId = useCallback(() => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      return {
        ...e,
        data: { ...e.data, relationshipTypeId: undefined, schemaColor: undefined },
        ...(!(e.data?.color) ? edgeStyleForLabel(typeof e.label === 'string' ? e.label : '') : {}),
      }
    }))
  }, [selectedEdgeId, setEdges])

  const updateEdgeColor = useCallback((color: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e =>
      e.id !== selectedEdgeId ? e : { ...e, data: { ...e.data, color: color || undefined } }
    ))
  }, [selectedEdgeId, setEdges])

  const pendingSource = pendingConn ? nodes.find(n => n.id === pendingConn.source)?.data.label ?? '' : ''
  const pendingTarget = pendingConn ? nodes.find(n => n.id === pendingConn.target)?.data.label ?? '' : ''

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', fontFamily: 'system-ui, sans-serif' }}>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }} onDoubleClick={onCanvasDoubleClick}>
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={createEntityAtCenter} style={toolbarBtn}>+ New Entity</button>

          {/* Schema buttons — system mode only */}
          {!story && (
            <>
              <button
                onClick={() => { setShowSchema(s => !s); setShowRelSchema(false) }}
                style={{
                  ...toolbarBtn,
                  background: showSchema ? '#6366f1' : '#fafafa',
                  color: showSchema ? '#fff' : '#18181b',
                  border: '1px solid #e4e4e7',
                }}
              >
                Entity Schema
              </button>
              <button
                onClick={() => { setShowRelSchema(s => !s); setShowSchema(false) }}
                style={{
                  ...toolbarBtn,
                  background: showRelSchema ? '#0ea5e9' : '#fafafa',
                  color: showRelSchema ? '#fff' : '#18181b',
                  border: '1px solid #e4e4e7',
                }}
              >
                Rel. Schema
              </button>
            </>
          )}

          <span style={{ fontSize: 12, color: '#71717a' }}>double-click · Enter</span>

          {/* Mode toggle — always visible, unobtrusive in story mode */}
          <button
            onClick={toggleMode}
            title={story ? 'Switch to System mode for schema controls' : 'Switch to Story mode'}
            style={{
              padding: '6px 10px',
              background: story ? 'transparent' : '#18181b',
              color: story ? '#c4c4c7' : '#fff',
              border: `1px solid ${story ? '#e4e4e7' : '#18181b'}`,
              borderRadius: 6, cursor: 'pointer',
              fontWeight: 600, fontSize: 11,
              transition: 'all 0.15s',
            }}
          >
            {story ? '⚙' : '⚙ System'}
          </button>
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

      {/* Inspector panel */}
      {(selectedNode || selectedEdge) && (
        <aside style={{
          width: 292, padding: '22px 18px',
          borderLeft: '1px solid #e4e4e7', background: '#fafafa',
          display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto',
          flexShrink: 0,
        }}>

          {/* ── Entity panel ── */}
          {selectedNode && (
            story
              ? <StoryEntityPanel
                  node={selectedNode}
                  schemaTypes={schemaTypes}
                  resolvedFields={resolvedFields}
                  relationships={selectedRelationships}
                  onUpdate={updateNode}
                />
              : <SystemEntityPanel
                  node={selectedNode}
                  schemaTypes={schemaTypes}
                  resolvedFields={resolvedFields}
                  relationships={selectedRelationships}
                  onUpdate={updateNode}
                />
          )}

          {/* ── Edge panel ── */}
          {selectedEdge && (
            story
              ? <StoryEdgePanel
                  edge={selectedEdge}
                  nodes={nodes}
                  onUpdateLabel={updateEdgeLabel}
                  onUpdateDescription={updateEdgeDescription}
                  onUpdateColor={updateEdgeColor}
                />
              : <SystemEdgePanel
                  edge={selectedEdge}
                  nodes={nodes}
                  relTypes={relTypes}
                  onUpdateLabel={updateEdgeLabel}
                  onUpdateDescription={updateEdgeDescription}
                  onUpdateColor={updateEdgeColor}
                  onUpdateTypeId={updateEdgeTypeId}
                  onClearTypeId={clearEdgeTypeId}
                />
          )}
        </aside>
      )}

      {/* Schema modals — system mode only */}
      {showSchema && (
        <SchemaEditorPanel
          schemaTypes={schemaTypes}
          onChange={setSchemaTypes}
          onClose={() => setShowSchema(false)}
        />
      )}
      {showRelSchema && (
        <RelationshipSchemaEditorPanel
          relationshipTypes={relTypes}
          onChange={setRelTypes}
          onClose={() => setShowRelSchema(false)}
        />
      )}

      {/* Relationship creation modal */}
      {pendingConn && (
        <RelationshipModal
          sourceLabel={pendingSource}
          targetLabel={pendingTarget}
          relationshipTypes={relTypes}
          onSelect={confirmRelationship}
          onCancel={() => setPendingConn(null)}
        />
      )}
    </div>
  )
}

// ── Story-mode entity panel ─────────────────────────────────────────────

type EntityPanelProps = {
  node: ReturnType<typeof import('./types').entityColors> extends infer _ ? import('./types').GraphNode : never
  schemaTypes: import('./schema').SchemaType[]
  resolvedFields: import('./schema').ResolvedField[]
  relationships: { outgoing: { label: string; peer: string }[]; incoming: { label: string; peer: string }[] }
  onUpdate: (u: Partial<import('./types').NodeData>) => void
}

function StoryEntityPanel({ node, schemaTypes, resolvedFields, relationships, onUpdate }: EntityPanelProps) {
  return (
    <>
      <PanelField label="Name">
        <input
          value={node.data.label}
          onChange={e => onUpdate({ label: e.target.value })}
          style={inputStyle}
        />
      </PanelField>

      <PanelField label="Role">
        <input
          value={node.data.entityType}
          onChange={e => {
            const match = schemaTypes.find(t => t.name.toLowerCase() === e.target.value.toLowerCase())
            onUpdate({ entityType: e.target.value, typeId: match?.id })
          }}
          placeholder="e.g. Deity, Faction, Artefact…"
          style={inputStyle}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          {schemaTypes.map(st => {
            const c = entityColors(st.name)
            const active = node.data.typeId === st.id
            return (
              <button
                key={st.id}
                onClick={() => onUpdate({ entityType: st.name, typeId: st.id })}
                style={{
                  padding: '3px 9px', borderRadius: 999,
                  border: `1.5px solid ${c.border}`,
                  background: active ? c.bg : 'transparent',
                  color: c.text,
                  fontWeight: 600, fontSize: 11, cursor: 'pointer',
                  opacity: active ? 1 : 0.5,
                  transition: 'opacity 0.1s, background 0.1s',
                }}
              >
                {st.name}
              </button>
            )
          })}
        </div>
      </PanelField>

      <PanelField label="Emphasis">
        <EmphasisPicker value={node.data.sizeLevel ?? 3} onChange={v => onUpdate({ sizeLevel: v })} />
      </PanelField>

      <PanelField label="Color">
        <ColorPicker
          value={node.data.color}
          onChange={color => onUpdate({ color: color || undefined })}
        />
      </PanelField>

      <PanelField label="Description">
        <textarea
          value={node.data.description ?? ''}
          onChange={e => onUpdate({ description: e.target.value })}
          rows={4}
          placeholder="Who or what is this? What role do they play?"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>

      {resolvedFields.length > 0 && (
        <PanelField label="Details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolvedFields.map(f => (
              <div key={f.id}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#52525b', display: 'block', marginBottom: 4 }}>
                  {f.name}
                </span>
                <input
                  value={(node.data.fields ?? {})[f.id] ?? ''}
                  onChange={e => onUpdate({ fields: { ...(node.data.fields ?? {}), [f.id]: e.target.value } })}
                  placeholder={f.description ?? f.defaultValue ?? ''}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </PanelField>
      )}

      <PanelField label="Connections">
        <ConnectionsList relationships={relationships} />
      </PanelField>
    </>
  )
}

// ── System-mode entity panel ────────────────────────────────────────────

function SystemEntityPanel({ node, schemaTypes, resolvedFields, relationships, onUpdate }: EntityPanelProps) {
  return (
    <>
      <h2 style={panelHeading}>Entity</h2>

      <PanelField label="Name">
        <input
          value={node.data.label}
          onChange={e => onUpdate({ label: e.target.value })}
          style={inputStyle}
        />
      </PanelField>

      <PanelField label="Type">
        <input
          value={node.data.entityType}
          onChange={e => {
            const match = schemaTypes.find(t => t.name.toLowerCase() === e.target.value.toLowerCase())
            onUpdate({ entityType: e.target.value, typeId: match?.id })
          }}
          placeholder="e.g. Deity, Faction, Artefact…"
          style={inputStyle}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          {schemaTypes.map(st => {
            const c = entityColors(st.name)
            const active = node.data.typeId === st.id
            return (
              <button
                key={st.id}
                onClick={() => onUpdate({ entityType: st.name, typeId: st.id })}
                style={{
                  padding: '3px 9px', borderRadius: 999,
                  border: `1.5px solid ${c.border}`,
                  background: active ? c.bg : 'transparent',
                  color: c.text,
                  fontWeight: 600, fontSize: 11, cursor: 'pointer',
                  opacity: active ? 1 : 0.5,
                  transition: 'opacity 0.1s, background 0.1s',
                }}
              >
                {st.name}
              </button>
            )
          })}
        </div>
      </PanelField>

      <PanelField label="Color">
        <ColorPicker
          value={node.data.color}
          onChange={color => onUpdate({ color: color || undefined })}
        />
      </PanelField>

      <PanelField label="Emphasis">
        <EmphasisPicker value={node.data.sizeLevel ?? 3} onChange={v => onUpdate({ sizeLevel: v })} />
      </PanelField>

      {resolvedFields.length > 0 && (
        <PanelField label="Fields">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolvedFields.map(f => (
              <div key={f.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: f.inherited ? '#a1a1aa' : '#52525b' }}>
                    {f.name}
                  </span>
                  {f.inherited && (
                    <span style={{ fontSize: 10, color: '#a1a1aa', background: '#f4f4f5', padding: '1px 5px', borderRadius: 4 }}>
                      ↑ {f.fromTypeName}
                    </span>
                  )}
                </div>
                <input
                  value={(node.data.fields ?? {})[f.id] ?? ''}
                  onChange={e => onUpdate({ fields: { ...(node.data.fields ?? {}), [f.id]: e.target.value } })}
                  placeholder={f.description ?? f.defaultValue ?? ''}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </PanelField>
      )}

      <PanelField label="Description">
        <textarea
          value={node.data.description ?? ''}
          onChange={e => onUpdate({ description: e.target.value })}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>

      <PanelField label="Relationships">
        <ConnectionsList relationships={relationships} />
      </PanelField>
    </>
  )
}

// ── Story-mode edge panel ───────────────────────────────────────────────

type StoryEdgePanelProps = {
  edge: Edge
  nodes: import('./types').GraphNode[]
  onUpdateLabel: (l: string) => void
  onUpdateDescription: (d: string) => void
  onUpdateColor: (c: string) => void
}

function StoryEdgePanel({ edge, nodes, onUpdateLabel, onUpdateDescription, onUpdateColor }: StoryEdgePanelProps) {
  const sourceName = nodes.find(n => n.id === edge.source)?.data.label ?? edge.source
  const targetName = nodes.find(n => n.id === edge.target)?.data.label ?? edge.target
  return (
    <>
      <h2 style={panelHeading}>Connection</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{sourceName}</span>
        <span style={{ color: '#a1a1aa' }}>→</span>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{targetName}</span>
      </div>

      <PanelField label="What connects them?">
        <input
          autoFocus
          value={typeof edge.label === 'string' ? edge.label : ''}
          onChange={e => onUpdateLabel(e.target.value)}
          placeholder="e.g. Opposes, Loves, Created…"
          style={inputStyle}
        />
      </PanelField>

      <PanelField label="Notes">
        <textarea
          value={(edge.data?.description as string | undefined) ?? ''}
          onChange={e => onUpdateDescription(e.target.value)}
          rows={3}
          placeholder="Any context about this connection…"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>

      <PanelField label="Color">
        <ColorPicker
          value={edge.data?.color as string | undefined}
          onChange={onUpdateColor}
        />
      </PanelField>
    </>
  )
}

// ── System-mode edge panel ──────────────────────────────────────────────

type SystemEdgePanelProps = {
  edge: Edge
  nodes: import('./types').GraphNode[]
  relTypes: RelationshipType[]
  onUpdateLabel: (l: string) => void
  onUpdateDescription: (d: string) => void
  onUpdateColor: (c: string) => void
  onUpdateTypeId: (id: string) => void
  onClearTypeId: () => void
}

function SystemEdgePanel({ edge, nodes, relTypes, onUpdateLabel, onUpdateDescription, onUpdateColor, onUpdateTypeId, onClearTypeId }: SystemEdgePanelProps) {
  const edgeTypeId = edge.data?.relationshipTypeId as string | undefined
  const resolvedType = edgeTypeId ? resolveRelationshipType(edgeTypeId, relTypes) : null
  const sourceName = nodes.find(n => n.id === edge.source)?.data.label ?? edge.source
  const targetName = nodes.find(n => n.id === edge.target)?.data.label ?? edge.target

  return (
    <>
      <h2 style={panelHeading}>Relationship</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{sourceName}</span>
        <span style={{ color: '#a1a1aa' }}>→</span>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{targetName}</span>
      </div>

      <PanelField label="Label">
        <input
          autoFocus
          value={typeof edge.label === 'string' ? edge.label : ''}
          onChange={e => onUpdateLabel(e.target.value)}
          placeholder="e.g. Opposes, Loves…"
          style={inputStyle}
        />
      </PanelField>

      <PanelField label="Type">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button
            onClick={onClearTypeId}
            style={{
              padding: '3px 9px', borderRadius: 999,
              border: '1.5px solid #d4d4d8',
              background: !edgeTypeId ? '#f4f4f5' : 'transparent',
              color: '#71717a',
              fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}
          >
            Custom
          </button>
          {relTypes.map(rt => {
            const active = edgeTypeId === rt.id
            const color = resolveRelationshipType(rt.id, relTypes)?.defaultColor ?? '#a1a1aa'
            return (
              <button
                key={rt.id}
                onClick={() => onUpdateTypeId(rt.id)}
                title={rt.description}
                style={{
                  padding: '3px 9px', borderRadius: 999,
                  border: `1.5px solid ${color}`,
                  background: active ? `${color}22` : 'transparent',
                  color,
                  fontWeight: 600, fontSize: 11, cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
              >
                {rt.name}
              </button>
            )
          })}
        </div>
        {resolvedType?.description && (
          <span style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>{resolvedType.description}</span>
        )}
      </PanelField>

      <PanelField label="Notes">
        <textarea
          value={(edge.data?.description as string | undefined) ?? ''}
          onChange={e => onUpdateDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>

      <PanelField label="Color">
        <ColorPicker
          value={edge.data?.color as string | undefined}
          onChange={onUpdateColor}
        />
        {!edge.data?.color && resolvedType?.defaultColor && (
          <span style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
            Using schema color — set a color above to override
          </span>
        )}
      </PanelField>
    </>
  )
}

// ── Shared sub-components ───────────────────────────────────────────────

function EmphasisPicker({ value, onChange }: { value: SizeLevel; onChange: (v: SizeLevel) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {SIZE_LEVELS.map(({ level, label }) => {
        const active = value === level
        return (
          <button
            key={level}
            onClick={() => onChange(level)}
            style={{
              padding: '3px 8px', borderRadius: 999,
              border: `1.5px solid ${active ? '#18181b' : '#d4d4d8'}`,
              background: active ? '#18181b' : 'transparent',
              color: active ? '#fff' : '#52525b',
              fontWeight: 600, fontSize: 11, cursor: 'pointer',
              transition: 'background 0.1s, color 0.1s, border-color 0.1s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function ConnectionsList({ relationships }: { relationships: { outgoing: { label: string; peer: string }[]; incoming: { label: string; peer: string }[] } }) {
  const { outgoing, incoming } = relationships
  if (outgoing.length === 0 && incoming.length === 0)
    return <span style={{ fontSize: 13, color: '#a1a1aa' }}>None yet</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {outgoing.map((r, i) => <RelChip key={i} direction="out" peer={r.peer} label={r.label} />)}
      {incoming.map((r, i) => <RelChip key={i} direction="in"  peer={r.peer} label={r.label} />)}
    </div>
  )
}

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </span>
      {children}
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

// ── Styles ──────────────────────────────────────────────────────────────

const panelHeading: React.CSSProperties = {
  margin: 0, fontSize: 15, fontWeight: 700, color: '#18181b',
}

const toolbarBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: '#18181b', color: '#fff',
  border: 'none', borderRadius: 6,
  cursor: 'pointer', fontWeight: 600, fontSize: 13,
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #d4d4d8', borderRadius: 6,
  fontSize: 14, color: '#18181b', background: '#fff',
  width: '100%', boxSizing: 'border-box', outline: 'none',
}
