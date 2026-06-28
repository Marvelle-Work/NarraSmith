import type {
  Block, InlineNode, TextMark,
  ParagraphBlock, HeadingBlock, BulletListBlock, OrderedListBlock,
  ChecklistBlock, CodeBlock, QuoteBlock, CalloutBlock,
} from '../types'

// ── Tiptap JSON → domain Block[] ─────────────────────────────────────────

export function blocksFromTiptap(json: unknown): Block[] {
  const doc = json as { type: string; content?: unknown[] } | null
  if (!doc?.content) return []
  const blocks: Block[] = []
  for (const node of doc.content) {
    const b = nodeToBlock(node as TiptapNode)
    if (b) blocks.push(b)
  }
  return blocks
}

type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

function nodeToBlock(node: TiptapNode): Block | null {
  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', content: inlinesFromContent(node.content) } satisfies ParagraphBlock
    case 'heading': {
      const raw = node.attrs?.level
      const level = (raw === 1 || raw === 2 || raw === 3) ? raw : 1
      return { type: 'heading', level, content: inlinesFromContent(node.content) } satisfies HeadingBlock
    }
    case 'bulletList':
      return {
        type: 'bullet-list',
        items: (node.content ?? []).map(li => inlinesFromContent(li.content?.[0]?.content)),
      } satisfies BulletListBlock
    case 'orderedList':
      return {
        type: 'ordered-list',
        items: (node.content ?? []).map(li => inlinesFromContent(li.content?.[0]?.content)),
      } satisfies OrderedListBlock
    case 'taskList':
      return {
        type: 'checklist',
        items: (node.content ?? []).map(li => ({
          checked: !!(li.attrs?.checked),
          content: inlinesFromContent(li.content?.[0]?.content),
        })),
      } satisfies ChecklistBlock
    case 'codeBlock':
      return {
        type: 'code',
        language: (node.attrs?.language as string | null) ?? undefined,
        code: node.content?.[0]?.text ?? '',
      } satisfies CodeBlock
    case 'blockquote':
      return {
        type: 'quote',
        content: inlinesFromContent(node.content?.[0]?.content),
      } satisfies QuoteBlock
    case 'callout':
      return {
        type: 'callout',
        icon: node.attrs?.icon as string | undefined,
        content: inlinesFromContent(node.content?.[0]?.content),
      } satisfies CalloutBlock
    case 'horizontalRule':
      return { type: 'hr' }
    default:
      return null
  }
}

function inlinesFromContent(content: TiptapNode[] | undefined): InlineNode[] {
  if (!content) return []
  return content.flatMap((node): InlineNode[] => {
    if (node.type !== 'text') return []
    const marks: TextMark[] = (node.marks ?? []).flatMap(m => {
      const mark = tiptapMarkToDomain(m.type)
      return mark ? [mark] : []
    })
    return [{ type: 'text', text: node.text ?? '', ...(marks.length && { marks }) }]
  })
}

function tiptapMarkToDomain(type: string): TextMark | null {
  switch (type) {
    case 'bold':      return 'bold'
    case 'italic':    return 'italic'
    case 'underline': return 'underline'
    case 'code':      return 'code'
    case 'strike':    return 'strikethrough'
    default:          return null
  }
}

// ── domain Block[] → Tiptap JSON ─────────────────────────────────────────

export function tiptapFromBlocks(blocks: Block[]): unknown {
  return {
    type: 'doc',
    content: blocks.length
      ? blocks.map(blockToTiptap).filter(Boolean)
      : [{ type: 'paragraph' }],
  }
}

function blockToTiptap(block: Block): unknown {
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', content: block.content.map(inlineToTiptap) }
    case 'heading':
      return { type: 'heading', attrs: { level: block.level }, content: block.content.map(inlineToTiptap) }
    case 'bullet-list':
      return {
        type: 'bulletList',
        content: block.items.map(item => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: item.map(inlineToTiptap) }],
        })),
      }
    case 'ordered-list':
      return {
        type: 'orderedList',
        content: block.items.map(item => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: item.map(inlineToTiptap) }],
        })),
      }
    case 'checklist':
      return {
        type: 'taskList',
        content: block.items.map(item => ({
          type: 'taskItem',
          attrs: { checked: item.checked },
          content: [{ type: 'paragraph', content: item.content.map(inlineToTiptap) }],
        })),
      }
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: block.language ?? null },
        content: [{ type: 'text', text: block.code }],
      }
    case 'quote':
      return {
        type: 'blockquote',
        content: [{ type: 'paragraph', content: block.content.map(inlineToTiptap) }],
      }
    case 'callout':
      return {
        type: 'blockquote',
        content: [{ type: 'paragraph', content: block.content.map(inlineToTiptap) }],
      }
    case 'hr':
      return { type: 'horizontalRule' }
  }
}

function inlineToTiptap(inline: InlineNode): unknown {
  if (inline.type === 'semantic-ref') {
    return { type: 'text', text: inline.displayText }
  }
  const marks = (inline.marks ?? []).map(m => ({ type: domainMarkToTiptap(m) }))
  return {
    type: 'text',
    text: inline.text,
    ...(marks.length && { marks }),
  }
}

function domainMarkToTiptap(mark: TextMark): string {
  switch (mark) {
    case 'bold':          return 'bold'
    case 'italic':        return 'italic'
    case 'underline':     return 'underline'
    case 'code':          return 'code'
    case 'strikethrough': return 'strike'
  }
}
