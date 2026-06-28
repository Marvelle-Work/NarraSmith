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

// In Tiptap v3, useEditor() returns Editor (non-nullable). Nullable variant for shared toolbar state.
export type TiptapEditor = ReturnType<typeof useEditor>
export type NullableTiptapEditor = TiptapEditor | null

type Props = {
  document: NotebookDocument
  onSave: (docId: string, content: Block[]) => void
  worldIndex: WorldIndex
  onFocus?: (editor: TiptapEditor) => void
}

const AUTOSAVE_DELAY = 1200

export function NotebookEditor({ document, onSave, worldIndex: _worldIndex, onFocus }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docIdRef = useRef(document.id)
  const onSaveRef = useRef(onSave)
  const onFocusRef = useRef(onFocus)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onFocusRef.current = onFocus }, [onFocus])

  const scheduleSave = useCallback((editor: TiptapEditor) => {
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
    onUpdate: ({ editor }) => scheduleSave(editor as TiptapEditor),
    onFocus: ({ editor }) => onFocusRef.current?.(editor as TiptapEditor),
  })

  // Switch documents without remounting
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (docIdRef.current === document.id) return
    docIdRef.current = document.id
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    editor.commands.setContent(tiptapFromBlocks(document.content) as any, { emitUpdate: false })
  }, [document.id, editor])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  return (
    <div>
      <style>{EDITOR_STYLES}</style>
      <EditorContent editor={editor} />
    </div>
  )
}

// ── Shared Toolbar ───────────────────────────────────────────────────────────
// Exported so NotebookWorkspace can render one shared instance above the paper.

export function Toolbar({ editor }: { editor: NullableTiptapEditor }) {
  if (!editor) {
    return (
      <div style={{ height: 38, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 2 }}>
        <span style={{ fontSize: 11, color: '#d4d4d8' }}>Click in a section to activate toolbar</span>
      </div>
    )
  }

  const btn = (active: boolean, onClick: () => void, label: string, title?: string) => (
    <button
      key={label}
      onMouseDown={e => { e.preventDefault(); onClick() }}
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

  const div = () => <div style={{ width: 1, height: 16, background: '#e4e4e7', margin: '0 4px' }} />

  return (
    <div style={{
      display: 'flex', gap: 2, padding: '3px 12px',
      flexWrap: 'wrap', alignItems: 'center', minHeight: 38,
    }}>
      {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'B',  'Bold')}
      {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'I',  'Italic')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'U',  'Underline')}
      {btn(editor.isActive('strike'),    () => editor.chain().focus().toggleStrike().run(),    'S̶',  'Strikethrough')}
      {btn(editor.isActive('code'),      () => editor.chain().focus().toggleCode().run(),      '<>', 'Inline Code')}
      {div()}
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3')}
      {div()}
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  '• List')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '1. List')}
      {btn(editor.isActive('taskList'),    () => editor.chain().focus().toggleTaskList().run(),    '☑ Tasks')}
      {div()}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), '"Quote"')}
      {btn(editor.isActive('codeBlock'),  () => editor.chain().focus().toggleCodeBlock().run(),  '</> Block')}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), '—', 'Horizontal Rule')}
    </div>
  )
}

// ── Editor prose styles ───────────────────────────────────────────────────────

const EDITOR_STYLES = `
.ProseMirror { outline: none; font-family: 'Georgia', 'Times New Roman', serif; font-size: 16px; line-height: 1.8; color: #18181b; min-height: 120px; }
.ProseMirror p { margin: 0 0 0.75em; }
.ProseMirror h1 { font-size: 1.75em; font-weight: 700; margin: 1.4em 0 0.5em; color: #09090b; font-family: system-ui, -apple-system, sans-serif; }
.ProseMirror h2 { font-size: 1.35em; font-weight: 700; margin: 1.2em 0 0.4em; color: #09090b; font-family: system-ui, -apple-system, sans-serif; }
.ProseMirror h3 { font-size: 1.1em; font-weight: 700; margin: 1.1em 0 0.3em; color: #09090b; font-family: system-ui, -apple-system, sans-serif; }
.ProseMirror ul { padding-left: 1.5em; margin: 0 0 0.75em; }
.ProseMirror ol { padding-left: 1.5em; margin: 0 0 0.75em; }
.ProseMirror li { margin: 0.2em 0; }
.ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.4em; }
.ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
.ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; padding-top: 0.25em; }
.ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
.ProseMirror blockquote { border-left: 3px solid #a78bfa; margin: 0.8em 0; padding: 0.5em 1.2em; color: #52525b; background: #fafafa; border-radius: 0 4px 4px 0; font-style: italic; }
.ProseMirror pre { background: #18181b; color: #d4d4d8; padding: 1em 1.2em; border-radius: 6px; font-size: 13px; overflow-x: auto; margin: 0.8em 0; }
.ProseMirror code { background: #f4f4f5; color: #6366f1; padding: 1px 5px; border-radius: 3px; font-size: 0.88em; font-family: 'Fira Code', 'Cascadia Code', monospace; }
.ProseMirror pre code { background: none; color: inherit; padding: 0; }
.ProseMirror hr { border: none; border-top: 1px solid #e4e4e7; margin: 1.5em 0; }
.nb-editor-empty::before { content: attr(data-placeholder); color: #c4c4c7; pointer-events: none; height: 0; float: left; font-style: italic; font-family: 'Georgia', serif; }
`
