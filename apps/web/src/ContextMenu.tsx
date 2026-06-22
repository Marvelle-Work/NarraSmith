import { useEffect, useRef } from 'react'
import type { CommandId, CommandPayload } from './commands'

export type ContextMenuTarget =
  | { type: 'canvas'; position: { x: number; y: number } }
  | { type: 'node'; nodeId: string; nodeType: 'entity' | 'asset' | 'canvas-image'; position?: { x: number; y: number } }
  | { type: 'edge'; edgeId: string }

export type ContextMenuItem = {
  commandId: CommandId
  label: string
  color?: string
  dividerBefore?: boolean
  payloadFromTarget: (target: ContextMenuTarget) => CommandPayload[CommandId]
}

type Props = {
  x: number
  y: number
  target: ContextMenuTarget
  items: ContextMenuItem[]
  onExecute: <K extends CommandId>(id: K, payload: CommandPayload[K]) => void
  onClose: () => void
}

export function ContextMenu({ x, y, target, items, onExecute, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    setTimeout(() => document.addEventListener('mousedown', close), 0)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  if (items.length === 0) return null

  const menuWidth = 200
  const menuHeight = items.length * 34 + 8
  const left = Math.min(x, window.innerWidth - menuWidth - 8)
  const top = Math.min(y, window.innerHeight - menuHeight - 8)

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left, top, zIndex: 5000,
        background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '4px 0', minWidth: menuWidth,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {items.map((item, i) => (
        <div key={item.commandId}>
          {item.dividerBefore && i > 0 && <div style={{ height: 1, background: '#e4e4e7', margin: '3px 0' }} />}
          <button
            onClick={() => {
              const payload = item.payloadFromTarget(target)
              onExecute(item.commandId, payload)
              onClose()
            }}
            style={{
              display: 'block', width: '100%', padding: '7px 14px',
              background: 'none', border: 'none', textAlign: 'left',
              fontSize: 13, fontWeight: 500,
              color: item.color ?? '#18181b',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f4f4f5')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Menu definitions (declarative, no state references) ─────────────────

const EMPTY = {} as CommandPayload[CommandId]
const nodeId = (t: ContextMenuTarget) => t.type === 'node' ? { id: t.nodeId } : EMPTY
const assetIdFromNode = (t: ContextMenuTarget) =>
  t.type === 'node' ? { id: t.nodeId.replace('asset-node-', '') } : EMPTY
const edgeId = (t: ContextMenuTarget) => t.type === 'edge' ? { id: t.edgeId } : EMPTY

const canvasImgId = (t: ContextMenuTarget) =>
  t.type === 'node' ? { id: t.nodeId.replace('canvas-img-', '') } : EMPTY

export const CANVAS_ITEMS: ContextMenuItem[] = [
  { commandId: 'entity.create', label: 'New Entity', payloadFromTarget: t => t.type === 'canvas' ? { position: t.position } : EMPTY },
  { commandId: 'asset.create', label: 'New Asset', payloadFromTarget: () => EMPTY },
  { commandId: 'canvas-image.insert', label: 'Insert Canvas Image', payloadFromTarget: t => t.type === 'canvas' ? { position: t.position } : EMPTY },
  { commandId: 'ui.world-index', label: 'World Index', dividerBefore: true, payloadFromTarget: () => EMPTY },
  { commandId: 'ui.asset-index', label: 'Assets', payloadFromTarget: () => EMPTY },
]

export const ENTITY_ITEMS: ContextMenuItem[] = [
  { commandId: 'entity.select', label: 'Edit', payloadFromTarget: nodeId },
  { commandId: 'entity.toggle-root', label: 'Toggle Root Node', payloadFromTarget: nodeId },
  { commandId: 'entity.delete', label: 'Delete Entity', color: '#dc2626', dividerBefore: true, payloadFromTarget: nodeId },
]

export const ASSET_ITEMS: ContextMenuItem[] = [
  { commandId: 'asset.select', label: 'Edit Asset', payloadFromTarget: nodeId },
  { commandId: 'asset.toggle-pin', label: 'Unpin from Canvas', payloadFromTarget: assetIdFromNode },
  { commandId: 'asset.delete', label: 'Delete Asset', color: '#dc2626', dividerBefore: true, payloadFromTarget: assetIdFromNode },
]

const nodePosition = (t: ContextMenuTarget) =>
  t.type === 'node' && t.position ? { position: t.position } : EMPTY

export const CANVAS_IMAGE_ITEMS: ContextMenuItem[] = [
  { commandId: 'canvas-image.select', label: 'Edit Image', payloadFromTarget: canvasImgId },
  { commandId: 'canvas-image.drag', label: 'Drag Image', payloadFromTarget: canvasImgId },
  { commandId: 'canvas-image.toggle-lock', label: 'Toggle Lock', payloadFromTarget: canvasImgId },
  { commandId: 'canvas-image.duplicate', label: 'Duplicate Image', payloadFromTarget: canvasImgId },
  { commandId: 'canvas-image.delete', label: 'Delete Image', color: '#dc2626', payloadFromTarget: canvasImgId },
  { commandId: 'entity.create', label: 'New Entity', dividerBefore: true, payloadFromTarget: nodePosition },
  { commandId: 'asset.create', label: 'New Asset', payloadFromTarget: () => EMPTY },
  { commandId: 'canvas-image.insert', label: 'Insert Canvas Image', payloadFromTarget: nodePosition },
  { commandId: 'ui.world-index', label: 'World Index', dividerBefore: true, payloadFromTarget: () => EMPTY },
  { commandId: 'ui.asset-index', label: 'Assets', payloadFromTarget: () => EMPTY },
]

export const EDGE_ITEMS: ContextMenuItem[] = [
  { commandId: 'edge.select', label: 'Edit', payloadFromTarget: edgeId },
  { commandId: 'edge.reverse', label: 'Reverse Direction', payloadFromTarget: edgeId },
  { commandId: 'edge.delete', label: 'Delete', color: '#dc2626', dividerBefore: true, payloadFromTarget: edgeId },
]

export function getMenuItems(target: ContextMenuTarget): ContextMenuItem[] {
  switch (target.type) {
    case 'canvas': return CANVAS_ITEMS
    case 'node':
      if (target.nodeType === 'asset') return ASSET_ITEMS
      if (target.nodeType === 'canvas-image') return CANVAS_IMAGE_ITEMS
      return ENTITY_ITEMS
    case 'edge': return EDGE_ITEMS
  }
}
