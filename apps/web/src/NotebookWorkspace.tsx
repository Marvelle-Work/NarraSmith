import { useState, useEffect, useCallback } from 'react'
import type { NotebookAsset, NotebookDocument, Block } from './types'
import type { WorldIndex } from './worldIndex'
import { NotebookEditor } from './NotebookEditor'
import { logger } from './lib/logger'

function uid() { return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

type Props = {
  notebook: NotebookAsset
  onUpdate: (notebook: NotebookAsset) => void
  onClose: () => void
  worldIndex: WorldIndex
}

export function NotebookWorkspace({ notebook, onUpdate, onClose, worldIndex }: Props) {
  const [activeDocId, setActiveDocId] = useState<string>(
    () => notebook.activeDocumentId ?? notebook.documents[0]?.id ?? '',
  )
  const [editingTitle, setEditingTitle] = useState(false)
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Sync activeDocId if the notebook changes from outside (e.g., cloud load)
  useEffect(() => {
    if (!notebook.documents.find(d => d.id === activeDocId) && notebook.documents.length > 0) {
      setActiveDocId(notebook.documents[0].id)
    }
  }, [notebook.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeDoc = notebook.documents.find(d => d.id === activeDocId) ?? notebook.documents[0]

  // ── Document content save ────────────────────────────────────────────
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
      notebookId: notebook.id,
      documentId: docId,
      blockCount: content.length,
    })
  }, [notebook, onUpdate])

  // ── Document management ──────────────────────────────────────────────
  const createDocument = () => {
    const now = new Date().toISOString()
    const doc: NotebookDocument = {
      id: uid(), title: 'Untitled', createdAt: now, updatedAt: now, content: [],
    }
    const updated: NotebookAsset = {
      ...notebook,
      updatedAt: now,
      documents: [...notebook.documents, doc],
      activeDocumentId: doc.id,
    }
    onUpdate(updated)
    setActiveDocId(doc.id)
    logger.info('NOTEBOOK', 'NOTEBOOK_DOCUMENT_CREATE', {
      notebookId: notebook.id, documentId: doc.id,
    })
  }

  const deleteDocument = (docId: string) => {
    if (notebook.documents.length <= 1) return
    const now = new Date().toISOString()
    const remaining = notebook.documents.filter(d => d.id !== docId)
    const nextActiveId = remaining.find(d => d.id !== docId)?.id ?? remaining[0]?.id ?? ''
    onUpdate({ ...notebook, updatedAt: now, documents: remaining })
    if (activeDocId === docId) setActiveDocId(nextActiveId)
    logger.info('NOTEBOOK', 'NOTEBOOK_DOCUMENT_DELETE', { notebookId: notebook.id, documentId: docId })
  }

  const commitRename = (docId: string) => {
    const title = renameValue.trim()
    if (!title) { setRenamingDocId(null); return }
    const now = new Date().toISOString()
    onUpdate({
      ...notebook,
      updatedAt: now,
      documents: notebook.documents.map(d => d.id === docId ? { ...d, title, updatedAt: now } : d),
    })
    logger.info('NOTEBOOK', 'NOTEBOOK_DOCUMENT_RENAME', { notebookId: notebook.id, documentId: docId, title })
    setRenamingDocId(null)
  }

  // ── Notebook title ───────────────────────────────────────────────────
  const [titleDraft, setTitleDraft] = useState(notebook.title)
  useEffect(() => { setTitleDraft(notebook.title) }, [notebook.title])

  const commitNotebookTitle = () => {
    const title = titleDraft.trim() || 'Untitled Notebook'
    onUpdate({ ...notebook, title, updatedAt: new Date().toISOString() })
    setEditingTitle(false)
  }

  const handleClose = () => {
    logger.info('NOTEBOOK', 'NOTEBOOK_CLOSE', {
      notebookId: notebook.id, documentCount: notebook.documents.length,
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      background: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        height: 48,
        borderBottom: '1px solid #e4e4e7',
        background: '#fafafa',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, color: '#6366f1', flexShrink: 0 }}>📓</span>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitNotebookTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitNotebookTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
              style={{
                fontSize: 14, fontWeight: 700, color: '#18181b',
                border: 'none', borderBottom: '2px solid #6366f1',
                padding: '2px 4px', background: 'transparent', outline: 'none',
                minWidth: 120,
              }}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              title="Rename notebook"
              style={{
                fontSize: 14, fontWeight: 700, color: '#18181b',
                background: 'none', border: 'none', padding: '2px 4px',
                cursor: 'text', borderRadius: 4,
              }}
            >
              {notebook.title}
            </button>
          )}
          <span style={{ fontSize: 11, color: '#a1a1aa', flexShrink: 0 }}>
            {notebook.documents.length} doc{notebook.documents.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={handleClose}
          style={{
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid #e4e4e7', background: '#fff',
            color: '#52525b', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar — document list */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: '1px solid #e4e4e7',
          background: '#f9fafb',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 12px 6px',
            fontSize: 10, fontWeight: 700, color: '#a1a1aa',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            Documents
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notebook.documents.map(doc => (
              <DocRow
                key={doc.id}
                doc={doc}
                active={doc.id === activeDocId}
                renamingDocId={renamingDocId}
                renameValue={renameValue}
                onSelect={() => setActiveDocId(doc.id)}
                onStartRename={() => { setRenamingDocId(doc.id); setRenameValue(doc.title) }}
                onRenameChange={setRenameValue}
                onRenameCommit={() => commitRename(doc.id)}
                onRenameCancel={() => setRenamingDocId(null)}
                onDelete={() => deleteDocument(doc.id)}
                canDelete={notebook.documents.length > 1}
              />
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
              + New Document
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeDoc ? (
            <NotebookEditor
              document={activeDoc}
              onSave={handleSave}
              worldIndex={worldIndex}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#a1a1aa', fontSize: 14 }}>
              No document selected
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── DocRow ────────────────────────────────────────────────────────────────

type DocRowProps = {
  doc: NotebookDocument
  active: boolean
  renamingDocId: string | null
  renameValue: string
  onSelect: () => void
  onStartRename: () => void
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onDelete: () => void
  canDelete: boolean
}

function DocRow({
  doc, active, renamingDocId, renameValue,
  onSelect, onStartRename, onRenameChange, onRenameCommit, onRenameCancel, onDelete, canDelete,
}: DocRowProps) {
  const isRenaming = renamingDocId === doc.id

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 10px',
        background: active ? '#ede9fe' : 'transparent',
        borderLeft: `2px solid ${active ? '#6366f1' : 'transparent'}`,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 11, color: active ? '#6366f1' : '#a1a1aa', flexShrink: 0 }}>
        {active ? '▶' : '○'}
      </span>
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onRenameCommit() }
            if (e.key === 'Escape') { e.preventDefault(); onRenameCancel() }
          }}
          style={{
            flex: 1, fontSize: 12, fontWeight: 600, color: '#18181b',
            border: 'none', borderBottom: '1px solid #6366f1',
            background: 'transparent', outline: 'none', padding: '0 2px',
          }}
        />
      ) : (
        <span
          onDoubleClick={e => { e.stopPropagation(); onStartRename() }}
          style={{
            flex: 1, fontSize: 12, fontWeight: active ? 600 : 400,
            color: active ? '#3730a3' : '#18181b',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {doc.title}
        </span>
      )}
      {active && !isRenaming && canDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Delete document"
          style={{
            background: 'none', border: 'none', color: '#dc2626',
            cursor: 'pointer', fontSize: 11, padding: '0 2px', flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
