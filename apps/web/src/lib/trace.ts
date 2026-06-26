// ═══════════════════════════════════════════════════════════════════════════
// Narrasmith Trace
//
// A Trace wraps a named operation (e.g. CREATE_FROM_TEMPLATE).
// When activated it sets itself as the "current" trace so every logger call
// in that async flow inherits the trace ID without manual passing.
//
// Usage:
//   const t = new Trace('CREATE_FROM_TEMPLATE').activate()
//   try {
//     // All logger.*(…) calls here automatically carry t.id
//     t.logStage('info', 'WORLD_BUILD', 'World built', { nodeCount: 4 })
//   } finally {
//     t.deactivate()
//   }
// ═══════════════════════════════════════════════════════════════════════════

import { logger } from './logger'
import { setActiveTraceId } from './activeTrace'
import type { LogCategory } from './logger'

// ── Typed operation names ─────────────────────────────────────────────────

export type OperationType =
  | 'CREATE_FROM_TEMPLATE'
  | 'OPEN_PROJECT'
  | 'IMPORT_PROJECT'
  | 'MERGE_PROJECT'
  | 'CLOUD_SYNC'
  | 'EXPORT_PROJECT'

// ── Fine-grained pipeline stage keys ─────────────────────────────────────

export type PipelineStageKey =
  | 'TEMPLATE_LOAD'
  | 'TEMPLATE_NORMALIZE'
  | 'WORLD_BUILD'
  | 'STORE_INIT'
  | 'CLOUD_SYNC'
  | 'GRAPH_HYDRATE'
  | 'PAGE_LAYOUT_APPLY'

/** Maps each stage key to the coarse panel-stage name it belongs to. */
export const STAGE_KEY_TO_NAME: Record<PipelineStageKey, string> = {
  TEMPLATE_LOAD:      'Template',
  TEMPLATE_NORMALIZE: 'Template',
  WORLD_BUILD:        'World',
  STORE_INIT:         'Store',
  CLOUD_SYNC:         'Store',
  GRAPH_HYDRATE:      'Runtime Graph',
  PAGE_LAYOUT_APPLY:  'Pages',
}

const STAGE_KEY_TO_CATEGORY: Record<PipelineStageKey, LogCategory> = {
  TEMPLATE_LOAD:      'TEMPLATE',
  TEMPLATE_NORMALIZE: 'TEMPLATE',
  WORLD_BUILD:        'WORLD',
  STORE_INIT:         'STORE',
  CLOUD_SYNC:         'SYNC',
  GRAPH_HYDRATE:      'GRAPH',
  PAGE_LAYOUT_APPLY:  'PAGE',
}

// ── Structured stage context ──────────────────────────────────────────────

export type StageContext = {
  stage?: PipelineStageKey
  templateId?: string
  worldId?: string
  cloudId?: string
  nodeCount?: number
  schemaCounts?: { entity: number; rel: number; concept: number }
  graphSummary?: { circle: number; asset: number; image: number; rel: number; tether: number }
  [key: string]: unknown
}

// ── Mismatch alerts ──────────────────────────────────────────────────────

export type MismatchKind =
  | 'ZERO_NODES_AFTER_NORMALIZE'
  | 'CLOUD_ID_NOT_IN_STORE'
  | 'MISSING_ROOT_NODE'
  | 'SCHEMA_COUNT_MISMATCH'
  | 'TEMPLATE_NODE_COUNT_DROP'
  | 'REL_SCHEMA_ID_MISMATCH'

export type MismatchSeverity = 'warn' | 'error'

export type MismatchAlert = {
  id: string
  kind: MismatchKind
  severity: MismatchSeverity
  message: string
  detail: Record<string, unknown>
  traceId: string
  stageKey: PipelineStageKey
  timestamp: Date
}

let alertSeq = 0
function nextAlertId() { return `mm-${(++alertSeq).toString(36)}` }

// ── detectMismatches ──────────────────────────────────────────────────────

export type MismatchCheckInput = {
  templateNodeCount?: number
  currentNodeCount?: number
  templateEntitySchemaCount?: number
  currentEntitySchemaCount?: number
  cloudId?: string
  storeHasCloudId?: boolean
  rootNodeId?: string | null
  hasPages?: boolean
  templateRelSchemaIds?: string[]
  currentRelSchemaIds?: string[]
}

/**
 * Run all standard mismatch checks and return any alerts found.
 * Pass the results to `addMismatchAlerts()` from diagnostics.ts to surface them.
 */
