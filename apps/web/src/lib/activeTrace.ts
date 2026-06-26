// ── Active trace slot ─────────────────────────────────────────────────────
// Tiny shared module so logger.ts and trace.ts can both read/write the
// currently active trace ID without a circular import.

let _id: string | undefined

export function setActiveTraceId(id: string | undefined) { _id = id }
export function getActiveTraceId(): string | undefined { return _id }
