import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { AssetNodeData } from './types'

type AssetGraphNode = Node<AssetNodeData>

export function AssetNode({ data, selected }: NodeProps<AssetGraphNode>) {
  const isNotebook = data.kind === 'notebook'

  const accentColor = isNotebook ? '#8b5cf6' : '#6366f1'
  const badgeLabel  = isNotebook ? 'NOTEBOOK' : 'ASSET'
  const badgeBg     = isNotebook ? '#ede9fe' : '#ede9fe'
  const icon        = isNotebook ? '📓' : null

  return (
    <div style={{
      width: 130,
      background: '#fff',
      border: `2px solid ${selected ? accentColor : '#d4d4d8'}`,
      borderRadius: 8,
      boxShadow: selected
        ? `0 0 0 3px ${accentColor}33, 0 4px 14px rgba(0,0,0,0.1)`
        : '0 2px 8px rgba(0,0,0,0.08)',
      padding: '10px 12px',
      cursor: 'grab',
      fontFamily: 'system-ui, sans-serif',
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {icon && <span style={{ fontSize: 12, lineHeight: 1 }}>{icon}</span>}
        <span style={{
          fontSize: 9, fontWeight: 700, color: accentColor,
          background: badgeBg, padding: '2px 5px', borderRadius: 4,
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {badgeLabel}
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
        {isNotebook
          ? `${data.entryCount} doc${data.entryCount !== 1 ? 's' : ''}`
          : `${data.entryCount} ${data.entryCount === 1 ? 'entry' : 'entries'}`}
      </div>
      {isNotebook && (
        <div style={{
          marginTop: 5, fontSize: 9, color: accentColor,
          fontWeight: 600, letterSpacing: 0.3, opacity: 0.7,
        }}>
          double-click to open
        </div>
      )}

      {/* Hidden handles for tether edge rendering — not user-interactive */}
      <Handle type="source" id="north" position={Position.Top}    isConnectableStart={false} style={hiddenHandle} />
      <Handle type="source" id="east"  position={Position.Right}  isConnectableStart={false} style={hiddenHandle} />
      <Handle type="source" id="south" position={Position.Bottom} isConnectableStart={false} style={hiddenHandle} />
      <Handle type="source" id="west"  position={Position.Left}   isConnectableStart={false} style={hiddenHandle} />
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
