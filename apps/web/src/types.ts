import type { Node } from '@xyflow/react'
import type { CSSProperties } from 'react'

export type SizeLevel = 1 | 2 | 3 | 4 | 5

export const SIZE_LEVELS: { level: SizeLevel; label: string; diameter: number; fontSize: number; hint: string }[] = [
  { level: 1, label: 'Background', diameter: 52,  fontSize: 10, hint: 'World filler — exists but rarely central' },
  { level: 2, label: 'Minor',      diameter: 66,  fontSize: 10, hint: 'Side entity — supports the main story' },
  { level: 3, label: 'Standard',   diameter: 80,  fontSize: 11, hint: 'Normal entity — part of the world' },
  { level: 4, label: 'Important',  diameter: 100, fontSize: 12, hint: 'Story relevant — drives or shapes events' },
  { level: 5, label: 'Core',       diameter: 124, fontSize: 13, hint: 'Narrative anchor — central to everything' },
]

export type FieldBlock = {
  id: string
  label?: string
  values: Record<string, string>
}

export type ConceptInstance = {
  id: string
  label?: string
  typeId: string
  values: Record<string, string | FieldBlock[]>
}

export type NodeData = {
  label: string
  entityType: string
  typeId?: string
  fields?: Record<string, string | FieldBlock[]>
  description?: string
  color?: string
  sizeLevel?: SizeLevel
  concepts?: Record<string, ConceptInstance[]>
  isRoot?: boolean
}

export type GraphNode = Node<NodeData>

export type EdgeData = {
  labelT?: number
  color?: string
  schemaColor?: string
  relationshipTypeId?: string
  description?: string
  whyItMatters?: string
}

export type AssetEntryType = 'music' | 'image' | 'document' | 'link' | 'custom'

export type AssetEntry = {
  id: string
  type: AssetEntryType
  label: string
  value: string
  isLinkified: boolean
}

export type AssetData = {
  id: string
  title: string
  linkedEntityIds: string[]
  isPinnedOnCanvas: boolean
  position?: { x: number; y: number }
  entries: AssetEntry[]
}

export type AssetNodeData = {
  assetId: string
  title: string
  entryCount: number
  entrySummary: string
}

export function isUrl(text: string): boolean {
  try {
    const u = new URL(text)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

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
