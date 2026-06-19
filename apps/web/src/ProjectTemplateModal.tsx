import { PROJECT_TEMPLATES, type ProjectTemplate } from './templates'

type Props = {
  onSelect: (template: ProjectTemplate) => void
  onCancel: () => void
}

const ICONS: Record<string, string> = {
  'template-blank': '○',
  'template-story': '✎',
  'template-dnd':   '⚔',
  'template-rpg':   '✦',
}

export function ProjectTemplateModal({ onSelect, onCancel }: Props) {
  return (
    <div style={overlay} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={modal}>
        <h2 style={heading}>New Project</h2>
        <p style={subtitle}>Choose a template to get started.</p>

        <div style={grid}>
          {PROJECT_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              style={card}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 2px rgba(99,102,241,0.15)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e4e4e7'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              <span style={icon}>{ICONS[t.id] ?? '■'}</span>
              <span style={cardName}>{t.name}</span>
              <span style={cardDesc}>{t.description}</span>
              <div style={cardCounts}>
                <CountBadge label="Entity" count={t.entitySchema.length} />
                <CountBadge label="Rel" count={t.relSchema.length} />
                <CountBadge label="Concept" count={t.conceptSchema.length} />
                {t.graph.nodes.length > 0 && (
                  <CountBadge label="Starter" count={t.graph.nodes.length} accent />
                )}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function CountBadge({ label, count, accent }: { label: string; count: number; accent?: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '2px 7px', borderRadius: 4,
      background: accent ? '#ede9fe' : '#f4f4f5',
      color: accent ? '#6366f1' : '#71717a',
    }}>
      {count} {label}
    </span>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.4)',
}

const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '32px 36px',
  width: 560, maxHeight: '85vh', overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  fontFamily: 'system-ui, sans-serif',
}

const heading: React.CSSProperties = {
  margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#18181b',
}

const subtitle: React.CSSProperties = {
  margin: '0 0 20px', fontSize: 14, color: '#71717a',
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  padding: '16px 18px',
  background: '#fff',
  border: '1.5px solid #e4e4e7',
  borderRadius: 10,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const icon: React.CSSProperties = {
  fontSize: 22, marginBottom: 6,
  display: 'block', lineHeight: 1,
}

const cardName: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: '#18181b',
  marginBottom: 4,
}

const cardDesc: React.CSSProperties = {
  fontSize: 12, color: '#71717a', lineHeight: 1.4,
  marginBottom: 10,
}

const cardCounts: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 4,
  marginTop: 'auto',
}

const cancelBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6,
  border: '1px solid #d4d4d8', background: '#fff',
  color: '#52525b', fontWeight: 600, fontSize: 13,
  cursor: 'pointer',
}
