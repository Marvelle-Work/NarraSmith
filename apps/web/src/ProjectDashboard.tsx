import { useRef, useState } from 'react'
import { useAuth } from './auth/AuthProvider'
import { useCloudProjects, type CloudProject } from './hooks/useCloudProjects'
import { buildExportPayload, downloadExportJson } from './projectIO'
import { ImportModal, type ImportAction } from './ImportModal'
import { importProject, mergeIntoProject } from './projectIO'
import { loadProjectStore, saveProjectStore, getActiveProject, makeDefaultProject, createProjectFromTemplate } from './projectStore'
import type { ProjectStore } from './projectStore'
import { ExportModal } from './ExportModal'
import { ProjectTemplateModal } from './ProjectTemplateModal'
import type { ProjectTemplate } from './templates'
import * as api from './api/projects'

type Props = {
  onOpenProject: (projectId: string) => void
}

export function ProjectDashboard({ onOpenProject }: Props) {
  const { user, signOut } = useAuth()
  const cloud = useCloudProjects()
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exportPayload, setExportPayload] = useState<{ json: string; fileName: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [busy, setBusy] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const projects = cloud.projects
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return tb - ta
    })

  const handleCreate = () => {
    setShowTemplates(true)
  }

  const handleTemplateSelect = async (template: ProjectTemplate) => {
    setBusy(true)
    try {
      const meta = await api.createProject(template.name)
      const store = createProjectFromTemplate(
        { version: 1, activeProjectId: '', projects: {} },
        template,
      )
      const projectData = Object.values(store.projects)[0]
      await api.syncProjectData(
        meta.id,
        {
          graph: projectData.graph,
          entitySchema: projectData.entitySchema,
          relSchema: projectData.relSchema,
          conceptSchema: projectData.conceptSchema,
          assets: projectData.assets,
          canvasImages: projectData.canvasImages,
        },
        0,
      )
      setShowTemplates(false)
      onOpenProject(meta.id)
    } catch (err) {
      console.error('Failed to create project from template:', err)
    } finally {
      setBusy(false)
    }
  }

  const handleOpen = (id: string) => {
    onOpenProject(id)
  }

  const startRename = (p: CloudProject) => {
    setRenaming(p.id)
    setRenameValue(p.name)
    setMenuOpen(null)
    setTimeout(() => renameInputRef.current?.focus(), 0)
  }

  const confirmRename = async () => {
    if (!renaming || !renameValue.trim()) return
    try {
      await cloud.rename(renaming, renameValue.trim())
    } catch (err) {
      console.error('Rename failed:', err)
    }
    setRenaming(null)
  }

  const handleDuplicate = async (id: string) => {
    setMenuOpen(null)
    setBusy(true)
    try {
      await cloud.duplicate(id)
    } catch (err) {
      console.error('Duplicate failed:', err)
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async (id: string) => {
    setMenuOpen(null)
    try {
      const { projectData } = await api.getProjectData(id)
      if (!projectData) return
      const store: ProjectStore = {
        version: 1,
        activeProjectId: id,
        projects: { [id]: projectData },
      }
      setExportPayload(buildExportPayload(store, id))
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await cloud.remove(deleting)
    } catch (err) {
      console.error('Delete failed:', err)
    }
    setDeleting(null)
  }

  const handleImportAction = async (action: ImportAction) => {
    if (action.kind === 'new') {
      setBusy(true)
      setImportError(null)
      try {
        const result = await api.importProjectToCloud(action.data)
        await cloud.refresh()
        setShowImport(false)
        onOpenProject(result.projectId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Import failed. Please try again.'
        setImportError(msg)
        console.error('Import failed:', err)
      } finally {
        setBusy(false)
      }
      return null
    }

    const localStore = loadProjectStore()
    const currentProject = getActiveProject(localStore)
    const { report } = mergeIntoProject(action.data, currentProject)
    return report
  }

  const deletingProject = deleting ? projects.find(p => p.id === deleting) : null

  if (cloud.loading && projects.length === 0) {
    return (
      <div style={container}>
        <div style={inner}>
          <div style={header}>
            <div>
              <h1 style={title}>Narrasmith</h1>
              <p style={subtitle}>Loading projects...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={container}>
      <div style={inner}>
        {/* Header */}
        <div style={header}>
          <div>
            <h1 style={title}>Narrasmith</h1>
            <p style={subtitle}>
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              {user?.email && <span style={{ marginLeft: 8, color: '#a1a1aa' }}>{user.email}</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowImport(true)} style={secondaryBtn}>
              Import
            </button>
            <button onClick={handleCreate} disabled={busy} style={primaryBtn}>
              + New Project
            </button>
            <button onClick={signOut} style={secondaryBtn}>
              Sign Out
            </button>
          </div>
        </div>

        {cloud.error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{cloud.error}</span>
            <button onClick={cloud.refresh} style={{ ...secondaryBtn, padding: '4px 12px', fontSize: 12 }}>Retry</button>
          </div>
        )}

        {/* Search */}
        {projects.length > 3 && (
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
                  <span>Created {formatDate(p.created_at)}</span>
                  <span>Modified {formatDate(p.updated_at)}</span>
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

        {projects.length === 0 && !cloud.loading && !search && (
          <p style={{ textAlign: 'center', color: '#a1a1aa', marginTop: 40 }}>
            No projects yet. Create one to get started.
          </p>
        )}

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
          currentProject={makeDefaultProject()}
          onConfirm={handleImportAction}
          onCancel={() => { setShowImport(false); setImportError(null) }}
          importError={importError}
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
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
