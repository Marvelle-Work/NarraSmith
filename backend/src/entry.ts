// ── Process-level crash handlers ─────────────────────────────────────────────
// Registered before anything else. Because this file has NO static imports,
// these handlers are guaranteed to run before any module initialization code.
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('💥 UNHANDLED REJECTION:', reason)
  process.exit(1)
})

console.log('🔥 BACKEND BOOT STARTED', {
  node: process.version,
  pid: process.pid,
  env: process.env['NODE_ENV'] ?? 'development',
  port: process.env['PORT'] ?? '3000',
})

// Dynamic import so startup errors are catchable here, not hidden by ESM hoisting
try {
  await import('./index.js')
} catch (err) {
  console.error('💥 STARTUP CRASH — failed to load index.js:', err)
  process.exit(1)
}
