import { useRef, useState } from 'react'
import {
  type ProjectStore, type ProjectData,
  createProject, renameProject, duplicateProject, deleteProject,
  createProjectFromTemplate,
  saveProjectStore, setActiveProject,
} from './projectStore'
import { buildExportPayload, downloadExportJson } from './projectIO'
import { ImportModal, type ImportAction } from './ImportModal'
import { importProject, mergeIntoProject } from './projectIO'
import { getActiveProject } from './projectStore'
import { ExportModal } from './ExportModal'
import { ProjectTemplateModal } from './ProjectTemplateModal'
import type { ProjectTemplate } from './templates'

type Props = {
  store: ProjectStore
  onStoreChange: (store: ProjectStore) => void
  onOpenProject: (projectId: string) => void
}

export function ProjectDashboard({ store, onStoreChange, onOpenProject }: Props) {
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exportPayload, setExportPayload] = useState<{ json: string; fileName: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const projects = Object.values(store.projects)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const handleCreate = () => {
    setShowTemplates(true)
  }

  const handleTemplateSelect = (template: ProjectTemplate) => {
    const next = createProjectFromTemplate(store, template)
    saveProjectStore(next)
    onStoreChange(next)
    setShowTemplates(false)
    onOpenProject(next.activeProjectId)
  }

  const handleOpen = (id: string) => {
    const next = setActiveProject(store, id)
    onStoreChange(next)
    onOpenProject(id)
  }

  const startRename = (p: ProjectData) => {
    setRenaming(p.id)
    setRenameValue(p.name)
    setMenuOpen(null)
    setTimeout(() => renameInputRef.current?.focus(), 0)
  }

  const confirmRename = () => {
    if (!renaming || !renameValue.trim()) return
    const next = renameProject(store, renaming, renameValue.trim())
    saveProjectStore(next)
    onStoreChange(next)
    setRenaming(null)
  }

  const handleDuplicate = (id: string) => {
    const next = duplicateProject(store, id)
    saveProjectStore(next)
    onStoreChange(next)
    setMenuOpen(null)
  }

  const handleExport = (id: string) => {
    setExportPayload(buildExportPayload(store, id))
    setMenuOpen(null)
  }

  const confirmDelete = () => {
    if (!deleting) return
    const next = deleteProject(store, deleting)
    saveProjectStore(next)
    onStoreChange(next)
    setDeleting(null)
  }

  const handleImportAction = (action: ImportAction) => {
    if (action.kind === 'new') {
      const next = importProject(action.data, store)
      onStoreChange(next)
      setShowImport(false)
      return null
    }
    const currentProject = getActiveProject(store)
    const { project: merged, report } = mergeIntoProject(action.data, currentProject)
    const next: ProjectStore = {
      ...store,
      projects: { ...store.projects, [currentProject.id]: merged },
    }
    saveProjectStore(next)
    onStoreChange(next)
    return report
  }

  const deletingProject = deleting ? store.projects[deleting] : null

  return (
    <div style={container}>
      <div style={inner}>
        {/* Header */}
        <div style={header}>
          <div>
            <h1 style={title}>Narrasmith</h1>
            <p style={subtitle}>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowImport(true)} style={secondaryBtn}>
              Import
            </button>
            <button onClick={handleCreate} style={primaryBtn}>
              + New Project
            </button>
          </div>
        </div>

        {/* Search */}
        {Object.keys(store.projects).length > 3 && (
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            style={searchInput}
          />
        )}

        {/* Project grid */}
        <div style={grid}>
          {projects.map(p => (
            <div
              key={p.id}
              style={card}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#a1a1aa' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e4e4e7' }}
            >
              <div style={cardBody} onClick={() => handleOpen(p.id)}>
                {renaming === p.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={confirmRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmRename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    onClick={e => e.stopPropagation()}
                    style={renameInput}
                  />
                ) : (
                  <h3 style={cardTitle}>{p.name}</h3>
                )}
                <div style={cardMeta}>
                  <span>Created {formatDate(p.createdAt)}</span>
                  <span>Modified {formatDate(p.updatedAt)}</span>
                </div>
                <div style={cardStats}>
                  <span>{(p.graph.nodes?.length ?? 0)} entities</span>
                  <span style={{ color: '#d4d4d8' }}>&middot;</span>
                  <span>{(p.graph.edges?.length ?? 0)} connections</span>
                </div>
              </div>

              <div style={cardActions}>
                <button onClick={() => handleOpen(p.id)} style={openBtn}>
                  Open
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id) }}
                    style={moreBtn}
                  >
                    &hellip;
                  </button>
                  {menuOpen === p.id && (
                    <>
                      <div style={menuBackdrop} onClick={() => setMenuOpen(null)} />
                      <div style={menu}>
                        <button style={menuItem} onClick={() => startRename(p)}>Rename</button>
                        <button style={menuItem} onClick={() => handleDuplicate(p.id)}>Duplicate</button>
                        <button style={menuItem} onClick={() => handleExport(p.id)}>Export</button>
                        <button
                          style={{ ...menuItem, color: '#dc2626' }}
                          onClick={() => { setDeleting(p.id); setMenuOpen(null) }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && search && (
          <p style={{ textAlign: 'center', color: '#a1a1aa', marginTop: 40 }}>
            No projects match "{search}"
          </p>
        )}
      </div>

      {/* Delete confirmation */}
      {deleting && deletingProject && (
        <div style={overlay} onClick={() => setDeleting(null)}>
          <div onClick={e => e.stopPropagation()} style={modal}>
            <h2 style={modalHeading}>Delete "{deletingProject.name}"?</h2>
            <p style={modalText}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleting(null)} style={cancelBtn}>Cancel</button>
              <button onClick={confirmDelete} style={deleteBtn}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <ProjectTemplateModal
          onSelect={handleTemplateSelect}
          onCancel={() => setShowTemplates(false)}
        />
      )}

      {showImport && (
        <ImportModal
          currentProject={getActiveProject(store)}
          onConfirm={handleImportAction}
          onCancel={() => setShowImport(false)}
        />
      )}

      {exportPayload && (
        <ExportModal
          json={exportPayload.json}
          fileName={exportPayload.fileName}
          onDownload={() => downloadExportJson(exportPayload.json, exportPayload.fileName)}
          onClose={() => setExportPayload(null)}
        />
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  } catch {
    return ''
  }
}

// ── Styles ──────────────────────────────────────────────────────────────

const container: React.CSSProperties = {
  width: '100vw', height: '100vh',
  background: '#fafafa',
  fontFamily: 'system-ui, sans-serif',
  overflowY: 'auto',
}

const inner: React.CSSProperties = {
  maxWidth: 820, margin: '0 auto',
  padding: '48px 24px',
}

const header: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  marginBottom: 32,
}

const title: React.CSSProperties = {
  margin: 0, fontSize: 26, fontWeight: 800, color: '#18181b',
  letterSpacing: -0.5,
}

const subtitle: React.CSSProperties = {
  margin: '4px 0 0', fontSize: 14, color: '#71717a',
}

const searchInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px', marginBottom: 24,
  border: '1px solid #e4e4e7', borderRadius: 8,
  fontSize: 14, color: '#18181b', background: '#fff',
  outline: 'none',
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 16,
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e4e7',
  borderRadius: 10,
  display: 'flex', flexDirection: 'column',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  cursor: 'default',
}

