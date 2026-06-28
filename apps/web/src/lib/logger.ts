// ═══════════════════════════════════════════════════════════════════════════
// Narrasmith Logger — centralized dev diagnostics
//
// Auto-enabled in Vite dev mode. Override at runtime:
//   window.narraLogger.enable()          — enable logging
//   window.narraLogger.setLevel('TRACE') — set minimum level
//   localStorage.setItem('narrasmith:debug', 'true')
// ═══════════════════════════════════════════════════════════════════════════

import { getActiveTraceId } from './activeTrace'

export const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

export const LOG_CATEGORIES = [
  'TEMPLATE', 'WORLD', 'PAGE', 'GRAPH',
  'STORE', 'IMPORT', 'EXPORT', 'SYNC',
  'DATABASE', 'API', 'UI', 'REACTFLOW',
  'RENDER', 'NETWORK', 'PERFORMANCE', 'INSPECTOR', 'NOTEBOOK',
] as const
export type LogCategory = (typeof LOG_CATEGORIES)[number]

export type LogEntry = {
  id: string
  timestamp: Date
  level: LogLevel
  category: LogCategory
  message: string
  meta?: unknown
  operationId?: string
}

export type TimingEntry = {
  label: string
  startedAt: number
  endedAt: number
  duration: number
}

export const LEVEL_COLOR: Record<LogLevel, string> = {
  TRACE: '#94a3b8',
  DEBUG: '#60a5fa',
  INFO:  '#34d399',
  WARN:  '#fbbf24',
  ERROR: '#f87171',
}

// ── Internal ─────────────────────────────────────────────────────────────

type Subscriber = (entry: LogEntry) => void

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4,
}

const BUFFER_SIZE = 1000
const TIMING_HISTORY_SIZE = 100

let seq = 0
function nextId() { return `log-${(++seq).toString(36)}` }

// ── Operation — scoped logger bound to a correlation ID ───────────────────

export class Operation {
  constructor(
    private readonly parent: NarraLogger,
    readonly id: string,
  ) {}

  trace(category: LogCategory, message: string, meta?: unknown) { this.parent.trace(category, message, meta, this.id) }
  debug(category: LogCategory, message: string, meta?: unknown) { this.parent.debug(category, message, meta, this.id) }
  info(category: LogCategory,  message: string, meta?: unknown) { this.parent.info(category,  message, meta, this.id) }
  warn(category: LogCategory,  message: string, meta?: unknown) { this.parent.warn(category,  message, meta, this.id) }
  error(category: LogCategory, message: string, meta?: unknown) { this.parent.error(category, message, meta, this.id) }
}

// ── NarraLogger ───────────────────────────────────────────────────────────

class NarraLogger {
  enabled: boolean
  minLevel: LogLevel

  private buffer: LogEntry[] = []
  private subscribers = new Set<Subscriber>()
  private pendingTimings = new Map<string, number>()
  private timingHistory: TimingEntry[] = []

  constructor() {
    const isDev = (() => { try { return (import.meta as any).env?.DEV === true } catch { return false } })()
    const stored = (() => { try { return localStorage.getItem('narrasmith:debug') } catch { return null } })()
    this.enabled = isDev || stored === 'true'
    this.minLevel = ((() => { try { return localStorage.getItem('narrasmith:minLevel') as LogLevel | null } catch { return null } })()) ?? 'DEBUG'
  }

  // ── Core ────────────────────────────────────────────────────────────────

