import { useState, useRef, useCallback, useEffect } from 'react'
import type { NotebookAsset, NotebookDocument, Block } from './types'
import type { WorldIndex } from './worldIndex'
import { NotebookEditor, Toolbar, type NullableTiptapEditor } from './NotebookEditor'
import { logger } from './lib/logger'

function docUid() { return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

type Props = {
  notebook: NotebookAsset
  onUpdate: (notebook: NotebookAsset) => void
  onClose: () => void
  worldIndex: WorldIndex
}

export function NotebookWorkspace({ notebook, onUpdate, onClose, worldIndex }: Props) {
  // Shared toolbar — points to whichever editor section was last focused
  const [activeEditor, setActiveEditor] = useState<NullableTiptapEditor>(null)

  const [renamingDocId, setRenamingDocId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(notebook.title)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => { setTitleDraft(notebook.title) }, [notebook.title])

  const scrollToSection = (docId: string) => {
    sectionRefs.current[docId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback((docId: string, content: Block[]) => {
    const now = new Date().toISOString()
    onUpdate({
      ...notebook,
      updatedAt: now,
      documents: notebook.documents.map(d =>
        d.id === docId ? { ...d, content, updatedAt: now } : d,
      ),
    })
    logger.debug('NOTEBOOK', 'NOTEBOOK_AUTOSAVE', {
      notebookId: notebook.id, documentId: docId, blockCount: content.length,
    })
  }, [notebook, onUpdate])

  // ── Document management ───────────────────────────────────────────────────
  const createDocument = () => {
    const now = new Date().toISOString()
    const doc: NotebookDocument = {
      id: docUid(), title: 'New Section', createdAt: now, updatedAt: now, content: [],
    }
    onUpdate({ ...notebook, updatedAt: now, documents: [...notebook.documents, doc], activeDocumentId: doc.id })
    logger.info('NOTEBOOK', 'NOTEBOOK_DOCUMENT_CREATE', { notebookId: notebook.id, documentId: doc.id })
    setTimeout(() => sectionRefs.current[doc.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const deleteDocument = (docId: string) => {
    if (notebook.documents.length <= 1) return
    const now = new Date().toISOString()
    onUpdate({ ...notebook, updatedAt: now, documents: notebook.documents.filter(d => d.id !== docId) })
    logger.info('NOTEBOOK', 'NOTEBOOK_DOCUMENT_DELETE', { notebookId: notebook.id, documentId: docId })
  }

  const commitRename = (docId: string) => {
    const title = renameValue.trim()
    if (!title) { setRenamingDocId(null); return }
    const now = new Date().toISOString()
    onUpdate({
      ...notebook, updatedAt: now,
      documents: notebook.documents.map(d => d.id === docId ? { ...d, title, updatedAt: now } : d),
    })
    logger.info('NOTEBOOK', 'NOTEBOOK_DOCUMENT_RENAME', { notebookId: notebook.id, documentId: docId, title })
    setRenamingDocId(null)
  }

  // ── Notebook title ────────────────────────────────────────────────────────
  const commitNotebookTitle = () => {
    const title = titleDraft.trim() || 'Untitled Notebook'
    onUpdate({ ...notebook, title, updatedAt: new Date().toISOString() })
    setEditingTitle(false)
  }

  const handleClose = () => {
    logger.info('NOTEBOOK', 'NOTEBOOK_CLOSE', { notebookId: notebook.id, documentCount: notebook.documents.length })
    onClose()
  }

  const lastEdited = notebook.updatedAt
    ? new Date(notebook.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        background: '#fff',
        borderBottom: '1px solid #e4e4e7',
        flexShrink: 0,
      }}>
        <button
          onClick={handleClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', background: 'none',
            border: '1px solid #e4e4e7', borderRadius: 6,
            color: '#52525b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Canvas
        </button>
        <div style={{ width: 1, height: 18, background: '#e4e4e7' }} />
        <span style={{ fontSize: 12, color: '#a1a1aa' }}>
          {notebook.documents.length} section{notebook.documents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Toolbar bar ─────────────────────────────────────────────────── */}
      <div style={{
        background: '#fafafa',
        borderBottom: '1px solid #e4e4e7',
        flexShrink: 0,
      }}>
        <Toolbar editor={activeEditor} />
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sections sidebar */}
        <div style={{
          width: 180, flexShrink: 0,
          borderRight: '1px solid #e4e4e7',
          background: '#fafafa',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 14px 6px',
            fontSize: 10, fontWeight: 700, color: '#a1a1aa',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            Sections
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notebook.documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => scrollToSection(doc.id)}
                style={{
                  width: '100%', display: 'block', textAlign: 'left',
                  padding: '7px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: '#52525b', lineHeight: 1.4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  borderLeft: '2px solid transparent',
                }}
                onMouseEnter={e => { (e.currentTarget).style.background = '#f0f0f0' }}
                onMouseLeave={e => { (e.currentTarget).style.background = 'none' }}
              >
                {doc.title}
              </button>
            ))}
          </div>
          <div style={{ padding: '8px 10px', borderTop: '1px solid #e4e4e7' }}>
            <button
              onClick={createDocument}
              style={{
                width: '100%', padding: '6px 8px', borderRadius: 6,
                border: '1px dashed #d4d4d8', background: 'transparent',
                color: '#6366f1', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}
            >
              + New Section
            </button>
          </div>
        </div>

        {/* ── Gray workspace + paper ─────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6', padding: '48px 40px 80px' }}>
          <div style={{
            maxWidth: 860,
            margin: '0 auto',
            background: '#fff',
            borderRadius: 6,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.06)',
            padding: '72px 88px 120px',
          }}>

            {/* ── Notebook cover ──────────────────────────────────────── */}
            <div style={{ marginBottom: 56, paddingBottom: 40, borderBottom: '1px solid #f0f0f0' }}>
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onBlur={commitNotebookTitle}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitNotebookTitle()
                    if (e.key === 'Escape') { setTitleDraft(notebook.title); setEditingTitle(false) }
                  }}
                  style={{
                    fontSize: 38, fontWeight: 800, color: '#09090b', lineHeight: 1.15,
                    border: 'none', borderBottom: '2px solid #6366f1',
                    padding: '4px 0', background: 'transparent', outline: 'none',
                    width: '100%', fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                />
              ) : (
                <h1
                  onClick={() => setEditingTitle(true)}
                  title="Click to rename"
                  style={{
                    fontSize: 38, fontWeight: 800, color: '#09090b', lineHeight: 1.15,
                    margin: 0, padding: '4px 0', cursor: 'text',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {notebook.title}
                </h1>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#a1a1aa', lineHeight: 1 }}>
                {notebook.documents.length} section{notebook.documents.length !== 1 ? 's' : ''}
                {lastEdited ? ` · last edited ${lastEdited}` : ''}
              </p>
            </div>

            {/* ── Sections ─────────────────────────────────────────────── */}
            {notebook.documents.map((doc, i) => (
              <div
                key={doc.id}
                ref={el => { sectionRefs.current[doc.id] = el }}
              >
                {/* Section title */}
                <div style={{ marginBottom: 18, display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  {renamingDocId === doc.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(doc.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(doc.id) }
                        if (e.key === 'Escape') { e.preventDefault(); setRenamingDocId(null) }
                      }}
                      style={{
                        fontSize: 24, fontWeight: 700, color: '#18181b', lineHeight: 1.3,
                        border: 'none', borderBottom: '2px solid #6366f1',
                        background: 'transparent', outline: 'none',
                        padding: '2px 0', flex: 1,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    />
                  ) : (
                    <h2
                      onDoubleClick={() => { setRenamingDocId(doc.id); setRenameValue(doc.title) }}
                      title="Double-click to rename"
                      style={{
                        fontSize: 24, fontWeight: 700, color: '#18181b', lineHeight: 1.3,
                        margin: 0, flex: 1, cursor: 'text',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    >
                      {doc.title}
                    </h2>
                  )}
                  {notebook.documents.length > 1 && renamingDocId !== doc.id && (
                    <DeleteSectionButton onDelete={() => deleteDocument(doc.id)} />
                  )}
                </div>

                {/* Editor */}
                <NotebookEditor
                  document={doc}
                  onSave={handleSave}
                  worldIndex={worldIndex}
                  onFocus={setActiveEditor}
                />

                {/* Section divider */}
                {i < notebook.documents.length - 1 && (
                  <div style={{ margin: '72px 0 64px', display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
                    <span style={{ fontSize: 14, color: '#e4e4e7', userSelect: 'none' }}>§</span>
                    <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
                  </div>
                )}
              </div>
            ))}

            {/* ── Add section ──────────────────────────────────────────── */}
            <div style={{ marginTop: 72, display: 'flex', justifyContent: 'center' }}>
              <AddSectionButton onClick={createDocument} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeleteSectionButton({ onDelete }: { onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onDelete}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Delete section"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0,
        color: hovered ? '#dc2626' : '#d4d4d8',
        transition: 'color 0.12s',
      }}
    >
      ×
    </button>
  )
}

function AddSectionButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 24px', borderRadius: 8,
        border: `1.5px dashed ${hovered ? '#6366f1' : '#d4d4d8'}`,
        background: 'transparent',
        color: hovered ? '#6366f1' : '#a1a1aa',
        fontWeight: 600, fontSize: 14, cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      + Add Section
    </button>
  )
}
