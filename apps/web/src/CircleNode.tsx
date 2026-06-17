import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GraphNode } from './types'
import { entityColors, SIZE_LEVELS } from './types'

function isLight(hex: string): boolean {
  if (hex.length < 7) return true
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160
}

export function CircleNode({ data, selected }: NodeProps<GraphNode>) {
  const ec = entityColors(data.entityType)
  const c = data.color

  const bg     = c ?? ec.bg
  const border = c ?? ec.border
  const text   = c ? (isLight(c) ? '#18181b' : '#fff') : ec.text
  const ring   = c ? `${c}44` : ec.ring

  const { diameter, fontSize } = SIZE_LEVELS[((data.sizeLevel ?? 3) - 1)]

  return (
    <div
      style={{
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        background: bg,
        border: `2.5px solid ${border}`,
        boxShadow: selected
          ? `0 0 0 4px ${ring}, 0 4px 14px rgba(0,0,0,0.15)`
          : '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        cursor: 'grab',
        transition: 'box-shadow 0.15s',
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 600,
          color: text,
          textAlign: 'center',
          wordBreak: 'break-word',
          lineHeight: 1.3,
          maxWidth: diameter - 16,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {data.label}
      </span>

      {(['Top', 'Right', 'Bottom', 'Left'] as const).map(pos => (
        <>
          <Handle key={`s-${pos}`} type="source" position={Position[pos]} style={handleStyle(border)} />
          <Handle key={`t-${pos}`} type="target" position={Position[pos]} style={handleStyle(border)} />
        </>
      ))}
    </div>
  )
}

const handleStyle = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  background: color,
  border: '2px solid #fff',
  borderRadius: '50%',
})
