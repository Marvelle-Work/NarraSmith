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
  profileImageUrl?: string
  labelColor?: string
  rootGlowColor?: string
}

export type GraphNode = Node<NodeData>

export type RelationshipDirection = 'undirected' | 'directed' | 'directed-reversed' | 'bidirectional'

export type EdgeData = {
  labelT?: number
  color?: string
  schemaColor?: string
  relationshipTypeId?: string
  description?: string
  whyItMatters?: string
  direction?: RelationshipDirection
}

// ── Asset entry types (used by AttachmentAsset) ───────────────────────────

export type AssetEntryType = 'music' | 'image' | 'document' | 'link' | 'custom'

export type AssetEntry = {
  id: string
  type: AssetEntryType
  label: string
  value: string
  isLinkified: boolean
}

// ── Asset type system ─────────────────────────────────────────────────────

export type AssetKind =
  | 'attachment'
  | 'canvas-image'
  | 'notebook'
  | 'image'
  | 'audio'
  | 'video'
  | 'file'
  | 'link'
  | 'dataset'
  | 'script'
  | 'component'

export type AssetBase = {
  id: string
  kind: AssetKind
  title: string
  description?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  linkedEntityIds: string[]
  isPinnedOnCanvas: boolean
  position?: { x: number; y: number }
}

// Attachment: the legacy multi-entry container (link / image / music / doc / custom)
export type AttachmentAsset = AssetBase & {
  kind: 'attachment'
  entries: AssetEntry[]
}

// Canvas image: an image placed directly on the graph canvas
export type CanvasImageAsset = AssetBase & {
  kind: 'canvas-image'
  imageUrl: string
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  zIndex: number
}

// Notebook: a container of editable documents
export type NotebookAsset = AssetBase & {
  kind: 'notebook'
  documents: NotebookDocument[]
  activeDocumentId?: string
}

// Remaining asset kinds (stubs — fields added when features ship)
export type ImageAsset     = AssetBase & { kind: 'image';     url: string; altText?: string }
export type AudioAsset     = AssetBase & { kind: 'audio';     url: string }
export type VideoAsset     = AssetBase & { kind: 'video';     url: string }
export type FileAsset      = AssetBase & { kind: 'file';      url: string; mimeType?: string }
export type LinkAsset      = AssetBase & { kind: 'link';      url: string }
export type DatasetAsset   = AssetBase & { kind: 'dataset' }
export type ScriptAsset    = AssetBase & { kind: 'script' }
export type ComponentAsset = AssetBase & { kind: 'component' }

export type Asset =
  | AttachmentAsset
  | CanvasImageAsset
  | NotebookAsset
  | ImageAsset
  | AudioAsset
  | VideoAsset
  | FileAsset
  | LinkAsset
  | DatasetAsset
  | ScriptAsset
  | ComponentAsset

// ── Notebook content model ────────────────────────────────────────────────
// Domain types are independent of the editor library (Tiptap).
// The editor serializes to/from this format via an adapter layer.

export type TextMark = 'bold' | 'italic' | 'underline' | 'code' | 'strikethrough'

export type TextInline = {
  type: 'text'
  text: string
  marks?: TextMark[]
}

export type SemanticRefInline = {
  type: 'semantic-ref'
  targetId: string
  targetKind: 'entity' | 'asset' | 'concept' | 'relationship'
  displayText: string
}

export type InlineNode = TextInline | SemanticRefInline

export type ParagraphBlock   = { type: 'paragraph';     content: InlineNode[] }
export type HeadingBlock     = { type: 'heading';       level: 1 | 2 | 3; content: InlineNode[] }
export type BulletListBlock  = { type: 'bullet-list';   items: InlineNode[][] }
export type OrderedListBlock = { type: 'ordered-list';  items: InlineNode[][] }
export type ChecklistBlock   = { type: 'checklist';     items: { checked: boolean; content: InlineNode[] }[] }
export type CodeBlock        = { type: 'code';          language?: string; code: string }
export type QuoteBlock       = { type: 'quote';         content: InlineNode[] }
export type CalloutBlock     = { type: 'callout';       icon?: string; content: InlineNode[] }
export type HorizontalRuleBlock = { type: 'hr' }

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | BulletListBlock
  | OrderedListBlock
  | ChecklistBlock
  | CodeBlock
  | QuoteBlock
  | CalloutBlock
  | HorizontalRuleBlock

export type NotebookDocument = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  content: Block[]
}

// ── Canvas node view types (React Flow node.data — not stored in world) ───

export type AssetNodeData = {
  assetId: string
  kind?: AssetKind
  title: string
  entryCount: number
  entrySummary: string
}

export type CanvasImageNodeData = {
  canvasImageId: string
  title: string
  imageUrl: string
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
}

// ── Utilities ─────────────────────────────────────────────────────────────

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