  private shouldLog(level: LogLevel): boolean {
    return this.enabled && LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel]
  }

  private emit(entry: LogEntry) {
    if (this.buffer.length >= BUFFER_SIZE) this.buffer.shift()
    this.buffer.push(entry)
    for (const fn of this.subscribers) fn(entry)
    this.toConsole(entry)
  }

  private toConsole(entry: LogEntry) {
    const ts = entry.timestamp.toISOString().slice(11, 23)
    const op = entry.operationId ? ` ‹${entry.operationId}›` : ''
    const prefix = `[${ts}] ${entry.level} [${entry.category}]${op}`
    const args: unknown[] = entry.meta !== undefined
      ? [prefix, entry.message, entry.meta]
      : [prefix, entry.message]
    switch (entry.level) {
      case 'TRACE': case 'DEBUG': console.debug(...args); break
      case 'INFO':                console.info(...args);  break
      case 'WARN':                console.warn(...args);  break
      case 'ERROR':               console.error(...args); break
    }
  }

  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    meta?: unknown,
    operationId?: string,
  ) {
    if (!this.shouldLog(level)) return
    // If no explicit operationId, inherit from the currently active Trace
    const effectiveId = operationId ?? getActiveTraceId()
    this.emit({ id: nextId(), timestamp: new Date(), level, category, message, meta, operationId: effectiveId })
  }

  // ── Public logging methods ───────────────────────────────────────────────

  trace(category: LogCategory, message: string, meta?: unknown, operationId?: string) {
    this.log('TRACE', category, message, meta, operationId)
  }
  debug(category: LogCategory, message: string, meta?: unknown, operationId?: string) {
    this.log('DEBUG', category, message, meta, operationId)
  }
  info(category: LogCategory, message: string, meta?: unknown, operationId?: string) {
    this.log('INFO', category, message, meta, operationId)
  }
  warn(category: LogCategory, message: string, meta?: unknown, operationId?: string) {
    this.log('WARN', category, message, meta, operationId)
  }
  error(category: LogCategory, message: string, meta?: unknown, operationId?: string) {
    this.log('ERROR', category, message, meta, operationId)
  }

  // ── Correlation IDs ──────────────────────────────────────────────────────

  /** Start a named operation. All log calls on the returned object share a correlation ID. */
  operation(name: string): Operation {
    const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 12)
    const id = `${slug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    this.log('DEBUG', 'UI', `Operation started: ${name}`, undefined, id)
    return new Operation(this, id)
  }

  // ── Performance timing ───────────────────────────────────────────────────

  time(label: string) {
    this.pendingTimings.set(label, performance.now())
    this.log('TRACE', 'PERFORMANCE', `⏱ Start: ${label}`)
  }

  timeEnd(label: string): number | undefined {
    const start = this.pendingTimings.get(label)
    if (start === undefined) {
      this.log('WARN', 'PERFORMANCE', `timeEnd called for unknown label: "${label}"`)
      return undefined
    }
    const now = performance.now()
    const duration = now - start
    this.pendingTimings.delete(label)
    if (this.timingHistory.length >= TIMING_HISTORY_SIZE) this.timingHistory.shift()
    this.timingHistory.push({ label, startedAt: start, endedAt: now, duration })
    this.log('DEBUG', 'PERFORMANCE', `⏱ ${label}: ${duration.toFixed(2)}ms`, { duration })
    return duration
  }

  // ── Assertions ───────────────────────────────────────────────────────────

  /** Logs an error if `condition` is false. Throws in dev mode. */
  assert(condition: boolean, category: LogCategory, message: string, meta?: unknown) {
    if (condition) return
    this.log('ERROR', category, `ASSERTION FAILED: ${message}`, meta)
    const isDev = (() => { try { return (import.meta as any).env?.DEV === true } catch { return false } })()
    if (isDev) throw new Error(`[Narrasmith assert] [${category}] ${message}`)
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)
    return () => this.subscribers.delete(fn)
  }

  // ── Accessors ────────────────────────────────────────────────────────────

  getBuffer(): readonly LogEntry[] { return this.buffer }
  getTimingHistory(): readonly TimingEntry[] { return this.timingHistory }
  clear() { this.buffer = [] }

  // ── Runtime controls (also available via window.narraLogger) ─────────────

  enable() {
    this.enabled = true
    try { localStorage.setItem('narrasmith:debug', 'true') } catch {}
  }
  disable() {
    this.enabled = false
    try { localStorage.removeItem('narrasmith:debug') } catch {}
  }
  setLevel(level: LogLevel) {
    this.minLevel = level
    try { localStorage.setItem('narrasmith:minLevel', level) } catch {}
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const logger = new NarraLogger()

if (typeof window !== 'undefined') {
  (window as any).narraLogger = logger
}
