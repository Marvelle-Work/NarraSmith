import { useCallback, useRef } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'

// Cubic bezier control points: [P0x, P0y, CP1x, CP1y, CP2x, CP2y, P3x, P3y]
type CubicPts = [number, number, number, number, number, number, number, number]

function parseBezier(path: string): CubicPts | null {
  // getBezierPath produces: M{x0},{y0} C{cx1},{cy1} {cx2},{cy2} {x3},{y3}
  const m = path.match(
    /M\s*([\d.-]+),\s*([\d.-]+)\s*C\s*([\d.-]+),\s*([\d.-]+)\s+([\d.-]+),\s*([\d.-]+)\s+([\d.-]+),\s*([\d.-]+)/,
  )
  return m ? (m.slice(1, 9).map(Number) as CubicPts) : null
}

function evalBezier(t: number, [p0x, p0y, c1x, c1y, c2x, c2y, p3x, p3y]: CubicPts): [number, number] {
  const u = 1 - t
  return [
    u**3*p0x + 3*u**2*t*c1x + 3*u*t**2*c2x + t**3*p3x,
    u**3*p0y + 3*u**2*t*c1y + 3*u*t**2*c2y + t**3*p3y,
  ]
}

// Coarse 100-sample sweep, then a fine 20-sample refinement around the winner
function closestT(mx: number, my: number, pts: CubicPts): number {
  const COARSE = 100
  let bestT = 0.5, bestD = Infinity
  for (let i = 0; i <= COARSE; i++) {
    const t = i / COARSE
    const [bx, by] = evalBezier(t, pts)
    const d = (bx - mx) ** 2 + (by - my) ** 2
    if (d < bestD) { bestD = d; bestT = t }
  }
  // Refine around bestT ± 1 coarse step
  const step = 1 / COARSE
  const lo = Math.max(0, bestT - step)
  const hi = Math.min(1, bestT + step)
  const FINE = 20
  for (let i = 0; i <= FINE; i++) {
    const t = lo + (i / FINE) * (hi - lo)
    const [bx, by] = evalBezier(t, pts)
    const d = (bx - mx) ** 2 + (by - my) ** 2
    if (d < bestD) { bestD = d; bestT = t }
  }
  return bestT
}

export function RelationshipEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  label, style, markerEnd, markerStart, interactionWidth,
  data,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow()

  const [edgePath, midX, midY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const controlPtsRef = useRef<CubicPts | null>(null)
  controlPtsRef.current = parseBezier(edgePath)

  const t = typeof data?.labelT === 'number' ? (data.labelT as number) : 0.5
  const [labelX, labelY] = controlPtsRef.current
    ? evalBezier(t, controlPtsRef.current)
    : [midX, midY]

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const pts = controlPtsRef.current

    const onMove = (me: MouseEvent) => {
      if (!pts) return
      const fp = screenToFlowPosition({ x: me.clientX, y: me.clientY })
      setEdges(eds => eds.map(edge =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, labelT: closestT(fp.x, fp.y, pts) } }
          : edge,
      ))
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [id, setEdges, screenToFlowPosition])

  const hasLabel = typeof label === 'string' && label.trim() !== ''
  const finalStyle = data?.color
    ? { ...style, stroke: data.color as string }
    : data?.schemaColor
    ? { ...style, stroke: data.schemaColor as string }
    : style

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={finalStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            onMouseDown={onMouseDown}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              cursor: 'grab',
              background: '#fff',
              border: '1px solid #d4d4d8',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: '#18181b',
              fontFamily: 'system-ui, sans-serif',
              userSelect: 'none',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
