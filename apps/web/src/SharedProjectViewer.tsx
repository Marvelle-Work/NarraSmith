import { useState, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CircleNode } from './CircleNode'
import { RelationshipEdge } from './RelationshipEdge'
import { getSharedProject } from './api/projects'
import type { ProjectData } from './projectStore'
import type { GraphNode, SizeLevel, NodeData } from './types'

const nodeTypes = { circle: CircleNode }
const edgeTypes = { relationship: RelationshipEdge }

type Props = {
  shareId: string
  onBack?: () => void
}

export function SharedProjectViewer({ shareId, onBack }: Props) {
  const [data, setData] = useState<ProjectData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSharedProject(shareId)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [shareId])

  if (loading) {
    return (
      <div style={centerScreen}>Loading...</div>
    )
  }

  if (error || !data) {
    return (
      <div style={centerScreen}>
        <h2 style={{ margin: '0 0 8px', color: '#18181b' }}>Project not found</h2>
        <p style={{ color: '#71717a', margin: 0 }}>{error ?? 'This project may be private or the link may have expired.'}</p>
        {onBack && <button onClick={onBack} style={backButton}>Go Back</button>}
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <ReadOnlyGraph data={data} onBack={onBack} />
    </ReactFlowProvider>
  )
}

function ReadOnlyGraph({ data, onBack }: { data: ProjectData; onBack?: () => void }) {
  const { nodes, edges } = useMemo(() => {
    const raw = data.graph as { nodes: any[]; edges: any[]; rootNodeId?: string }
    if (!raw.nodes || raw.nodes.length === 0) return { nodes: [], edges: [] }
    const rootId = raw.rootNodeId
    // Only render entity (circle) nodes — asset and canvas-image nodes are not supported in read-only view
    const circleNodes = raw.nodes.filter((n: any) => n.type === 'circle' || (!n.type && n.data?.label))
    const ns: GraphNode[] = circleNodes.map((n: any, i: number) => ({
      ...n,
      type: 'circle',
      position: n.position ?? { x: 100 + (i % 5) * 200, y: 100 + Math.floor(i / 5) * 200 },
      data: {
        label: n.data.label ?? 'Untitled',
        entityType: n.data.entityType ?? 'Character',
        typeId: n.data.typeId,
        fields: n.data.fields ?? {},
        description: n.data.description ?? '',
        color: n.data.color,
        sizeLevel: (n.data.sizeLevel as SizeLevel | undefined) ?? 3,
        concepts: n.data.concepts,
        isRoot: n.id === rootId || undefined,
      } satisfies NodeData,
    }))
    // Only render relationship edges — tether edges are derived and not shown in read-only view
    const es: Edge[] = raw.edges
      .filter((e: any) => e.type !== 'tether')
      .map((e: any) => ({
        ...e,
        type: 'relationship',
        data: {
          labelT: e.data?.labelT ?? 0.5,
          color: e.data?.color,
          schemaColor: e.data?.schemaColor,
          relationshipTypeId: e.data?.relationshipTypeId,
          description: e.data?.description,
          whyItMatters: e.data?.whyItMatters,
        },
      }))
    return { nodes: ns, edges: es }
  }, [data])

  return (
    <div style={{ width: '100vw', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        {onBack && (
          <button onClick={onBack} style={navBtn}>&larr; Back</button>
        )}
        <span style={{ fontSize: 15, fontWeight: 700, color: '#18181b' }}>{data.name}</span>
        <span style={{ fontSize: 12, color: '#a1a1aa', background: '#f4f4f5', padding: '2px 8px', borderRadius: 4 }}>Read Only</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
      >
        <Background /><Controls /><MiniMap />
      </ReactFlow>
    </div>
  )
}

const centerScreen: React.CSSProperties = {
  width: '100vw', height: '100vh',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif', color: '#71717a',
}

const navBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: '#fff', color: '#52525b',
  border: '1px solid #e4e4e7', borderRadius: 6,
  cursor: 'pointer', fontWeight: 600, fontSize: 13,
}

const backButton: React.CSSProperties = {
  marginTop: 16, padding: '8px 20px',
  background: '#18181b', color: '#fff',
  border: 'none', borderRadius: 6,
  cursor: 'pointer', fontWeight: 600, fontSize: 13,
}
