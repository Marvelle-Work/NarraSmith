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

function darken(hex: string, amount = 0.35): string {
  if (hex.length < 7) return hex
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function CircleNode({ data, selected }: NodeProps<GraphNode>) {
  const ec = entityColors(data.entityType)
  const c = data.color

  const bg     = c ?? ec.bg
  const border = c ?? ec.border
  const text   = c ? (isLight(c) ? '#18181b' : '#fff') : ec.text
  const ring   = c ? `${c}44` : ec.ring

  const { diameter, fontSize } = SIZE_LEVELS[((data.sizeLevel ?? 3) - 1)]

  const diamondSize = diameter * 0.78

  const circle = (
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

  if (!data.isRoot) return circle

  const diamondColor = c ? darken(c) : border

  return (
    <div style={{
      position: 'relative',
      width: diameter,
      height: diameter,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {circle}
      <div style={{
        position: 'absolute',
        width: diamondSize,
        height: diamondSize,
        border: `2.5px solid ${diamondColor}`,
        borderRadius: 4,
        transform: 'rotate(45deg)',
        opacity: c ? 1 : 0.5,
        pointerEvents: 'none',
      }} />
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
