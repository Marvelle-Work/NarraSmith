import { Fragment, useState, useEffect } from 'react'
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

  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => { setImgFailed(false) }, [data.profileImageUrl])
  const hasImage = Boolean(data.profileImageUrl) && !imgFailed

  const labelCol = data.labelColor ?? (hasImage ? '#18181b' : text)

  const circle = (
    <div
      style={{
        position: 'relative',
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
      {/* Image clip container — separate div so overflow:hidden doesn't clip handles */}
      {data.profileImageUrl && !imgFailed && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          zIndex: 0,
        }}>
          <img
            src={data.profileImageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Label — shown only when no image is active */}
      {!hasImage && (
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize,
            fontWeight: 600,
            color: labelCol,
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
      )}

      {([
        ['Top', 'north'],
        ['Right', 'east'],
        ['Bottom', 'south'],
        ['Left', 'west'],
      ] as const).map(([pos, hid]) => (
        <Fragment key={hid}>
          <Handle type="source" id={hid} position={Position[pos]} style={handleStyle(border)} />
          <Handle type="target" id={hid} position={Position[pos]} style={handleStyle(border)} />
        </Fragment>
      ))}
    </div>
  )

  // Label rendered below the circle when an image occupies the interior
  const imageLabel = (
    <div
      style={{
        position: 'absolute',
        top: diameter + 5,
        left: '50%',
        transform: 'translateX(-50%)',
        width: diameter + 24,
        textAlign: 'center',
        fontSize: Math.max(fontSize - 1, 9),
        fontWeight: 600,
        color: labelCol,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none',
        lineHeight: 1.3,
      }}
    >
      {data.label}
    </div>
  )

  if (!data.isRoot) {
    if (!hasImage) return circle
    return (
      <div style={{ position: 'relative', width: diameter, height: diameter }}>
        {circle}
        {imageLabel}
      </div>
    )
  }

  // Root node: outer glow ring instead of diamond
  const glowColor = data.rootGlowColor ?? border
  const glowShadow = `0 0 0 3px ${glowColor}, 0 0 20px 8px ${glowColor}66`

  return (
    <div style={{
      position: 'relative',
      width: diameter,
      height: diameter,
      borderRadius: '50%',
      boxShadow: glowShadow,
    }}>
      {circle}
      {hasImage && imageLabel}
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