const cardBody: React.CSSProperties = {
  padding: '18px 18px 12px',
  cursor: 'pointer',
  flex: 1,
}

const cardTitle: React.CSSProperties = {
  margin: 0, fontSize: 16, fontWeight: 700, color: '#18181b',
  lineHeight: 1.3,
}

const cardMeta: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  marginTop: 10, fontSize: 12, color: '#a1a1aa',
}

const cardStats: React.CSSProperties = {
  display: 'flex', gap: 6,
  marginTop: 8, fontSize: 12, color: '#71717a',
}

const cardActions: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '0 18px 14px',
}

const openBtn: React.CSSProperties = {
  padding: '6px 16px', borderRadius: 6,
  border: 'none', background: '#18181b', color: '#fff',
  fontWeight: 600, fontSize: 12, cursor: 'pointer',
}

const moreBtn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6,
  border: '1px solid #e4e4e7', background: '#fff', color: '#71717a',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
  lineHeight: 1,
}

const menuBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
}

const menu: React.CSSProperties = {
  position: 'absolute', bottom: '100%', right: 0, zIndex: 51,
  background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  padding: '4px 0', minWidth: 140,
}

const menuItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 14px', border: 'none', background: 'none',
  fontSize: 13, fontWeight: 500, color: '#18181b',
  cursor: 'pointer',
}

const renameInput: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #6366f1', borderRadius: 6,
  fontSize: 16, fontWeight: 700, color: '#18181b',
  width: '100%', boxSizing: 'border-box', outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8,
  border: 'none', background: '#18181b', color: '#fff',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8,
  border: '1px solid #d4d4d8', background: '#fff', color: '#52525b',
  fontWeight: 600, fontSize: 14, cursor: 'pointer',
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.4)',
}

const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '28px 32px',
  width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  fontFamily: 'system-ui, sans-serif',
}

const modalHeading: React.CSSProperties = {
  margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#18181b',
}

const modalText: React.CSSProperties = {
  margin: '0 0 20px', fontSize: 14, color: '#71717a',
}

const cancelBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6,
  border: '1px solid #d4d4d8', background: '#fff',
  color: '#52525b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
}

const deleteBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6,
  border: 'none', background: '#dc2626', color: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
}
