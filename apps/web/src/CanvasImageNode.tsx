import type { NodeProps, Node } from '@xyflow/react'
import type { CanvasImageNodeData } from './types'

type CanvasImageGraphNode = Node<CanvasImageNodeData>

export function CanvasImageNode({ data, selected }: NodeProps<CanvasImageGraphNode>) {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        transform: data.rotation ? `rotate(${data.rotation}deg)` : undefined,
        opacity: data.opacity,
        borderRadius: 4,
        overflow: 'hidden',
        border: selected ? '2px solid #6366f1' : '2px solid transparent',
        boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
        cursor: data.locked ? 'default' : 'grab',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        pointerEvents: 'all',
      }}
    >
      <img
        src={data.imageUrl}
        alt={data.title}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        onError={e => {
          (e.target as HTMLImageElement).style.display = 'none'
          ;(e.target as HTMLImageElement).parentElement!.style.background = '#f4f4f5'
          ;(e.target as HTMLImageElement).parentElement!.style.display = 'flex'
          ;(e.target as HTMLImageElement).parentElement!.style.alignItems = 'center'
          ;(e.target as HTMLImageElement).parentElement!.style.justifyContent = 'center'
        }}
      />
      {selected && (
        <div style={{
          position: 'absolute', bottom: 4, left: 4,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          padding: '2px 6px', borderRadius: 4,
          fontSize: 10, fontWeight: 600, maxWidth: '90%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data.title}
        </div>
      )}
    </div>
  )
}
