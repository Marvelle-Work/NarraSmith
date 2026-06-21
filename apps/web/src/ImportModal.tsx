import { useRef, useState } from 'react'
import type { ProjectData } from './projectStore'
import {
  validateImportContent, buildContentPreview, buildMergePreview,
  type NarrasmithExport, type NarrasmithFragment,
  type ImportPreview, type MergePreview, type MergeReport,
} from './projectIO'

export type ImportAction =
  | { kind: 'new'; data: NarrasmithExport }
  | { kind: 'merge'; data: NarrasmithExport | NarrasmithFragment }

type Props = {
  currentProject: ProjectData
  onConfirm: (action: ImportAction) => MergeReport | null | Promise<MergeReport | null>
  onCancel: () => void
}

type ContentData =
  | { kind: 'project'; data: NarrasmithExport }
  | { kind: 'fragment'; data: NarrasmithFragment }

type Step =
  | { kind: 'input' }
  | { kind: 'mode'; content: ContentData; preview: ImportPreview }
  | { kind: 'merge-preview'; content: ContentData; mergePreview: MergePreview }
  | { kind: 'report'; report: MergeReport }

export function ImportModal({ currentProject, onConfirm, onCancel }: Props) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [step, setStep] = useState<Step>({ kind: 'input' })
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processRaw = (raw: string) => {
    setError(null)
    const result = validateImportContent(raw)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const content: ContentData = result.kind === 'project'
      ? { kind: 'project', data: result.data }
      : { kind: 'fragment', data: result.data }
    const preview = buildContentPreview(content.kind === 'project' ? content.data : content.data)
    setStep({ kind: 'mode', content, preview })
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => processRaw(reader.result as string)
    reader.readAsText(file)
    e.target.value = ''
  }

  const handlePaste = () => {
    if (!pasteText.trim()) {
      setError('Paste some JSON first.')
      return
    }
    processRaw(pasteText)
  }

  // ── Step: Merge report ─────────────────────────────────────────────────
  if (step.kind === 'report') {
    const r = step.report
    return (
      <div style={overlay} onClick={onCancel}>
        <div onClick={e => e.stopPropagation()} style={modal}>
          <h2 style={heading}>Import Complete</h2>

          <Section label="Added">
            <Row label="Nodes" value={String(r.nodesAdded)} accent="#16a34a" />
            <Row label="Relationships" value={String(r.edgesAdded)} accent="#16a34a" />
            <Row label="Entity Schemas" value={String(r.entitySchemasAdded)} accent="#16a34a" />
            <Row label="Relationship Schemas" value={String(r.relSchemasAdded)} accent="#16a34a" />
            <Row label="Concept Schemas" value={String(r.conceptSchemasAdded)} accent="#16a34a" />
          </Section>

          {(r.entitySchemasSkipped + r.relSchemasSkipped + r.conceptSchemasSkipped) > 0 && (
            <Section label="Skipped (already existed)">
              {r.entitySchemasSkipped > 0 && <Row label="Entity Schemas" value={String(r.entitySchemasSkipped)} accent="#a1a1aa" />}
              {r.relSchemasSkipped > 0 && <Row label="Relationship Schemas" value={String(r.relSchemasSkipped)} accent="#a1a1aa" />}
              {r.conceptSchemasSkipped > 0 && <Row label="Concept Schemas" value={String(r.conceptSchemasSkipped)} accent="#a1a1aa" />}
            </Section>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={onCancel} style={confirmBtn}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Merge preview ────────────────────────────────────────────────
  if (step.kind === 'merge-preview') {
    const mp = step.mergePreview
    return (
      <div style={overlay} onClick={onCancel}>
        <div onClick={e => e.stopPropagation()} style={modal}>
          <h2 style={heading}>Merge Preview</h2>
          <p style={subtitle}>These changes will be added to your current project.</p>

          <Section label="Will be added">
            <Row label="Nodes" value={`+${mp.nodesToAdd}`} accent="#16a34a" />
            <Row label="Relationships" value={`+${mp.edgesToAdd}`} accent="#16a34a" />
            <Row label="Entity Schemas" value={`+${mp.entitySchemasToAdd}`} accent="#16a34a" />
            <Row label="Relationship Schemas" value={`+${mp.relSchemasToAdd}`} accent="#16a34a" />
            <Row label="Concept Schemas" value={`+${mp.conceptSchemasToAdd}`} accent="#16a34a" />
          </Section>

          {(mp.entitySchemasToSkip + mp.relSchemasToSkip + mp.conceptSchemasToSkip) > 0 && (
            <Section label="Will be skipped (already exist)">
              {mp.entitySchemasToSkip > 0 && <Row label="Entity Schemas" value={String(mp.entitySchemasToSkip)} accent="#a1a1aa" />}
              {mp.relSchemasToSkip > 0 && <Row label="Relationship Schemas" value={String(mp.relSchemasToSkip)} accent="#a1a1aa" />}
              {mp.conceptSchemasToSkip > 0 && <Row label="Concept Schemas" value={String(mp.conceptSchemasToSkip)} accent="#a1a1aa" />}
            </Section>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={() => {
              const preview = buildContentPreview(step.content.data)
              setStep({ kind: 'mode', content: step.content, preview })
            }} style={cancelBtn}>Back</button>
            <button onClick={async () => {
              const report = await onConfirm({ kind: 'merge', data: step.content.data })
              if (report) setStep({ kind: 'report', report })
            }} style={mergeBtn}>Merge</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Mode choice (new project vs merge) ──────────────────────────
  if (step.kind === 'mode') {
    const p = step.preview
    const isFragment = step.content.kind === 'fragment'
    return (
      <div style={overlay} onClick={onCancel}>
        <div onClick={e => e.stopPropagation()} style={modal}>
          <h2 style={heading}>{isFragment ? 'Fragment Preview' : 'Import Preview'}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <Row label={isFragment ? 'Fragment' : 'Project Name'} value={p.projectName} />
            <Row label="Nodes" value={String(p.nodeCount)} />
            <Row label="Relationships" value={String(p.edgeCount)} />
            <Row label="Entity Schemas" value={String(p.entitySchemaCount)} />
            <Row label="Relationship Schemas" value={String(p.relationshipSchemaCount)} />
            <Row label="Concept Schemas" value={String(p.conceptSchemaCount)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {!isFragment && (
              <button onClick={() => {
                onConfirm({ kind: 'new', data: (step.content as { kind: 'project'; data: NarrasmithExport }).data })
              }} style={confirmBtn}>
                Import as New Project
              </button>
            )}
            <button onClick={() => {
              setStep({ kind: 'merge-preview', content: step.content, mergePreview: buildMergePreview(step.content.data, currentProject) })
            }} style={mergeBtn}>
              Merge Into Current Project
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => { setStep({ kind: 'input' }); setError(null) }} style={cancelBtn}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Input (file / paste) ─────────────────────────────────────────
  return (
    <div style={overlay} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={modal}>
        <h2 style={heading}>Import Content</h2>
        <p style={subtitle}>Import a project or fragment.</p>

        <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
          <button
            onClick={() => { setTab('file'); setError(null) }}
            style={{ ...tabBtn, ...(tab === 'file' ? tabActive : {}) }}
          >
            Upload File
          </button>
          <button
            onClick={() => { setTab('paste'); setError(null) }}
            style={{ ...tabBtn, ...(tab === 'paste' ? tabActive : {}) }}
          >
            Paste JSON
          </button>
        </div>

        {tab === 'file' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <button onClick={() => fileInputRef.current?.click()} style={fileBtn}>
              Choose .json file...
            </button>
          </div>
        )}

        {tab === 'paste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder='Paste Narrasmith JSON here...'
              style={textareaStyle}
            />
            <button onClick={handlePaste} style={confirmBtn}>
              Validate & Preview
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────────────────

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#52525b' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: accent ?? '#18181b' }}>{value}</span>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
        {label}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.4)',
}

const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '28px 32px',
  width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  fontFamily: 'system-ui, sans-serif',
}

const heading: React.CSSProperties = {
  margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#18181b',
}

const subtitle: React.CSSProperties = {
  margin: '0 0 16px', fontSize: 13, color: '#71717a',
}

const tabBtn: React.CSSProperties = {
  flex: 1, padding: '8px 0',
  border: '1px solid #d4d4d8', background: '#fafafa',
  color: '#71717a', fontWeight: 600, fontSize: 13, cursor: 'pointer',
}

const tabActive: React.CSSProperties = {
  background: '#18181b', color: '#fff', borderColor: '#18181b',
}

const fileBtn: React.CSSProperties = {
  padding: '12px 18px', borderRadius: 6,
  border: '2px dashed #d4d4d8', background: '#fafafa',
  color: '#52525b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  textAlign: 'center',
}

const textareaStyle: React.CSSProperties = {
  minHeight: 180, padding: '10px 12px',
  border: '1px solid #d4d4d8', borderRadius: 6,
  fontSize: 12, fontFamily: 'monospace', color: '#18181b', background: '#fafafa',
  resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box',
}

const cancelBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6,
  border: '1px solid #d4d4d8', background: '#fff',
  color: '#52525b', fontWeight: 600, fontSize: 13,
  cursor: 'pointer',
}

const confirmBtn: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 6,
  border: 'none', background: '#18181b',
  color: '#fff', fontWeight: 600, fontSize: 13,
  cursor: 'pointer',
}

const mergeBtn: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 6,
  border: 'none', background: '#6366f1',
  color: '#fff', fontWeight: 600, fontSize: 13,
  cursor: 'pointer',
}
