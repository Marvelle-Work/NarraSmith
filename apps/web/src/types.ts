import type { Node } from '@xyflow/react'
import type { CSSProperties } from 'react'

export type NodeData = {
  label: string
  entityType: string
  description?: string
  color?: string
}

export type GraphNode = Node<NodeData>

export const ENTITY_TYPE_PRESETS = ['Character', 'Event', 'Location', 'Object'] as const
export type EntityType = typeof ENTITY_TYPE_PRESETS[number]

const KNOWN_COLORS: Record<EntityType, { bg: string; border: string; ring: string; text: string }> = {
  Character: { bg: '#f3f0ff', border: '#7c3aed', ring: 'rgba(124,58,237,0.2)', text: '#5b21b6' },
  Event:     { bg: '#fffbeb', border: '#d97706', ring: 'rgba(217,119,6,0.2)',   text: '#92400e' },
  Location:  { bg: '#eff6ff', border: '#2563eb', ring: 'rgba(37,99,235,0.2)',   text: '#1d4ed8' },
  Object:    { bg: '#f0fdf4', border: '#16a34a', ring: 'rgba(22,163,74,0.2)',   text: '#166534' },
}

const DEFAULT_COLOR = { bg: '#f4f4f5', border: '#71717a', ring: 'rgba(113,113,122,0.2)', text: '#3f3f46' }

export function entityColors(type: string) {
  return (KNOWN_COLORS as Record<string, typeof DEFAULT_COLOR>)[type] ?? DEFAULT_COLOR
}

export const RELATIONSHIP_OPTIONS = [
  'Opposes', 'Allies', 'Related to', 'Created by', 'Influences',
] as const

export type RelationshipType = typeof RELATIONSHIP_OPTIONS[number]

type EdgeStyling = { style: CSSProperties; animated?: boolean }

const EDGE_STYLES: Record<RelationshipType, EdgeStyling> = {
  'Opposes':    { style: { stroke: '#ef4444', strokeWidth: 2 } },
  'Allies':     { style: { stroke: '#22c55e', strokeWidth: 2 } },
  'Related to': { style: { stroke: '#94a3b8', strokeWidth: 1.5 } },
  'Created by': { style: { stroke: '#3b82f6', strokeWidth: 2 }, animated: true },
  'Influences': { style: { stroke: '#8b5cf6', strokeWidth: 2 } },
}

export function edgeStyleForLabel(label: string): EdgeStyling {
  if (label in EDGE_STYLES) return EDGE_STYLES[label as RelationshipType]
  return { style: { stroke: '#a1a1aa', strokeWidth: 1.5 } }
}
