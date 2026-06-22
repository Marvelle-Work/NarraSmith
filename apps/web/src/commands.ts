export type CommandPayload = {
  'entity.create': { position: { x: number; y: number } }
  'entity.select': { id: string }
  'entity.delete': { id: string }
  'entity.toggle-root': { id: string }
  'asset.create': {}
  'asset.select': { id: string }
  'asset.toggle-pin': { id: string }
  'asset.delete': { id: string }
  'edge.select': { id: string }
  'edge.reverse': { id: string }
  'edge.delete': { id: string }
  'canvas-image.insert': { position: { x: number; y: number } }
  'canvas-image.select': { id: string }
  'canvas-image.delete': { id: string }
  'canvas-image.duplicate': { id: string }
  'canvas-image.toggle-lock': { id: string }
  'canvas-image.drag': { id: string }
  'ui.world-index': {}
  'ui.asset-index': {}
}

export type CommandId = keyof CommandPayload

export type CommandHandler<K extends CommandId = CommandId> = (payload: CommandPayload[K]) => void

export type CommandRegistry = {
  [K in CommandId]: CommandHandler<K>
}

export type CommandDef = {
  id: CommandId
  label: string
  color?: string
  dividerBefore?: boolean
}

export function createCommandExecutor(registry: CommandRegistry) {
  return function executeCommand<K extends CommandId>(id: K, payload: CommandPayload[K]) {
    const handler = registry[id] as CommandHandler<K>
    handler(payload)
  }
}
