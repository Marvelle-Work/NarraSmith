import { useState, useEffect, useRef, useMemo } from 'react'
import {
  logger,
  LOG_LEVELS,
  LOG_CATEGORIES,
  LEVEL_COLOR,
  type LogEntry,
  type LogLevel,
  type LogCategory,
  type TimingEntry,
} from './lib/logger'
import {
  getDiagnosticsSnapshot,
  subscribeToDiagnostics,
  getMismatchAlerts,
  subscribeToAlerts,
  clearMismatchAlerts,
  type DiagnosticsSnapshot,
  type PipelineStage,
  type PipelineStageStatus,
} from './lib/diagnostics'
import {
  getTraceRegistry,
  type MismatchAlert,
  type MismatchSeverity,
  type Trace,
} from './lib/trace'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type Tab = 'logs' | 'alerts' | 'project' | 'graph' | 'pipeline' | 'performance'

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_ICON: Record<PipelineStageStatus, string> = {
  idle: '○', ok: '✓', warn: '⚠', error: '✖',
}

const STATUS_COLOR: Record<PipelineStageStatus, string> = {
  idle: '#3f3f46', ok: '#34d399', warn: '#fbbf24', error: '#f87171',
}

const SEVERITY_COLOR: Record<MismatchSeverity, string> = {
  warn: '#fbbf24', error: '#f87171',
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function fmtTime(d: Date) { return d.toISOString().slice(11, 23) }
function fmtMs(ms: number) { return `${ms.toFixed(1)}ms` }
function fmtMeta(v: unknown) { try { return JSON.stringify(v, null, 2) } catch { return String(v) } }

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasMeta = entry.meta !== undefined
  return (
    <div
      style={{ borderBottom: '1px solid #1c1c1f', padding: '3px 8px', cursor: hasMeta ? 'pointer' : 'default', fontFamily: 'monospace', fontSize: 11, lineHeight: '16px' }}
      onClick={() => hasMeta && setExpanded(v => !v)}
    >
      <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', flexWrap: 'nowrap' }}>
        <span style={{ color: '#52525b', flexShrink: 0, width: 88 }}>{fmtTime(entry.timestamp)}</span>
        <span style={{ color: LEVEL_COLOR[entry.level], fontWeight: 700, flexShrink: 0, width: 38 }}>{entry.level.slice(0, 4)}</span>
        <span style={{ color: '#a78bfa', flexShrink: 0, width: 86, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>[{entry.category}]</span>
        {entry.operationId && (
          <span style={{ color: '#38bdf8', flexShrink: 0, fontStyle: 'italic' }}>‹{entry.operationId}›</span>
        )}
        <span style={{ color: '#d4d4d8', wordBreak: 'break-word', flexShrink: 1 }}>{entry.message}</span>
        {hasMeta && <span style={{ color: '#52525b', flexShrink: 0, marginLeft: 'auto', paddingLeft: 4 }}>{expanded ? '▲' : '▼'}</span>}
      </div>
      {expanded && hasMeta && (
        <pre style={{ margin: '2px 0 2px 216px', color: '#71717a', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '14px' }}>
          {fmtMeta(entry.meta)}
        </pre>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: MismatchAlert }) {
  const [expanded, setExpanded] = useState(false)
  const color = SEVERITY_COLOR[alert.severity]
  return (
    <div
      style={{ borderBottom: `1px solid ${color}22`, padding: '8px 12px', cursor: 'pointer', background: `${color}08` }}
      onClick={() => setExpanded(v => !v)}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color, fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
          {alert.severity === 'error' ? '✖' : '⚠'}
        </span>
        <span style={{ color, fontWeight: 700, fontSize: 11, flexShrink: 0, fontFamily: 'monospace' }}>
          {alert.kind}
        </span>
        <span style={{ color: '#d4d4d8', fontSize: 11, wordBreak: 'break-word' }}>{alert.message}</span>
        <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: 'auto', flexShrink: 0, fontFamily: 'monospace' }}>
          {fmtTime(alert.timestamp)}
        </span>
      </div>
      <div style={{ marginTop: 2, display: 'flex', gap: 6 }}>
        <span style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace' }}>
          ‹{alert.traceId}›
        </span>
        <span style={{ color: '#3f3f46', fontSize: 10, fontFamily: 'monospace' }}>
          {alert.stageKey}
        </span>
      </div>
      {expanded && (
        <pre style={{ margin: '6px 0 2px 22px', color: '#71717a', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '14px' }}>
          {fmtMeta(alert.detail)}
        </pre>
      )}
    </div>
  )
}

function PipelineStageRow({ stage }: { stage: PipelineStage }) {
  const [expanded, setExpanded] = useState(false)
  const color = STATUS_COLOR[stage.status]
  const hasAlerts = stage.alerts.length > 0
  const hasMeta = stage.meta || stage.duration !== undefined || stage.nodeCountBefore !== undefined
  const nodeDelta = stage.nodeCountBefore !== undefined && stage.nodeCountAfter !== undefined
    ? stage.nodeCountAfter - stage.nodeCountBefore
    : null

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px',
          background: '#0f0f11',
          borderRadius: 6,
          border: `1px solid ${color}33`,
          cursor: (hasMeta || hasAlerts) ? 'pointer' : 'default',
        }}
        onClick={() => (hasMeta || hasAlerts) && setExpanded(v => !v)}
      >
        <span style={{ fontSize: 15, fontWeight: 900, color, width: 18, textAlign: 'center', flexShrink: 0 }}>
          {STATUS_ICON[stage.status]}
        </span>
        <span style={{ color: '#e4e4e7', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{stage.name}</span>

        {/* Timing badge */}
        {stage.duration !== undefined && (
          <span style={{
            color: stage.duration > 2000 ? '#f87171' : stage.duration > 500 ? '#fbbf24' : '#52525b',
            fontSize: 10, fontFamily: 'monospace', flexShrink: 0,
          }}>
            {fmtMs(stage.duration)}
          </span>
        )}

        {/* Node delta badge */}
        {nodeDelta !== null && (
          <span style={{
            color: nodeDelta === 0 ? '#71717a' : nodeDelta > 0 ? '#34d399' : '#f87171',
            fontSize: 10, fontFamily: 'monospace', flexShrink: 0,
          }}>
            nodes: {stage.nodeCountBefore}→{stage.nodeCountAfter}
            {nodeDelta !== 0 && ` (${nodeDelta > 0 ? '+' : ''}${nodeDelta})`}
          </span>
        )}

        {/* Alert count badge */}
        {hasAlerts && (
          <span style={{
            background: stage.alerts.some(a => a.severity === 'error') ? '#f87171' : '#fbbf24',
            color: '#09090b',
            fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
            padding: '1px 5px', borderRadius: 3, flexShrink: 0,
          }}>
            {stage.alerts.length} alert{stage.alerts.length > 1 ? 's' : ''}
          </span>
        )}

        {/* Key meta inline */}
        {stage.status === 'idle' && (
          <span style={{ color: '#3f3f46', fontSize: 11, marginLeft: 'auto' }}>waiting</span>
        )}
        {stage.status !== 'idle' && stage.meta && !hasAlerts && (
          <span style={{ color: '#52525b', fontSize: 10, marginLeft: 'auto', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {Object.entries(stage.meta).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </span>
        )}
        {(hasMeta || hasAlerts) && (
          <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: hasAlerts ? 4 : 'auto', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 2, marginLeft: 18, padding: '6px 10px', background: '#0c0c0e', borderRadius: '0 0 6px 6px', border: '1px solid #1c1c1f', borderTop: 'none' }}>
          {stage.meta && (
            <pre style={{ margin: '0 0 4px', color: '#71717a', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '14px' }}>
              {fmtMeta(stage.meta)}
            </pre>
          )}
          {stage.alerts.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}
    </div>
  )
}

function ReplaySection() {
  const registry = getTraceRegistry()
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)

  const selectedTrace = useMemo(
    () => [...registry].reverse().find((t) => t.id === selectedTraceId),
    [registry, selectedTraceId],
  )
  const snapshots = selectedTrace?.getSnapshots() ?? []
  const step = snapshots[stepIdx]

  if (registry.length === 0) {
    return (
      <div style={{ color: '#3f3f46', padding: '10px 16px', fontSize: 11 }}>
        No traces recorded yet. Run an operation to see its replay here.
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ color: '#52525b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Replay
      </div>

      {/* Trace selector */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {[...registry].reverse().map(t => (
          <button
            key={t.id}
            onClick={() => { setSelectedTraceId(t.id); setStepIdx(0) }}
            style={{
              padding: '2px 7px',
              background: selectedTraceId === t.id ? '#1d4ed8' : '#18181b',
              border: `1px solid ${selectedTraceId === t.id ? '#3b82f6' : '#3f3f46'}`,
              borderRadius: 4,
              color: selectedTraceId === t.id ? '#e4e4e7' : '#71717a',
              fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
            }}
          >
            {t.operation.replace(/_/g, ' ')} · {t.id.slice(-6)}
          </button>
        ))}
      </div>

      {/* Step viewer */}
      {selectedTrace && snapshots.length === 0 && (
        <div style={{ color: '#52525b', fontSize: 11 }}>
          This trace has no recorded snapshots. Call <code>trace.snapshot()</code> in the operation flow.
        </div>
      )}
      {selectedTrace && snapshots.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
            <button
              disabled={stepIdx === 0}
              onClick={() => setStepIdx(v => Math.max(0, v - 1))}
              style={{ ...navBtnStyle, opacity: stepIdx === 0 ? 0.3 : 1 }}
            >
              ← Prev
            </button>
            <span style={{ color: '#71717a', fontSize: 11, fontFamily: 'monospace' }}>
              {stepIdx + 1} / {snapshots.length}
            </span>
            <button
              disabled={stepIdx === snapshots.length - 1}
              onClick={() => setStepIdx(v => Math.min(snapshots.length - 1, v + 1))}
              style={{ ...navBtnStyle, opacity: stepIdx === snapshots.length - 1 ? 0.3 : 1 }}
            >
              Next →
            </button>
          </div>
          {step && (
            <div style={{ background: '#0f0f11', border: '1px solid #27272a', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700 }}>{step.stageName}</span>
                <span style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace' }}>{step.stageKey}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                {[
                  ['Nodes', step.data.nodeCount],
                  ['Edges', step.data.edgeCount],
                  ['Entity schemas', step.data.entitySchemaCount],
                  ['Rel schemas', step.data.relSchemaCount],
                  ['Concept schemas', step.data.conceptSchemaCount],
                  ['Assets', step.data.assetCount],
                  ...(step.data.templateId ? [['Template', step.data.templateId]] : []),
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#71717a' }}>{k}</span>
                    <span style={{ color: '#e4e4e7', fontFamily: 'monospace' }}>{v}</span>
                  </div>
                ))}
              </div>
              {step.data.notes && (
                <div style={{ marginTop: 6, color: '#a1a1aa', fontSize: 10, fontStyle: 'italic' }}>{step.data.notes}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatRow({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 16px', borderBottom: '1px solid #1c1c1f' }}>
      <span style={{ color: '#71717a', fontSize: 12 }}>{label}</span>
      <span style={{ color: warn ? '#fbbf24' : '#e4e4e7', fontSize: 12, fontFamily: 'monospace', fontWeight: warn ? 700 : 400 }}>{value}</span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '5px 16px', background: '#0f0f11', color: '#52525b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {title}
    </div>
  )
}

function TimingRow({ entry }: { entry: TimingEntry }) {
  const barPct = Math.min(100, (entry.duration / 2000) * 100)
  const color = entry.duration > 500 ? '#f87171' : entry.duration > 100 ? '#fbbf24' : '#34d399'
  return (
    <div style={{ padding: '6px 16px', borderBottom: '1px solid #1c1c1f' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#d4d4d8', fontSize: 11, fontFamily: 'monospace' }}>{entry.label}</span>
        <span style={{ color, fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{fmtMs(entry.duration)}</span>
      </div>
      <div style={{ background: '#27272a', borderRadius: 2, height: 3 }}>
        <div style={{ background: color, width: `${barPct}%`, height: '100%', borderRadius: 2 }} />
      </div>
    </div>
  )
}

function StorePreview() {
  const [summary, setSummary] = useState<string>('Loading…')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('narrasmith-projects')
      if (!raw) { setSummary('(empty)'); return }
      const parsed = JSON.parse(raw)
      const projects = parsed.projects ?? {}
      setSummary(JSON.stringify({
        version: parsed.version,
        activeProjectId: parsed.activeProjectId,
        projectCount: Object.keys(projects).length,
        projects: Object.fromEntries(Object.entries(projects).map(([id, p]: [string, any]) => [id, {
          id: p.id, name: p.name,
          nodeCount: p.graph?.nodes?.length ?? 0,
          edgeCount: p.graph?.edges?.length ?? 0,
          entitySchemas: p.entitySchema?.length ?? 0,
          relSchemas: p.relSchema?.length ?? 0,
          assets: p.assets?.length ?? 0,
          updatedAt: p.updatedAt,
        }])),
      }, null, 2))
    } catch (e) { setSummary(`Error: ${e}`) }
  }, [])
  return (
    <pre style={{ margin: 0, padding: '10px 14px', color: '#71717a', fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '15px', background: '#0c0c0e' }}>
      {summary}
    </pre>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main panel
// ═══════════════════════════════════════════════════════════════════════════

export function DiagnosticsPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('logs')
  const [entries, setEntries] = useState<LogEntry[]>(() => [...logger.getBuffer()])
  const [timings, setTimings] = useState<TimingEntry[]>(() => [...logger.getTimingHistory()])
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot>(() => getDiagnosticsSnapshot())
  const [alerts, setAlerts] = useState<readonly MismatchAlert[]>(() => getMismatchAlerts())
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL')
  const [catFilter, setCatFilter] = useState<LogCategory | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => logger.subscribe(entry => {
    setEntries(prev => { const n = [...prev, entry]; return n.length > 1000 ? n.slice(n.length - 1000) : n })
    setTimings([...logger.getTimingHistory()])
  }), [])

  useEffect(() => subscribeToDiagnostics(s => setSnapshot({ ...s })), [])
  useEffect(() => subscribeToAlerts(a => setAlerts([...a])), [])

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault(); setOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  useEffect(() => {
    if (autoScroll && tab === 'logs' && logEndRef.current)
      logEndRef.current.scrollIntoView({ behavior: 'auto' })
  }, [entries, autoScroll, tab])

  const filtered = useMemo(() => {
    let r = entries
    if (levelFilter !== 'ALL') r = r.filter(e => e.level === levelFilter)
    if (catFilter !== 'ALL') r = r.filter(e => e.category === catFilter)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(e =>
        e.message.toLowerCase().includes(q) ||
        (e.operationId?.toLowerCase().includes(q) ?? false) ||
        e.category.toLowerCase().includes(q),
      )
    }
    return r
  }, [entries, levelFilter, catFilter, search])

  // Graph counts
  const circleCount = snapshot.nodes.filter((n: any) => n.type === 'circle').length
  const assetCount  = snapshot.nodes.filter((n: any) => n.type === 'asset').length
  const imgCount    = snapshot.nodes.filter((n: any) => n.type === 'canvas-image').length
  const relCount    = snapshot.edges.filter((e: any) => e.type === 'relationship').length
  const tetherCount = snapshot.edges.filter((e: any) => e.type === 'tether').length

  const errorAlerts = alerts.filter(a => a.severity === 'error')
  const warnAlerts  = alerts.filter(a => a.severity === 'warn')

  const TABS: { id: Tab; label: string; badge?: string; badgeColor?: string }[] = [
    { id: 'logs',        label: `Logs (${filtered.length})` },
    {
      id: 'alerts', label: 'Alerts',
      ...(alerts.length > 0
        ? { badge: String(alerts.length), badgeColor: errorAlerts.length > 0 ? '#f87171' : '#fbbf24' }
        : {}),
    },
    { id: 'project',     label: 'Project' },
    { id: 'graph',       label: 'Graph' },
    { id: 'pipeline',    label: 'Pipeline' },
    { id: 'performance', label: 'Perf' },
  ]

  if (!open) {
    return (
      <button
        title="Open Diagnostics Panel (Ctrl+Shift+D)"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 14, right: 14, zIndex: 9990,
          width: 28, height: 28, borderRadius: '50%',
          background: alerts.length > 0 ? '#3f1c1c' : '#18181b',
          border: `1px solid ${alerts.length > 0 ? '#f87171' : '#3f3f46'}`,
          color: alerts.length > 0 ? '#f87171' : '#52525b',
          fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', opacity: 0.85,
        }}
      >
        {alerts.length > 0 ? '⚠' : '⚙'}
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 0,
      width: 640, height: '62vh', minHeight: 320,
      background: '#09090b',
      border: '1px solid #27272a', borderRadius: '8px 0 0 0',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '-6px -6px 32px rgba(0,0,0,0.6)',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #27272a', flexShrink: 0, background: '#0c0c0e', borderRadius: '8px 0 0 0' }}>
        <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700, letterSpacing: '0.03em' }}>
          ⚙ NARRASMITH DIAGNOSTICS
        </span>
        {snapshot.updatedAt && (
          <span style={{ color: '#3f3f46', fontSize: 10, fontFamily: 'monospace' }}>
            {fmtTime(snapshot.updatedAt)}
          </span>
        )}
        {errorAlerts.length > 0 && (
          <span style={{ background: '#f87171', color: '#09090b', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3 }}>
            {errorAlerts.length} ERROR{errorAlerts.length > 1 ? 'S' : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#3f3f46', fontSize: 10 }}>Ctrl+Shift+D</span>
          <button onClick={() => { logger.clear(); setEntries([]) }} style={btnStyle} title="Clear logs">Clear logs</button>
          <button onClick={() => { clearMismatchAlerts(); setAlerts([]) }} style={btnStyle} title="Clear alerts">Clear alerts</button>
          <button onClick={() => setOpen(false)} style={btnStyle}>✕</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #27272a', flexShrink: 0, background: '#0c0c0e' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 12px', background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid #34d399' : '2px solid transparent',
              color: tab === t.id ? '#e4e4e7' : '#52525b',
              cursor: 'pointer', fontSize: 11, fontWeight: tab === t.id ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{ background: t.badgeColor, color: '#09090b', fontSize: 9, fontWeight: 900, padding: '0 4px', borderRadius: 3, lineHeight: '14px' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ── Logs ── */}
        {tab === 'logs' && (
          <>
            <div style={{ display: 'flex', gap: 6, padding: '6px 8px', borderBottom: '1px solid #27272a', background: '#0c0c0e', position: 'sticky', top: 0, zIndex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#e4e4e7', padding: '2px 6px', fontSize: 11, width: 110, outline: 'none' }}
              />
              <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as any)} style={selectStyle}>
                <option value="ALL">All Levels</option>
                {LOG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value as any)} style={selectStyle}>
                <option value="ALL">All Categories</option>
                {LOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#52525b', fontSize: 11, cursor: 'pointer' }}>
                <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ margin: 0, cursor: 'pointer' }} />
                Auto-scroll
              </label>
              <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: 'auto', fontFamily: 'monospace' }}>
                {filtered.length}/{entries.length}
              </span>
            </div>
            {filtered.length === 0
              ? <div style={{ color: '#3f3f46', padding: '20px 16px', fontSize: 12, textAlign: 'center' }}>{entries.length === 0 ? 'No logs yet' : 'No logs match filter'}</div>
              : filtered.map(e => <LogRow key={e.id} entry={e} />)
            }
            <div ref={logEndRef} style={{ height: 1 }} />
          </>
        )}

        {/* ── Alerts ── */}
        {tab === 'alerts' && (
          <>
            {alerts.length === 0 ? (
              <div style={{ color: '#3f3f46', padding: '24px 16px', fontSize: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                No mismatch alerts — all pipeline checks passed.
              </div>
            ) : (
              <>
                <div style={{ padding: '6px 12px', background: '#0c0c0e', borderBottom: '1px solid #27272a', display: 'flex', gap: 12 }}>
                  {errorAlerts.length > 0 && <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>✖ {errorAlerts.length} error{errorAlerts.length > 1 ? 's' : ''}</span>}
                  {warnAlerts.length > 0 && <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>⚠ {warnAlerts.length} warning{warnAlerts.length > 1 ? 's' : ''}</span>}
                </div>
                {[...alerts].reverse().map(a => <AlertCard key={a.id} alert={a} />)}
              </>
            )}
          </>
        )}

        {/* ── Project ── */}
        {tab === 'project' && (
          <>
            <SectionHeader title="Identity" />
            <StatRow label="Project ID" value={snapshot.projectId ?? '—'} />
            <StatRow label="Name" value={snapshot.projectName ?? '—'} />
            <StatRow label="Template" value={snapshot.templateId ?? '—'} />
            <StatRow label="Snapshot age" value={snapshot.updatedAt ? `${Math.round((Date.now() - snapshot.updatedAt.getTime()) / 1000)}s ago` : '—'} />
            <SectionHeader title="Schemas" />
            <StatRow label="Entity schemas" value={snapshot.entitySchemaCount} warn={snapshot.entitySchemaCount === 0} />
            <StatRow label="Relationship schemas" value={snapshot.relSchemaCount} warn={snapshot.relSchemaCount === 0} />
            <StatRow label="Concept schemas" value={snapshot.conceptSchemaCount} />
            <SectionHeader title="Assets" />
            <StatRow label="Assets" value={snapshot.assetCount} />
            <StatRow label="Canvas images" value={snapshot.canvasImageCount} />
            <SectionHeader title="localStorage store" />
            <StorePreview />
          </>
        )}

        {/* ── Graph ── */}
        {tab === 'graph' && (
          <>
            <SectionHeader title="Nodes" />
            <StatRow label="Total" value={snapshot.nodes.length} warn={snapshot.nodes.length === 0} />
            <StatRow label="Entity (circle)" value={circleCount} warn={circleCount === 0} />
            <StatRow label="Asset" value={assetCount} />
            <StatRow label="Canvas image" value={imgCount} />
            <SectionHeader title="Edges" />
            <StatRow label="Total" value={snapshot.edges.length} />
            <StatRow label="Relationship" value={relCount} />
            <StatRow label="Tether (derived)" value={tetherCount} />
          </>
        )}

        {/* ── Pipeline ── */}
        {tab === 'pipeline' && (
          <div>
            <div style={{ padding: '10px 12px 4px' }}>
              {snapshot.pipeline.map((stage, i) => (
                <div key={stage.name}>
                  <PipelineStageRow stage={stage} />
                  {i < snapshot.pipeline.length - 1 && (
                    <div style={{ textAlign: 'center', color: '#1c1c1f', fontSize: 18, lineHeight: '18px', margin: '1px 0', userSelect: 'none' }}>↓</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #1c1c1f', marginTop: 4 }}>
              <ReplaySection />
            </div>
          </div>
        )}

        {/* ── Performance ── */}
        {tab === 'performance' && (
          timings.length === 0
            ? <div style={{ color: '#3f3f46', padding: '20px 16px', fontSize: 12, textAlign: 'center' }}>No timings yet.</div>
            : [...timings].reverse().map((t, i) => <TimingRow key={i} entry={t} />)
        )}

      </div>

      {/* Footer */}
      <div style={{ padding: '3px 12px', borderTop: '1px solid #1c1c1f', color: '#3f3f46', fontSize: 10, flexShrink: 0, fontFamily: 'monospace' }}>
        window.narraLogger · .enable() · .setLevel(…) · .disable()
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared styles
// ═══════════════════════════════════════════════════════════════════════════

const btnStyle: React.CSSProperties = {
  padding: '2px 8px', background: '#18181b', border: '1px solid #27272a',
  borderRadius: 4, color: '#71717a', cursor: 'pointer', fontSize: 11,
}

const selectStyle: React.CSSProperties = {
  background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4,
  color: '#a1a1aa', padding: '2px 4px', fontSize: 11, outline: 'none',
}

const navBtnStyle: React.CSSProperties = {
  padding: '2px 8px', background: '#18181b', border: '1px solid #3f3f46',
  borderRadius: 4, color: '#a1a1aa', cursor: 'pointer', fontSize: 11,
}
