// ═══════════════════════════════════════════════════════════════════════════
// Narrasmith Diagnostics Snapshot
//
// Observational runtime state pushed by GraphEditor and pulled by the panel.
// No business logic lives here — only data collection and pub/sub.
// ═══════════════════════════════════════════════════════════════════════════

import type { MismatchAlert } from './trace'

// ── Pipeline stage types ──────────────────────────────────────────────────

export type PipelineStageStatus = 'idle' | 'ok' | 'warn' | 'error'

export type PipelineStage = {
  name: string
  status: PipelineStageStatus
  meta?: Record<string, unknown>
  /** performance.now() when startStage() was called */
  startedAt?: number
  /** Wall-clock duration in milliseconds */
  duration?: number
  /** Node count at the start of this stage (for delta display) */
  nodeCountBefore?: number
  /** Node count at the end of this stage */
  nodeCountAfter?: number
  /** Mismatch alerts surfaced during this stage */
  alerts: MismatchAlert[]
}

// Canonical data-flow order.  Add new stages here to extend the architecture.
export const PIPELINE_STAGE_NAMES = [
  'Template',
  'World',
  'Pages',
  'Runtime Graph',
  'Store',
  'GraphEditor',
] as const

export type PipelineStageName = (typeof PIPELINE_STAGE_NAMES)[number]

// ── Main snapshot type ────────────────────────────────────────────────────

export type DiagnosticsSnapshot = {
  projectId: string | null
  projectName: string | null
  templateId: string | null
  nodes: unknown[]
  edges: unknown[]
  entitySchemaCount: number
  relSchemaCount: number
  conceptSchemaCount: number
  assetCount: number
  canvasImageCount: number
  pipeline: PipelineStage[]
  updatedAt: Date | null
}

// ── Internal state ────────────────────────────────────────────────────────

type SnapshotSubscriber = (snapshot: DiagnosticsSnapshot) => void

const subscribers = new Set<SnapshotSubscriber>()

// Global mismatch alert log (all alerts across all operations)
let _alerts: MismatchAlert[] = []
type AlertSubscriber = (alerts: readonly MismatchAlert[]) => void
const alertSubscribers = new Set<AlertSubscriber>()

let current: DiagnosticsSnapshot = {
  projectId: null,
  projectName: null,
  templateId: null,
  nodes: [],
  edges: [],
  entitySchemaCount: 0,
  relSchemaCount: 0,
  conceptSchemaCount: 0,
  assetCount: 0,
  canvasImageCount: 0,
  pipeline: PIPELINE_STAGE_NAMES.map(name => ({
    name,
    status: 'idle' as PipelineStageStatus,
    alerts: [],
  })),
  updatedAt: null,
}

function notify() {
  for (const fn of subscribers) fn(current)
}

// ── Public snapshot API ───────────────────────────────────────────────────

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  return current
}

export function updateDiagnosticsSnapshot(partial: Partial<DiagnosticsSnapshot>) {
  current = { ...current, ...partial, updatedAt: new Date() }
  notify()
}

export function subscribeToDiagnostics(fn: SnapshotSubscriber): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// ── Pipeline helpers ──────────────────────────────────────────────────────

export function updatePipelineStage(
  name: PipelineStageName,
  status: PipelineStageStatus,
  meta?: Record<string, unknown>,
) {
  const pipeline = current.pipeline.map(s =>
    s.name === name ? { ...s, status, ...(meta !== undefined ? { meta } : {}) } : s,
  )
  updateDiagnosticsSnapshot({ pipeline })
}

/**
 * Mark a stage as started — records `performance.now()` and optionally the
 * node count before this stage ran.
 */
export function startStage(name: PipelineStageName, nodeCountBefore?: number) {
  const pipeline = current.pipeline.map(s =>
    s.name === name
      ? {
          ...s,
          status: 'idle' as PipelineStageStatus,
          startedAt: performance.now(),
          ...(nodeCountBefore !== undefined ? { nodeCountBefore } : {}),
        }
      : s,
  )
  updateDiagnosticsSnapshot({ pipeline })
}

/**
 * Mark a stage as complete — calculates duration from `startedAt` and
 * attaches any mismatch alerts discovered during the stage.
 */
export function completeStage(
  name: PipelineStageName,
  status: PipelineStageStatus,
  opts: {
    meta?: Record<string, unknown>
    nodeCountAfter?: number
    alerts?: MismatchAlert[]
  } = {},
) {
  const pipeline = current.pipeline.map(s => {
    if (s.name !== name) return s
    const duration =
      s.startedAt !== undefined ? performance.now() - s.startedAt : undefined
    return {
      ...s,
      status,
      ...(opts.meta ? { meta: opts.meta } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(opts.nodeCountAfter !== undefined ? { nodeCountAfter: opts.nodeCountAfter } : {}),
      alerts: [...s.alerts, ...(opts.alerts ?? [])],
    }
  })
  updateDiagnosticsSnapshot({ pipeline })

  // Also push any alerts into the global store
  if (opts.alerts && opts.alerts.length > 0) {
    addMismatchAlerts(opts.alerts)
  }
}

/** Reset all pipeline stages to their initial idle state. */
export function resetPipeline() {
  updateDiagnosticsSnapshot({
    pipeline: PIPELINE_STAGE_NAMES.map(name => ({
      name,
      status: 'idle' as PipelineStageStatus,
      alerts: [],
    })),
  })
}

// ── Mismatch alert store ──────────────────────────────────────────────────

export function getMismatchAlerts(): readonly MismatchAlert[] {
  return _alerts
}

export function addMismatchAlerts(incoming: MismatchAlert[]) {
  if (incoming.length === 0) return
  _alerts = [..._alerts, ...incoming]
  // Keep at most 200 alerts
  if (_alerts.length > 200) _alerts = _alerts.slice(_alerts.length - 200)
  for (const fn of alertSubscribers) fn(_alerts)
}

export function clearMismatchAlerts() {
  _alerts = []
  for (const fn of alertSubscribers) fn(_alerts)
}

export function subscribeToAlerts(fn: AlertSubscriber): () => void {
  alertSubscribers.add(fn)
  return () => alertSubscribers.delete(fn)
}
