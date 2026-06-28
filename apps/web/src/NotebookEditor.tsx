import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import type { NotebookDocument, Block } from './types'
import type { WorldIndex } from './worldIndex'
import { tiptapFromBlocks, blocksFromTiptap } from './lib/tiptap-adapter'
import { logger } from './lib/logger'

type Props = {
  document: NotebookDocument
  onSave: (docId: string, content: Block[]) => void
  worldIndex: WorldIndex
}

const AUTOSAVE_DELAY = 1200

export function NotebookEditor({ document, onSave, worldIndex: _worldIndex }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docIdRef = useRef(document.id)
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const scheduleSave = useCallback((editor: ReturnType<typeof useEditor>) => {
    if (!editor) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const blocks = blocksFromTiptap(editor.getJSON())
      const t0 = performance.now()
      onSaveRef.current(docIdRef.current, blocks)
      logger.debug('NOTEBOOK', 'NOTEBOOK_SAVE', {
        documentId: docIdRef.current,
        blockCount: blocks.length,
        payloadBytes: JSON.stringify(blocks).length,
        durationMs: Math.round(performance.now() - t0),
      })
    }, AUTOSAVE_DELAY)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { languageClassPrefix: 'language-' } }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Underline,
      Placeholder.configure({ placeholder: 'Start writing…', emptyEditorClass: 'nb-editor-empty' }),
    ],
    content: tiptapFromBlocks(document.content) as any,
    onUpdate: ({ editor }) => scheduleSave(editor as any),
  })

  // When the user switches documents: update content without remounting the editor.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (docIdRef.current === document.id) return
    docIdRef.current = document.id
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    editor.commands.setContent(tiptapFromBlocks(document.content) as any, { emitUpdate: false })
  }, [document.id, editor])

  // Flush on unmount
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar editor={editor} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: '#fff' }}>
        <style>{EDITOR_STYLES}</style>
        <EditorContent editor={editor} style={{ minHeight: '100%' }} />
      </div>
    </div>
  )
}

// ── Toolbar ──────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, label: string, title?: string) => (
    <button
      key={label}
      onClick={onClick}
      title={title ?? label}
      style={{
        padding: '3px 8px', borderRadius: 4,
        border: 'none',
        background: active ? '#ede9fe' : 'transparent',
        color: active ? '#6366f1' : '#52525b',
        fontWeight: active ? 700 : 400,
        fontSize: 12, cursor: 'pointer',
        lineHeight: '20px',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      display: 'flex', gap: 2, padding: '6px 12px',
      borderBottom: '1px solid #f4f4f5',
      background: '#fafafa',
      flexWrap: 'wrap',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'B',  'Bold')}
      {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'I',  'Italic')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'U',  'Underline')}
      {btn(editor.isActive('strike'),    () => editor.chain().focus().toggleStrike().run(),    'S̶',  'Strikethrough')}
      {btn(editor.isActive('code'),      () => editor.chain().focus().toggleCode().run(),      '<>', 'Inline Code')}
      <div style={{ width: 1, height: 16, background: '#e4e4e7', margin: '0 4px' }} />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3')}
      <div style={{ width: 1, height: 16, background: '#e4e4e7', margin: '0 4px' }} />
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  '• List')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '1. List')}
      {btn(editor.isActive('taskList'),    () => editor.chain().focus().toggleTaskList().run(),    '☑ Tasks')}
      <div style={{ width: 1, height: 16, background: '#e4e4e7', margin: '0 4px' }} />
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), '"Quote"')}
      {btn(editor.isActive('codeBlock'),  () => editor.chain().focus().toggleCodeBlock().run(),  '</> Block')}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), '—', 'Horizontal Rule')}
    </div>
  )
}

// ── Editor prose styles (injected as a <style> tag) ──────────────────────

const EDITOR_STYLES = `
.ProseMirror { outline: none; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.7; color: #18181b; }
.ProseMirror p { margin: 0 0 0.6em; }
.ProseMirror h1 { font-size: 1.8em; font-weight: 700; margin: 1.2em 0 0.4em; color: #09090b; }
.ProseMirror h2 { font-size: 1.4em; font-weight: 700; margin: 1.1em 0 0.3em; color: #09090b; }
.ProseMirror h3 { font-size: 1.15em; font-weight: 700; margin: 1em 0 0.3em; color: #09090b; }
.ProseMirror ul { padding-left: 1.4em; margin: 0 0 0.6em; }
.ProseMirror ol { padding-left: 1.4em; margin: 0 0 0.6em; }
.ProseMirror li { margin: 0.15em 0; }
.ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.4em; }
.ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
.ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; padding-top: 0.2em; }
.ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
.ProseMirror blockquote { border-left: 3px solid #a78bfa; margin: 0.6em 0; padding: 0.4em 1em; color: #52525b; background: #fafafa; border-radius: 0 4px 4px 0; }
.ProseMirror pre { background: #18181b; color: #d4d4d8; padding: 1em 1.2em; border-radius: 6px; font-size: 13px; overflow-x: auto; margin: 0.6em 0; }
.ProseMirror code { background: #f4f4f5; color: #6366f1; padding: 1px 5px; border-radius: 3px; font-size: 0.9em; font-family: 'Fira Code', 'Cascadia Code', monospace; }
.ProseMirror pre code { background: none; color: inherit; padding: 0; }
.ProseMirror hr { border: none; border-top: 1px solid #e4e4e7; margin: 1.2em 0; }
.nb-editor-empty::before { content: attr(data-placeholder); color: #a1a1aa; pointer-events: none; height: 0; float: left; }
`
