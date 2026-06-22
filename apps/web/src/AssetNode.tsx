import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { AssetNodeData } from './types'

type AssetGraphNode = Node<AssetNodeData>

export function AssetNode({ data, selected }: NodeProps<AssetGraphNode>) {
  return (
    <div style={{
      width: 130,
      background: '#fff',
      border: `2px solid ${selected ? '#6366f1' : '#d4d4d8'}`,
      borderRadius: 8,
      boxShadow: selected
        ? '0 0 0 3px rgba(99,102,241,0.2), 0 4px 14px rgba(0,0,0,0.1)'
        : '0 2px 8px rgba(0,0,0,0.08)',
      padding: '10px 12px',
      cursor: 'grab',
      fontFamily: 'system-ui, sans-serif',
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#6366f1',
          background: '#ede9fe', padding: '2px 5px', borderRadius: 4,
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          ASSET
        </span>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#18181b',
        wordBreak: 'break-word', lineHeight: 1.3,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        marginBottom: 4,
      }}>
        {data.title}
      </div>
      <div style={{ fontSize: 10, color: '#a1a1aa' }}>
        {data.entryCount} {data.entryCount === 1 ? 'entry' : 'entries'}
      </div>

      {/* Hidden handles for tether edge rendering — not user-interactive */}
      <Handle type="source" id="north" position={Position.Top} isConnectableStart={false} style={hiddenHandle} />
      <Handle type="source" id="east" position={Position.Right} isConnectableStart={false} style={hiddenHandle} />
      <Handle type="source" id="south" position={Position.Bottom} isConnectableStart={false} style={hiddenHandle} />
      <Handle type="source" id="west" position={Position.Left} isConnectableStart={false} style={hiddenHandle} />
    </div>
  )
}

const hiddenHandle: React.CSSProperties = {
  width: 0,
  height: 0,
  background: 'transparent',
  border: 'none',
  pointerEvents: 'none',
}