export function detectMismatches(
  stageKey: PipelineStageKey,
  input: MismatchCheckInput,
  traceId: string,
): MismatchAlert[] {
  const alerts: MismatchAlert[] = []
  const ts = new Date()

  if (input.currentNodeCount === 0 && (input.templateNodeCount ?? 0) > 0) {
    alerts.push({
      id: nextAlertId(), kind: 'ZERO_NODES_AFTER_NORMALIZE', severity: 'error',
      message: `Graph has 0 nodes — template had ${input.templateNodeCount}`,
      detail: { templateNodeCount: input.templateNodeCount, stage: stageKey },
      traceId, stageKey, timestamp: ts,
    })
  }

  if (
    input.templateNodeCount !== undefined &&
    input.currentNodeCount !== undefined &&
    input.currentNodeCount > 0 &&
    input.currentNodeCount < input.templateNodeCount
  ) {
    alerts.push({
      id: nextAlertId(), kind: 'TEMPLATE_NODE_COUNT_DROP', severity: 'warn',
      message: `Node count dropped: ${input.templateNodeCount} → ${input.currentNodeCount} (−${input.templateNodeCount - input.currentNodeCount})`,
      detail: { before: input.templateNodeCount, after: input.currentNodeCount },
      traceId, stageKey, timestamp: ts,
    })
  }

  if (input.cloudId !== undefined && input.storeHasCloudId === false) {
    alerts.push({
      id: nextAlertId(), kind: 'CLOUD_ID_NOT_IN_STORE', severity: 'warn',
      message: `Cloud project "${input.cloudId}" not in local store — editor must fetch from API`,
      detail: { cloudId: input.cloudId },
      traceId, stageKey, timestamp: ts,
    })
  }

  if (
    input.templateEntitySchemaCount !== undefined &&
    input.currentEntitySchemaCount !== undefined &&
    input.currentEntitySchemaCount !== input.templateEntitySchemaCount
  ) {
    alerts.push({
      id: nextAlertId(), kind: 'SCHEMA_COUNT_MISMATCH', severity: 'warn',
      message: `Entity schema count: expected ${input.templateEntitySchemaCount}, got ${input.currentEntitySchemaCount}`,
      detail: { expected: input.templateEntitySchemaCount, actual: input.currentEntitySchemaCount },
      traceId, stageKey, timestamp: ts,
    })
  }

  if (input.hasPages && !input.rootNodeId) {
    alerts.push({
      id: nextAlertId(), kind: 'MISSING_ROOT_NODE', severity: 'warn',
      message: 'Pages exist but graph.rootNodeId is missing',
      detail: {},
      traceId, stageKey, timestamp: ts,
    })
  }

  if (input.templateRelSchemaIds && input.currentRelSchemaIds) {
    const missing = input.templateRelSchemaIds.filter(id => !input.currentRelSchemaIds!.includes(id))
    if (missing.length > 0) {
      alerts.push({
        id: nextAlertId(), kind: 'REL_SCHEMA_ID_MISMATCH', severity: 'warn',
        message: `${missing.length} relationship schema ID(s) from template are missing`,
        detail: { missingIds: missing },
        traceId, stageKey, timestamp: ts,
      })
    }
  }

  return alerts
}

// ── Replay snapshots ──────────────────────────────────────────────────────

export type ReplayData = {
  templateId?: string
  nodeCount: number
  edgeCount: number
  entitySchemaCount: number
  relSchemaCount: number
  conceptSchemaCount: number
  assetCount: number
  notes?: string
}

export type ReplaySnapshot = {
  traceId: string
  stageKey: PipelineStageKey
  stageName: string
  timestamp: Date
  data: ReplayData
}

// ── Trace registry (for replay panel) ────────────────────────────────────

const _registry: Trace[] = []
const MAX_TRACES = 20

export function getTraceRegistry(): readonly Trace[] { return _registry }

// ── Trace class ───────────────────────────────────────────────────────────

export class Trace {
  readonly id: string
  readonly operation: OperationType
  readonly startedAt: Date
  private _snapshots: ReplaySnapshot[] = []

  constructor(operation: OperationType) {
    this.operation = operation
    this.startedAt = new Date()
    this.id = `${operation.replace(/_/g, '-')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  }

  /**
   * Registers this trace as "active" — any logger call without an explicit
   * operationId will automatically inherit this trace's ID.
   * Returns `this` for chaining: `new Trace('OPEN_PROJECT').activate()`.
   */
  activate(): this {
    setActiveTraceId(this.id)
    if (!_registry.includes(this)) {
      _registry.push(this)
      if (_registry.length > MAX_TRACES) _registry.shift()
    }
    logger.debug('UI', `Trace activated: ${this.operation}`, { traceId: this.id }, this.id)
    return this
  }

  /** Clears the active trace slot. Always call in a `finally` block. */
  deactivate() {
    setActiveTraceId(undefined)
    logger.debug('UI', `Trace deactivated: ${this.operation}`, { traceId: this.id }, this.id)
  }

  // ── Stage-aware log helpers ──────────────────────────────────────────────

  /** Log with stage context — category is derived from the stage key. */
  logStage(
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error',
    stageKey: PipelineStageKey,
    message: string,
    ctx?: StageContext,
  ) {
    const category = STAGE_KEY_TO_CATEGORY[stageKey]
    const meta: StageContext = { stage: stageKey, ...ctx }
    logger[level](category, message, meta, this.id)
  }

  // ── Raw log helpers (same interface as the old Operation class) ──────────

  trace(category: LogCategory, message: string, meta?: unknown) { logger.trace(category, message, meta, this.id) }
  debug(category: LogCategory, message: string, meta?: unknown) { logger.debug(category, message, meta, this.id) }
  info(category: LogCategory,  message: string, meta?: unknown) { logger.info(category,  message, meta, this.id) }
  warn(category: LogCategory,  message: string, meta?: unknown) { logger.warn(category,  message, meta, this.id) }
  error(category: LogCategory, message: string, meta?: unknown) { logger.error(category, message, meta, this.id) }

  // ── Replay snapshots ─────────────────────────────────────────────────────

  /** Record the state at this stage for step-through replay in the panel. */
  snapshot(stageKey: PipelineStageKey, data: ReplayData) {
    this._snapshots.push({
      traceId: this.id,
      stageKey,
      stageName: STAGE_KEY_TO_NAME[stageKey],
      timestamp: new Date(),
      data,
    })
  }

  getSnapshots(): readonly ReplaySnapshot[] { return this._snapshots }
}
