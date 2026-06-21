import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export function TetherEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd, markerStart,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: '#a1a1aa',
        strokeWidth: 1.5,
        strokeDasharray: '6 4',
        opacity: 0.6,
      }}
      markerEnd={markerEnd}
      markerStart={markerStart}
    />
  )
}
