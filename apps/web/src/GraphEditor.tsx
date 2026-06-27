import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Edge,
  type EdgeMarker,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CircleNode } from './CircleNode'
import { RelationshipEdge } from './RelationshipEdge'
import { RelationshipModal } from './RelationshipModal'
import { SchemaEditorPanel } from './SchemaEditorPanel'
import { RelationshipSchemaEditorPanel } from './RelationshipSchemaEditorPanel'
import { ColorPicker } from './ColorPicker'
import { entityColors, edgeStyleForLabel, SIZE_LEVELS, type FieldBlock, type GraphNode, type NodeData, type SizeLevel, type RelationshipDirection } from './types'
import { resolveFields, type SchemaType, type ResolvedField } from './schema'
import { FieldBlockEditor } from './FieldBlockEditor'
import { resolveRelationshipType, type RelationshipType } from './relationshipSchema'
import { DEFAULT_CONCEPT_SCHEMAS, type ConceptSchemaType } from './conceptSchema'
import { ConceptObjectEditor } from './ConceptObjectEditor'
import { ConceptSchemaEditorPanel } from './ConceptSchemaEditorPanel'
import { WorldIndexPanel } from './WorldIndexPanel'
import { AssetNode } from './AssetNode'
import { AssetEditor } from './AssetEditor'
import { AssetIndexPanel } from './AssetIndexPanel'
import { ContextMenu, getMenuItems, type ContextMenuTarget } from './ContextMenu'
import { createCommandExecutor, type CommandRegistry, type CommandId, type CommandPayload } from './commands'
import { PlayButton } from './PlayButton'
import { TetherEdge } from './TetherEdge'
import { CanvasImageNode } from './CanvasImageNode'
import type { AssetData, AssetNodeData, CanvasImage, CanvasImageNodeData } from './types'
import { isUrl } from './types'
import {
  loadProjectStore, saveProjectStore, getActiveProject,
  type ProjectStore,
} from './projectStore'
import {
  buildExportPayload, downloadExportJson, importProject, mergeIntoProject,
} from './projectIO'
import { ImportModal, type ImportAction } from './ImportModal'
import { ExportModal } from './ExportModal'
import { useAutoSave } from './hooks/useAutoSave'
import { getProjectData, updateProject } from './api/projects'
import { logger } from './lib/logger'
import { updateDiagnosticsSnapshot, startStage, completeStage, addMismatchAlerts } from './lib/diagnostics'
import { Trace, detectMismatches } from './lib/trace'

const nodeTypes = { circle: CircleNode, asset: AssetNode, 'canvas-image': CanvasImageNode }
const edgeTypes = { relationship: RelationshipEdge, tether: TetherEdge }

const UI_MODE_KEY = 'narrasmith-ui-mode'
type UIMode = 'story' | 'system'

// ── Default demo graph shown to new users ───────────────────────────────

const DEFAULT_GRAPH: { nodes: GraphNode[]; edges: Edge[] } = {
  nodes: [
    { id: '1', type: 'circle', position: { x: 100, y: 200 }, data: { label: 'Character 1', entityType: 'Character', typeId: 'schema-character', fields: {}, description: '', sizeLevel: 3 } },
    { id: '2', type: 'circle', position: { x: 400, y: 200 }, data: { label: 'Character 2', entityType: 'Character', typeId: 'schema-character', fields: {}, description: '', sizeLevel: 3 } },
    { id: '3', type: 'circle', position: { x: 250, y: 450 }, data: { label: 'Location', entityType: 'Location', typeId: 'schema-location', fields: {}, description: '', sizeLevel: 3 } },
  ],
  edges: [],
}

// ── Graph normalization (forward-migrations on raw stored data) ──────────

function normalizeGraph(
  raw: { nodes: any[]; edges: any[]; rootNodeId?: string },
  opts: { showDefault?: boolean } = {},
): { nodes: GraphNode[]; edges: Edge[] } {
  if (!raw.nodes || raw.nodes.length === 0) {
    return opts.showDefault !== false ? DEFAULT_GRAPH : { nodes: [], edges: [] }
  }
  const rootId = raw.rootNodeId
  const nodes: GraphNode[] = raw.nodes
    .filter((n: any) => {
      if (n.type !== 'circle' && n.type !== 'asset' && n.type !== 'canvas-image') {
        logger.warn('GRAPH', `Unknown node type "${n.type}" on node "${n.id ?? '(no id)'}" — treating as entity node`)
      }
      return n.type !== 'asset' && n.type !== 'canvas-image'
    })
    .map((n: any, i: number) => ({
      ...n,
      type: 'circle',
      position: n.position ?? { x: 100 + (i % 5) * 200, y: 100 + Math.floor(i / 5) * 200 },
      data: {
        label:           n.data.label ?? 'Untitled',
        entityType:      n.data.entityType ?? n.data.category ?? 'Character',
        typeId:          n.data.typeId,
        fields:          n.data.fields ?? {},
        description:     n.data.description ?? '',
        color:           n.data.color,
        sizeLevel:       (n.data.sizeLevel as SizeLevel | undefined) ?? 3,
        concepts:        n.data.concepts,
        isRoot:          n.id === rootId || undefined,
        profileImageUrl: n.data.profileImageUrl,
        labelColor:      n.data.labelColor,
        rootGlowColor:   n.data.rootGlowColor,
      } satisfies NodeData,
    }))
  const assetNodes = raw.nodes
    .filter((n: any) => n.type === 'asset')
    .map((n: any) => ({
      ...n,
      type: 'asset',
      position: n.position ?? { x: 200, y: 200 },
      data: n.data,
    }))
  const canvasImageNodes = raw.nodes
    .filter((n: any) => n.type === 'canvas-image')
    .map((n: any) => ({
      ...n,
      type: 'canvas-image',
      position: n.position ?? { x: 0, y: 0 },
      draggable: false,
      selectable: true,
      zIndex: (n.data?.zIndex ?? 0) - 1000,
      data: n.data,
    }))
  const edges: Edge[] = raw.edges
    .filter((e: any) => e.type !== 'tether')
    .map((e: any) => {
      const built: Edge = {
        ...e,
        type: 'relationship',
        data: {
          labelT:             e.data?.labelT ?? 0.5,
          color:              e.data?.color,
          schemaColor:        e.data?.schemaColor,
          relationshipTypeId: e.data?.relationshipTypeId,
          description:        e.data?.description,
          whyItMatters:       e.data?.whyItMatters,
          direction:          (e.data?.direction ?? 'undirected') as RelationshipDirection,
        },
      }
      return applyDirectionMarkers(built)
    })
  const tetherEdges: Edge[] = raw.edges
    .filter((e: any) => e.type === 'tether')
    .map((e: any) => ({ ...e, type: 'tether' }))
  return { nodes: [...canvasImageNodes, ...nodes, ...assetNodes] as any, edges: [...edges, ...tetherEdges] }
}

// ── Edge style resolution ────────────────────────────────────────────────

function resolveEdgeStyle(
  label: string,
  typeId: string | undefined,
  relTypes: RelationshipType[],
  manualColor: string | undefined,
): { style: React.CSSProperties; schemaColor: string | undefined } {
  if (manualColor) return { style: { stroke: manualColor, strokeWidth: 2 }, schemaColor: undefined }
  const resolved = typeId ? resolveRelationshipType(typeId, relTypes) : null
  const schemaColor = resolved?.defaultColor
  if (schemaColor) return { style: { stroke: schemaColor, strokeWidth: 2 }, schemaColor }
  return { style: edgeStyleForLabel(label).style, schemaColor: undefined }
}

// ── Direction markers ─────────────────────────────────────────────────────

function applyDirectionMarkers(edge: Edge): Edge {
  const direction = (edge.data?.direction as RelationshipDirection | undefined) ?? 'undirected'
  // Strip any existing markers, then re-apply based on direction.
  // We mutate a shallow copy — never the original edge object.
  const next = { ...edge } as Edge & { markerEnd?: EdgeMarker | string; markerStart?: EdgeMarker | string }
  delete next.markerEnd
  delete next.markerStart
  if (direction === 'undirected') return next
  const manualColor  = edge.data?.color        as string | undefined
  const schemaColor  = edge.data?.schemaColor  as string | undefined
  const styleStroke  = (edge.style as React.CSSProperties | undefined)?.stroke as string | undefined
  const color = manualColor ?? schemaColor ?? styleStroke ?? '#a1a1aa'
  const marker: EdgeMarker = { type: MarkerType.ArrowClosed, color, width: 20, height: 20 }
  if (direction === 'directed-reversed') {
    next.markerStart = marker
  } else {
    next.markerEnd = marker
    if (direction === 'bidirectional') next.markerStart = marker
  }
  return next
}

// ── Component ────────────────────────────────────────────────────────────

type GraphEditorProps = {
  projectId: string
  onBackToDashboard: () => void
}

export function GraphEditor({ projectId, onBackToDashboard }: GraphEditorProps) {
  const { screenToFlowPosition } = useReactFlow()

  // ── Project store (Phase 2) — ref so it never drives re-renders ─────────
  const storeRef = useRef<ProjectStore>(loadProjectStore())
  storeRef.current = { ...storeRef.current, activeProjectId: projectId }
  const activeProject = getActiveProject(storeRef.current)
  // True only when the project is already present in the local store under
  // the exact projectId.  Cloud-created projects arrive with a UUID that
  // doesn't exist locally yet, so getActiveProject() falls back to the
  // first stored project — which we must NOT use as initial state.
  const isKnownLocally = !!storeRef.current.projects[projectId]

  // ── Initialize state from active project ─────────────────────────────
  // If the project isn't in local store (e.g. freshly cloud-created from a
  // template), start with empty state so the cloud load can populate it
  // without fighting a stale "fallback" project's data.
  const initial = useMemo(
    () => isKnownLocally ? normalizeGraph(activeProject.graph as any) : { nodes: [], edges: [] },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [schemaTypes, setSchemaTypes] = useState<SchemaType[]>(
    () => isKnownLocally ? activeProject.entitySchema : [],
  )
  const [relTypes, setRelTypes] = useState<RelationshipType[]>(
    () => isKnownLocally ? activeProject.relSchema : [],
  )
  const [conceptSchema, setConceptSchema] = useState<ConceptSchemaType[]>(
    () => isKnownLocally ? (activeProject.conceptSchema ?? DEFAULT_CONCEPT_SCHEMAS) : DEFAULT_CONCEPT_SCHEMAS,
  )
  const [assets, setAssets] = useState<AssetData[]>(
    () => isKnownLocally ? (activeProject.assets ?? []) : [],
  )
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>(
    () => isKnownLocally ? (activeProject.canvasImages ?? []) : [],
  )
  const [rootNodeId, setRootNodeId] = useState<string | null>(
    () => isKnownLocally ? ((activeProject.graph as any).rootNodeId ?? null) : null,
  )

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const saved = localStorage.getItem('narrasmith.inspector.width')
    return saved ? parseInt(saved, 10) : 420
  })
  const isDraggingInspector = useRef(false)

  const schemaRef   = useRef(schemaTypes)
  const relTypesRef = useRef(relTypes)
  useEffect(() => { schemaRef.current   = schemaTypes }, [schemaTypes])
  useEffect(() => { relTypesRef.current = relTypes    }, [relTypes])

  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, isRoot: n.id === rootNodeId || undefined },
    })))
  }, [rootNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cloud autosave ────────────────────────────────────────────────────
  const { save: autoSave, setVersion } = useAutoSave(projectId)
  const cloudLoadedRef = useRef(false)

  // ── Cloud load — fetch and apply cloud state (cloud is authoritative) ───
  // v2 architecture: cloud is the single source of truth on editor entry.
  // Local cache is a write-through cache populated AFTER cloud loads, never
  // a conflict-resolution peer. Timestamp comparison has been removed because:
  //   1. The persistence effect writes stale data with updatedAt=NOW before
  //      the async fetch resolves, making any local entry appear "newer".
  //   2. React StrictMode double-invokes effects, compounding the race.
  //   3. Architecturally: autoSave always syncs local→cloud, so if a cloud
  //      fetch succeeds the cloud data is authoritative by definition.
  // Fallback: if cloud fetch fails, local cache is used as-is.
  useEffect(() => {
    let cancelled = false
    // Keep reference for diagnostic logging only — not used for hydration decisions.
    const localProjectForDiagnostics = storeRef.current.projects[projectId]
    const trace = new Trace('OPEN_PROJECT').activate()
    const localNodeCountBefore = (localProjectForDiagnostics?.graph as any)?.nodes?.length ?? 0

    logger.debug('GRAPH', 'Cloud load starting', { projectId })
    startStage('Runtime Graph', localNodeCountBefore)
    logger.time(`CLOUD_LOAD_${projectId}`)

    getProjectData(projectId)
      .then(({ projectData: cloudData, version }) => {
        if (cancelled) return
        logger.timeEnd(`CLOUD_LOAD_${projectId}`)

        if (cloudData) {
          setVersion(version)
          const cloudRawNodeCount = (cloudData.graph as any)?.nodes?.length ?? 0

          logger.info('GRAPH', 'Cloud data received — applying (cloud is authoritative)', {
            projectId,
            cloudUpdatedAt: cloudData.updatedAt,
            localUpdatedAt: localProjectForDiagnostics?.updatedAt ?? '(no local entry)',
            cloudNodeCount: cloudRawNodeCount,
            localNodeCount: (localProjectForDiagnostics?.graph as any)?.nodes?.length ?? 0,
            cloudEntitySchemas: cloudData.entitySchema?.length ?? 0,
          })

          const normalized = normalizeGraph(cloudData.graph as any, { showDefault: false })
          setNodes(normalized.nodes)
          setEdges(normalized.edges)
          setSchemaTypes(cloudData.entitySchema)
          setRelTypes(cloudData.relSchema)
          setConceptSchema(cloudData.conceptSchema ?? [])
          setAssets(cloudData.assets ?? [])
          setCanvasImages(cloudData.canvasImages ?? [])
          setProjectName(cloudData.name)
          setRootNodeId((cloudData.graph as any).rootNodeId ?? null)
          storeRef.current.projects[projectId] = cloudData
          saveProjectStore(storeRef.current)

          const graphAlerts = detectMismatches('GRAPH_HYDRATE', {
            templateNodeCount: cloudRawNodeCount,
            currentNodeCount: normalized.nodes.filter((n: any) => n.type === 'circle').length,
            cloudId: projectId,
            storeHasCloudId: true,
            rootNodeId: (cloudData.graph as any).rootNodeId ?? null,
            hasPages: false,
          }, trace.id)
          addMismatchAlerts(graphAlerts)

          const finalStatus = normalized.nodes.length === 0
            ? 'warn'
            : graphAlerts.some(a => a.severity === 'error') ? 'error'
            : graphAlerts.length > 0 ? 'warn' : 'ok'

          completeStage('Runtime Graph', finalStatus, {
            meta: { source: 'cloud', nodeCount: normalized.nodes.length, edgeCount: normalized.edges.length },
            nodeCountAfter: normalized.nodes.length,
            alerts: graphAlerts,
          })

          logger.info('GRAPH', 'Applied cloud state to editor', {
            nodes: normalized.nodes.length,
            edges: normalized.edges.length,
            entitySchemas: cloudData.entitySchema?.length ?? 0,
          })

          logger.assert(
            normalized.nodes.length > 0 || cloudRawNodeCount === 0,
            'GRAPH',
            'Cloud had nodes but normalizeGraph produced 0 — data may be lost',
            { rawNodeCount: cloudRawNodeCount },
          )
        } else {
          // Cloud returned no data — fall back to whatever is in local cache
          logger.warn('GRAPH', 'Cloud returned no data — using local state as fallback', { projectId })
          completeStage('Runtime Graph', 'warn', { meta: { reason: 'no cloud data, using local fallback' } })
        }
        cloudLoadedRef.current = true
      })
      .catch(err => {
        if (!cancelled) {
          logger.timeEnd(`CLOUD_LOAD_${projectId}`)
          logger.warn('NETWORK', 'Cloud load failed — using local cache', { err: String(err) })
          completeStage('Runtime Graph', 'warn', { meta: { reason: 'cloud load failed, using local fallback' } })
          cloudLoadedRef.current = true
        }
      })
    return () => {
      cancelled = true
      trace.deactivate()
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI state ──────────────────────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [pendingConn, setPendingConn]       = useState<Connection | null>(null)
  const [showSchema, setShowSchema]               = useState(false)
  const [showRelSchema, setShowRelSchema]         = useState(false)
  const [showConceptSchema, setShowConceptSchema] = useState(false)
  const [showIndex, setShowIndex]                 = useState(false)
  const [showImport, setShowImport]                = useState(false)
  const [exportPayload, setExportPayload]         = useState<{ json: string; fileName: string } | null>(null)
  const [showProjectMenu, setShowProjectMenu]     = useState(false)
  const [showHamburger, setShowHamburger]          = useState(false)
  const [showNewAsset, setShowNewAsset]             = useState(false)
  const [showAssetIndex, setShowAssetIndex]         = useState(false)
  const [projectName, setProjectName]             = useState(() => activeProject.name)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null)

  const [mode, setMode] = useState<UIMode>(
    () => (localStorage.getItem(UI_MODE_KEY) as UIMode | null) ?? 'story',
  )
  useEffect(() => { localStorage.setItem(UI_MODE_KEY, mode) }, [mode])
  const story = mode === 'story'

  const toggleMode = useCallback(() => {
    setMode(m => {
      if (m === 'story') return 'system'
      setShowSchema(false)
      setShowRelSchema(false)
      setShowConceptSchema(false)
      return 'story'
    })
  }, [])

  // ── Import / Export ────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const exportedProject = storeRef.current.projects[storeRef.current.activeProjectId]
    logger.info('EXPORT', 'Export started', {
      projectId: exportedProject?.id,
      nodeCount: (exportedProject?.graph.nodes as any[])?.filter(n => n.type === 'circle').length ?? 0,
      assetCount: exportedProject?.assets?.length ?? 0,
    })
    logger.time('EXPORT_BUILD')
    setExportPayload(buildExportPayload(storeRef.current))
    logger.timeEnd('EXPORT_BUILD')
  }, [])

  const handleImportAction = useCallback((action: ImportAction) => {
    if (action.kind === 'new') {
      const next = importProject(action.data, storeRef.current)
      storeRef.current = next
      const project = getActiveProject(next)
      const normalized = normalizeGraph(project.graph as any, { showDefault: false })
      setNodes(normalized.nodes)
      setEdges(normalized.edges)
      setSchemaTypes(project.entitySchema)
      setRelTypes(project.relSchema)
      setConceptSchema(project.conceptSchema ?? [])
      setAssets(project.assets ?? [])
      setCanvasImages(project.canvasImages ?? [])
      setProjectName(project.name)
      setRootNodeId((project.graph as any).rootNodeId ?? null)
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setShowImport(false)
      return null
    }

    const currentProject = getActiveProject(storeRef.current)
    const { project: merged, report } = mergeIntoProject(action.data, currentProject)
    const normalized = normalizeGraph(merged.graph as any, { showDefault: false })
    setNodes(normalized.nodes)
    setEdges(normalized.edges)
    setSchemaTypes(merged.entitySchema)
    setRelTypes(merged.relSchema)
    setConceptSchema(merged.conceptSchema ?? [])
    setAssets(merged.assets ?? [])
    setCanvasImages(merged.canvasImages ?? [])
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    return report
  }, [setNodes, setEdges])

  // ── Persistence: localStorage + debounced cloud save ────────────────
  // storeRef is updated unconditionally so export/import always read current state.
  // Persistence (localStorage + cloud) is guarded until cloud data has been loaded
  // to prevent overwriting cloud state with stale local data on startup.
  useEffect(() => {
    // Sync canvas positions back to assets and canvas images before persisting
    const syncedAssets = assets.map(a => {
      if (!a.isPinnedOnCanvas) return a
      const canvasNode = nodes.find(n => n.id === `asset-node-${a.id}`)
      if (!canvasNode) return a
      return { ...a, position: { x: canvasNode.position.x, y: canvasNode.position.y } }
    })
    const syncedCanvasImages = canvasImages.map(ci => {
      const canvasNode = nodes.find(n => n.id === `canvas-img-${ci.id}`)
      if (!canvasNode) return ci
      return { ...ci, x: canvasNode.position.x, y: canvasNode.position.y }
    })

    const current = storeRef.current
    const next: ProjectStore = {
      ...current,
      projects: {
        ...current.projects,
        [current.activeProjectId]: {
          ...getActiveProject(current),
          name: projectName,
          graph: { nodes: nodes as any, edges: edges as any, rootNodeId: rootNodeId ?? undefined },
          entitySchema: schemaTypes,
          relSchema: relTypes,
          conceptSchema,
          assets: syncedAssets,
          canvasImages: syncedCanvasImages,
          updatedAt: new Date().toISOString(),
        },
      },
    }
    storeRef.current = next  // always current — export reads from here

    if (!cloudLoadedRef.current) return  // guard only the persistence layer
    autoSave(next)
  }, [nodes, edges, schemaTypes, relTypes, conceptSchema, assets, canvasImages, rootNodeId, projectName]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Diagnostics snapshot — observational only, no behavior change ────
  useEffect(() => {
    updateDiagnosticsSnapshot({
      projectId,
      projectName,
      nodes: nodes as unknown[],
      edges: edges as unknown[],
      entitySchemaCount: schemaTypes.length,
      relSchemaCount: relTypes.length,
      conceptSchemaCount: conceptSchema.length,
      assetCount: assets.length,
      canvasImageCount: canvasImages.length,
    })
  }, [projectId, projectName, nodes, edges, schemaTypes, relTypes, conceptSchema, assets, canvasImages])

  // ── Sync project name to cloud on change ──────────────────────────────
  const initialNameRef = useRef(projectName)
  useEffect(() => {
    if (!cloudLoadedRef.current) return
    if (projectName === initialNameRef.current) return
    initialNameRef.current = projectName
    const timer = setTimeout(() => {
      updateProject(projectId, { name: projectName }).catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [projectName, projectId])

  // ── Re-sync schemaColor when relationship schema changes ──────────────
  useEffect(() => {
    setEdges(eds => eds.map(e => {
      const typeId = e.data?.relationshipTypeId as string | undefined
      if (!typeId || e.data?.color) return e
      const resolved = resolveRelationshipType(typeId, relTypes)
      const schemaColor = resolved?.defaultColor
      if (schemaColor === (e.data?.schemaColor as string | undefined)) return e
      const style = schemaColor ? { stroke: schemaColor, strokeWidth: 2 } : e.style
      return { ...e, style, data: { ...e.data, schemaColor } }
    }))
  }, [relTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived selections ────────────────────────────────────────────────
  const selectedNode = useMemo(
    () => selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null,
    [nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) ?? null : null,
    [edges, selectedEdgeId],
  )
  const selectedRelationships = useMemo(() => {
    if (!selectedNodeId) return { outgoing: [], incoming: [] }
    const name = (id: string) => nodes.find(n => n.id === id)?.data.label ?? id
    return {
      outgoing: edges.filter(e => e.source === selectedNodeId)
        .map(e => ({ label: typeof e.label === 'string' ? e.label : '', peer: name(e.target) })),
      incoming: edges.filter(e => e.target === selectedNodeId)
        .map(e => ({ label: typeof e.label === 'string' ? e.label : '', peer: name(e.source) })),
    }
  }, [selectedNodeId, edges, nodes])

  const isCanvasImageNode = selectedNode?.type === 'canvas-image'
  const selectedCanvasImage = useMemo(() => {
    if (!isCanvasImageNode || !selectedNode) return null
    const ciId = (selectedNode.data as unknown as CanvasImageNodeData).canvasImageId
    return canvasImages.find(c => c.id === ciId) ?? null
  }, [isCanvasImageNode, selectedNode, canvasImages])

  const isAssetNode = !isCanvasImageNode && selectedNode?.type === 'asset'
  const selectedAsset = useMemo(() => {
    if (!isAssetNode || !selectedNode) return null
    const assetId = (selectedNode.data as unknown as AssetNodeData).assetId
    return assets.find(a => a.id === assetId) ?? null
  }, [isAssetNode, selectedNode, assets])

  const resolvedFields = useMemo(
    () => selectedNode?.data.typeId ? resolveFields(selectedNode.data.typeId, schemaTypes) : [],
    [selectedNode, schemaTypes],
  )

  // ── Entity creation ───────────────────────────────────────────────────
  const createEntityAt = useCallback((position: { x: number; y: number }) => {
    const id = `node-${Date.now()}`
    const defaultSchema = schemaRef.current.find(t => t.name === 'Character')
    setNodes(nds => [...nds, {
      id, type: 'circle', position,
      data: { label: 'Untitled', entityType: 'Character', typeId: defaultSchema?.id, fields: {}, description: '', sizeLevel: 3 as SizeLevel },
    }])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }, [setNodes])

  const createEntityAtCenter = useCallback(() => {
    createEntityAt(screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
  }, [screenToFlowPosition, createEntityAt])

  const onCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('.react-flow__node')) return
    if (t.closest('.react-flow__edge')) return
    if (t.closest('.react-flow__controls')) return
    if (t.closest('.react-flow__minimap')) return
    createEntityAt(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }, [screenToFlowPosition, createEntityAt])

  // ── Canvas image drag mode ─────────────────────────────────────────
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null)

  const enterImageDragMode = useCallback((ciId: string) => {
    setDraggingImageId(ciId)
    setNodes(nds => nds.map(n =>
      n.id === `canvas-img-${ciId}` ? { ...n, draggable: true } : n,
    ))
  }, [setNodes])

  const exitImageDragMode = useCallback(() => {
    if (!draggingImageId) return
    setNodes(nds => nds.map(n =>
      n.id === `canvas-img-${draggingImageId}` ? { ...n, draggable: false } : n,
    ))
    setDraggingImageId(null)
  }, [draggingImageId, setNodes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'Escape' && draggingImageId) {
        exitImageDragMode()
        return
      }
      if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA'
          && !pendingConn && !showSchema && !showRelSchema)
        createEntityAtCenter()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [createEntityAtCenter, pendingConn, showSchema, showRelSchema, draggingImageId, exitImageDragMode])

  // ── Connections ───────────────────────────────────────────────────────
  const onConnect = useCallback((conn: Connection) => setPendingConn(conn), [])

  const confirmRelationship = useCallback((label: string, relationshipTypeId?: string) => {
    if (!pendingConn) return
    const { style, schemaColor } = resolveEdgeStyle(label, relationshipTypeId, relTypesRef.current, undefined)
    const resolved = relationshipTypeId ? resolveRelationshipType(relationshipTypeId, relTypesRef.current) : null
    const direction: RelationshipDirection = resolved?.defaultDirection ?? 'undirected'
    const newEdge: Edge = {
      ...pendingConn,
      id: `edge-${Date.now()}`,
      label, type: 'relationship', style,
      data: { labelT: 0.5, relationshipTypeId, schemaColor, direction },
    }
    setEdges(eds => addEdge(applyDirectionMarkers(newEdge), eds))
    setPendingConn(null)
  }, [pendingConn, setEdges])

  const onReconnect = useCallback((oldEdge: Edge, newConn: Connection) => {
    setEdges(eds => reconnectEdge(oldEdge, newConn, eds))
  }, [setEdges])

  // ── Click handlers ────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler<GraphNode> = useCallback((_e, node) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setShowSchema(false)
    setShowRelSchema(false)
  }, [])
  const onEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
    setShowSchema(false)
    setShowRelSchema(false)
  }, [])
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setCtxMenu(null)
    if (draggingImageId) exitImageDragMode()
  }, [draggingImageId, exitImageDragMode])

  // ── Inspector resize ──────────────────────────────────────────────────
  const onInspectorHandlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDraggingInspector.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onInspectorHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingInspector.current) return
    setInspectorWidth(Math.max(320, Math.min(900, window.innerWidth - e.clientX)))
  }, [])

  const onInspectorHandlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingInspector.current) return
    isDraggingInspector.current = false
    const w = Math.max(320, Math.min(900, window.innerWidth - e.clientX))
    setInspectorWidth(w)
    localStorage.setItem('narrasmith.inspector.width', String(w))
  }, [])

  // ── Delete / reverse helpers ──────────────────────────────────────────
  const deleteEntity = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
    if (rootNodeId === nodeId) setRootNodeId(null)
  }, [setNodes, setEdges, selectedNodeId, rootNodeId])

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId))
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null)
  }, [setEdges, selectedEdgeId])

  const reverseEdge = useCallback((edgeId: string) => {
    setEdges(eds => eds.map(e =>
      e.id !== edgeId ? e : {
        ...e,
        source: e.target,
        target: e.source,
        sourceHandle: e.targetHandle,
        targetHandle: e.sourceHandle,
      },
    ))
  }, [setEdges])

  // ── Context menu handlers ─────────────────────────────────────────────
  const onPaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setCtxMenu({ x: e.clientX, y: e.clientY, target: { type: 'canvas', position: pos } })
  }, [screenToFlowPosition])

  const onNodeContextMenu = useCallback((_e: MouseEvent | React.MouseEvent, node: GraphNode) => {
    _e.preventDefault()
    const nodeType = node.type === 'asset' ? 'asset' as const : node.type === 'canvas-image' ? 'canvas-image' as const : 'entity' as const
    const flowPos = screenToFlowPosition({ x: _e.clientX, y: _e.clientY })
    setCtxMenu({ x: _e.clientX, y: _e.clientY, target: { type: 'node', nodeId: node.id, nodeType, position: flowPos } })
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
  }, [screenToFlowPosition])

  const onEdgeContextMenu = useCallback((_e: MouseEvent | React.MouseEvent, edge: Edge) => {
    _e.preventDefault()
    setCtxMenu({ x: _e.clientX, y: _e.clientY, target: { type: 'edge', edgeId: edge.id } })
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
  }, [])

  // ── Data updaters ─────────────────────────────────────────────────────
  const updateNode = useCallback((updates: Partial<NodeData>) => {
    if (!selectedNodeId) return
    setNodes(nds => nds.map(n =>
      n.id === selectedNodeId ? { ...n, data: { ...n.data, ...updates } } : n,
    ))
  }, [selectedNodeId, setNodes])

  const updateEdgeLabel = useCallback((label: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      const manualColor = e.data?.color as string | undefined
      const typeId = e.data?.relationshipTypeId as string | undefined
      if (manualColor || typeId) return { ...e, label }
      return { ...e, label, ...edgeStyleForLabel(label) }
    }))
  }, [selectedEdgeId, setEdges])

  const updateEdgeDescription = useCallback((description: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e =>
      e.id !== selectedEdgeId ? e : { ...e, data: { ...e.data, description: description || undefined } }
    ))
  }, [selectedEdgeId, setEdges])

  const updateEdgeWhyItMatters = useCallback((whyItMatters: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e =>
      e.id !== selectedEdgeId ? e : { ...e, data: { ...e.data, whyItMatters: whyItMatters || undefined } }
    ))
  }, [selectedEdgeId, setEdges])

  const updateEdgeTypeId = useCallback((typeId: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      const resolved = resolveRelationshipType(typeId, relTypesRef.current)
      const schemaColor = resolved?.defaultColor
      const manualColor = e.data?.color as string | undefined
      const styleResult = resolveEdgeStyle(typeof e.label === 'string' ? e.label : '', typeId, relTypesRef.current, manualColor)
      const label = (typeof e.label !== 'string' || e.label.trim() === '') ? (resolved?.name ?? e.label) : e.label
      return applyDirectionMarkers({
        ...e, label, style: styleResult.style,
        data: { ...e.data, relationshipTypeId: typeId, schemaColor: manualColor ? undefined : schemaColor },
      })
    }))
  }, [selectedEdgeId, setEdges])

  const clearEdgeTypeId = useCallback(() => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      return applyDirectionMarkers({
        ...e,
        data: { ...e.data, relationshipTypeId: undefined, schemaColor: undefined },
        ...(!(e.data?.color) ? edgeStyleForLabel(typeof e.label === 'string' ? e.label : '') : {}),
      })
    }))
  }, [selectedEdgeId, setEdges])

  const updateEdgeColor = useCallback((color: string) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      return applyDirectionMarkers({ ...e, data: { ...e.data, color: color || undefined } })
    }))
  }, [selectedEdgeId, setEdges])

  const updateEdgeDirection = useCallback((direction: RelationshipDirection) => {
    if (!selectedEdgeId) return
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdgeId) return e
      return applyDirectionMarkers({ ...e, data: { ...e.data, direction } })
    }))
  }, [selectedEdgeId, setEdges])

  // ── Asset management ──────────────────────────────────────────────────
  const addAsset = useCallback((asset: AssetData) => {
    const shouldPin = asset.isPinnedOnCanvas
    const pos = shouldPin
      ? (asset.position ?? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
      : asset.position
    const saved = { ...asset, position: pos }
    setAssets(prev => [...prev, saved])
    if (shouldPin && pos) {
      const summary = asset.entries.slice(0, 3).map(e => e.label || e.type).join(', ')
      setNodes(nds => [...nds, {
        id: `asset-node-${asset.id}`,
        type: 'asset',
        position: pos,
        data: { assetId: asset.id, title: asset.title, entryCount: asset.entries.length, entrySummary: summary },
      } as any])
      const tetherEdges: Edge[] = asset.linkedEntityIds
        .filter(eid => nodes.some(n => n.id === eid))
        .map(eid => ({
          id: `tether-${asset.id}-${eid}`,
          source: `asset-node-${asset.id}`,
          target: eid,
          type: 'tether',
        }))
      if (tetherEdges.length > 0) setEdges(eds => [...eds, ...tetherEdges])
    }
  }, [screenToFlowPosition, setNodes, setEdges, nodes])

  const updateAsset = useCallback((asset: AssetData) => {
    setAssets(prev => prev.map(a => a.id === asset.id ? asset : a))
    setNodes(nds => nds.map(n => {
      if (n.type !== 'asset' || (n.data as unknown as AssetNodeData).assetId !== asset.id) return n
      const summary = asset.entries.slice(0, 3).map(e => e.label || e.type).join(', ')
      return { ...n, data: { assetId: asset.id, title: asset.title, entryCount: asset.entries.length, entrySummary: summary } as any }
    }))
  }, [setNodes])

  const removeAsset = useCallback((assetId: string) => {
    setAssets(prev => prev.filter(a => a.id !== assetId))
    setNodes(nds => nds.filter(n => !(n.type === 'asset' && (n.data as unknown as AssetNodeData).assetId === assetId)))
    setEdges(eds => eds.filter(e => !e.id.startsWith(`tether-${assetId}-`)))
    if (selectedNodeId === `asset-node-${assetId}`) setSelectedNodeId(null)
  }, [setNodes, setEdges, selectedNodeId])

  const toggleAssetPin = useCallback((assetId: string) => {
    setAssets(prev => prev.map(a => {
      if (a.id !== assetId) return a
      const nowPinned = !a.isPinnedOnCanvas
      if (nowPinned) {
        const linkedNode = nodes.find(n => a.linkedEntityIds.includes(n.id))
        const pos = linkedNode
          ? { x: linkedNode.position.x + 150, y: linkedNode.position.y - 50 }
          : a.position ?? { x: 200, y: 200 }
        const summary = a.entries.slice(0, 3).map(e => e.label || e.type).join(', ')
        const assetNodeData: AssetNodeData = {
          assetId: a.id, title: a.title,
          entryCount: a.entries.length, entrySummary: summary,
        }
        setNodes(nds => [...nds, {
          id: `asset-node-${a.id}`,
          type: 'asset',
          position: pos,
          data: assetNodeData,
        } as any])
        const tetherEdges: Edge[] = a.linkedEntityIds
          .filter(entityId => nodes.some(n => n.id === entityId))
          .map(entityId => ({
            id: `tether-${a.id}-${entityId}`,
            source: `asset-node-${a.id}`,
            target: entityId,
            type: 'tether',
          }))
        setEdges(eds => [...eds, ...tetherEdges])
        return { ...a, isPinnedOnCanvas: true, position: pos }
      } else {
        setNodes(nds => nds.filter(n => n.id !== `asset-node-${a.id}`))
        setEdges(eds => eds.filter(e => !e.id.startsWith(`tether-${a.id}-`)))
        return { ...a, isPinnedOnCanvas: false }
      }
    }))
  }, [nodes, setNodes, setEdges])

  const linkAssetToEntity = useCallback((assetId: string, entityId: string) => {
    setAssets(prev => {
      const asset = prev.find(a => a.id === assetId)
      if (!asset || asset.linkedEntityIds.includes(entityId)) return prev
      if (asset.isPinnedOnCanvas) {
        const tetherId = `tether-${assetId}-${entityId}`
        setEdges(eds => eds.some(e => e.id === tetherId) ? eds : [...eds, {
          id: tetherId, source: `asset-node-${assetId}`, target: entityId, type: 'tether',
        }])
      }
      return prev.map(a => a.id === assetId ? { ...a, linkedEntityIds: [...a.linkedEntityIds, entityId] } : a)
    })
  }, [setEdges])

  const unlinkAssetFromEntity = useCallback((assetId: string, entityId: string) => {
    setAssets(prev => prev.map(a =>
      a.id === assetId
        ? { ...a, linkedEntityIds: a.linkedEntityIds.filter(id => id !== entityId) }
        : a,
    ))
    setEdges(eds => eds.filter(e => e.id !== `tether-${assetId}-${entityId}`))
  }, [setEdges])

  const createStandaloneAsset = useCallback((asset: AssetData) => {
    addAsset(asset)
    setShowNewAsset(false)
  }, [addAsset])

  // ── Canvas image management ──────────────────────────────────────────
  const [showNewCanvasImage, setShowNewCanvasImage] = useState(false)
  const [newCanvasImagePos, setNewCanvasImagePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const addCanvasImage = useCallback((ci: CanvasImage) => {
    setCanvasImages(prev => [...prev, ci])
    setNodes(nds => [...nds, {
      id: `canvas-img-${ci.id}`,
      type: 'canvas-image',
      position: { x: ci.x, y: ci.y },
      draggable: false,
      selectable: true,
      zIndex: ci.zIndex - 1000,
      data: {
        canvasImageId: ci.id, title: ci.title, imageUrl: ci.imageUrl,
        width: ci.width, height: ci.height, rotation: ci.rotation,
        opacity: ci.opacity, locked: ci.locked,
      },
    } as any])
  }, [setNodes])

  const updateCanvasImage = useCallback((ci: CanvasImage) => {
    setCanvasImages(prev => prev.map(c => c.id === ci.id ? ci : c))
    setNodes(nds => nds.map(n => {
      if (n.id !== `canvas-img-${ci.id}`) return n
      return {
        ...n,
        data: {
          canvasImageId: ci.id, title: ci.title, imageUrl: ci.imageUrl,
          width: ci.width, height: ci.height, rotation: ci.rotation,
          opacity: ci.opacity, locked: ci.locked,
        } as any,
      }
    }))
  }, [setNodes])

  const deleteCanvasImage = useCallback((ciId: string) => {
    setCanvasImages(prev => prev.filter(c => c.id !== ciId))
    setNodes(nds => nds.filter(n => n.id !== `canvas-img-${ciId}`))
    if (selectedNodeId === `canvas-img-${ciId}`) setSelectedNodeId(null)
  }, [setNodes, selectedNodeId])

  const duplicateCanvasImage = useCallback((ciId: string) => {
    const orig = canvasImages.find(c => c.id === ciId)
    if (!orig) return
    const dup: CanvasImage = {
      ...orig,
      id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${orig.title} Copy`,
      x: orig.x + 50,
      y: orig.y + 50,
    }
    addCanvasImage(dup)
  }, [canvasImages, addCanvasImage])

  // ── Command registry ───────────────────────────────────────────────────
  const commandRegistry: CommandRegistry = useMemo(() => ({
    'entity.create': ({ position }) => createEntityAt(position),
    'entity.select': ({ id }) => { setSelectedNodeId(id); setSelectedEdgeId(null) },
    'entity.delete': ({ id }) => deleteEntity(id),
    'entity.toggle-root': ({ id }) => setRootNodeId(prev => prev === id ? null : id),
    'asset.create': () => setShowNewAsset(true),
    'asset.select': ({ id }) => { setSelectedNodeId(id); setSelectedEdgeId(null) },
    'asset.toggle-pin': ({ id }) => toggleAssetPin(id),
    'asset.delete': ({ id }) => removeAsset(id),
    'edge.select': ({ id }) => { setSelectedEdgeId(id); setSelectedNodeId(null) },
    'edge.reverse': ({ id }) => reverseEdge(id),
    'edge.delete': ({ id }) => deleteEdge(id),
    'canvas-image.insert': ({ position }) => { setNewCanvasImagePos(position); setShowNewCanvasImage(true) },
    'canvas-image.select': ({ id }) => { setSelectedNodeId(`canvas-img-${id}`); setSelectedEdgeId(null) },
    'canvas-image.delete': ({ id }) => deleteCanvasImage(id),
    'canvas-image.duplicate': ({ id }) => duplicateCanvasImage(id),
    'canvas-image.toggle-lock': ({ id }) => {
      const ci = canvasImages.find(c => c.id === id)
      if (ci) updateCanvasImage({ ...ci, locked: !ci.locked })
    },
    'canvas-image.drag': ({ id }) => enterImageDragMode(id),
    'ui.world-index': () => setShowIndex(true),
    'ui.asset-index': () => setShowAssetIndex(true),
  }), [createEntityAt, deleteEntity, toggleAssetPin, removeAsset, reverseEdge, deleteEdge, deleteCanvasImage, duplicateCanvasImage, canvasImages, updateCanvasImage, enterImageDragMode])

  const executeCommand = useMemo(() => createCommandExecutor(commandRegistry), [commandRegistry])

  // Close dropdowns on any outside click
  useEffect(() => {
    if (!showProjectMenu && !showHamburger) return
    const close = () => { setShowProjectMenu(false); setShowHamburger(false) }
    const timer = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', close) }
  }, [showProjectMenu, showHamburger])

  const pendingSource = pendingConn ? nodes.find(n => n.id === pendingConn.source)?.data.label ?? '' : ''
  const pendingTarget = pendingConn ? nodes.find(n => n.id === pendingConn.target)?.data.label ?? '' : ''

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', fontFamily: 'system-ui, sans-serif' }}>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }} onDoubleClick={onCanvasDoubleClick}>

        {/* Top-right toolbar: file operations + world index */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setShowImport(true)}
            title="Import a Narrasmith project — file or paste"
            style={topRightBtn}
          >
            Import
          </button>
          <button
            onClick={handleExport}
            title="Export this project — download or copy"
            style={topRightBtn}
          >
            Export
          </button>
          <button
            onClick={() => setShowIndex(s => !s)}
            title="World Index — browse all entities, connections and concepts"
            style={{
              ...topRightBtn,
              background: showIndex ? '#18181b' : '#fff',
              color: showIndex ? '#fff' : '#52525b',
              fontWeight: 700, fontSize: 14,
            }}
          >
            ≡
          </button>
        </div>

        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Project dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setShowProjectMenu(s => !s); setShowHamburger(false) }}
              style={{
                ...backBtn, display: 'flex', alignItems: 'center', gap: 6,
                background: showProjectMenu ? '#18181b' : '#fff',
                color: showProjectMenu ? '#fff' : '#52525b',
              }}
            >
              <span style={{ fontWeight: 700, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {projectName}
              </span>
              <span style={{ fontSize: 9 }}>&#9660;</span>
            </button>
            {showProjectMenu && (
              <div style={dropdownMenu} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '8px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Project Name
                  </span>
                  <input
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    style={{ ...inputStyle, marginTop: 4, fontSize: 13 }}
                    autoFocus
                  />
                </div>
                <div style={dropdownDivider} />
                <button
                  onClick={() => { setShowProjectMenu(false); onBackToDashboard() }}
                  style={dropdownItem}
                >
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>

          {/* Hamburger menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setShowHamburger(s => !s); setShowProjectMenu(false) }}
              style={{
                ...toolbarBtn, padding: '8px 10px', fontSize: 15, lineHeight: 1,
                background: showHamburger ? '#6366f1' : '#18181b',
              }}
              title="Tools"
            >
              +
            </button>
            {showHamburger && (
              <div style={dropdownMenu} onClick={e => e.stopPropagation()}>
                <button onClick={() => { createEntityAtCenter(); setShowHamburger(false) }} style={dropdownItem}>
                  New Entity
                </button>
                <button onClick={() => { setShowNewAsset(true); setShowHamburger(false) }} style={dropdownItem}>
                  New Asset
                </button>
                <button onClick={() => {
                  setNewCanvasImagePos(screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
                  setShowNewCanvasImage(true); setShowHamburger(false)
                }} style={dropdownItem}>
                  Canvas Image
                </button>
                <div style={dropdownDivider} />
                <button onClick={() => { setShowSchema(s => !s); setShowRelSchema(false); setShowConceptSchema(false); setShowHamburger(false) }} style={{
                  ...dropdownItem, color: showSchema ? '#6366f1' : '#18181b',
                }}>
                  Entity Schema
                </button>
                <button onClick={() => { setShowRelSchema(s => !s); setShowSchema(false); setShowConceptSchema(false); setShowHamburger(false) }} style={{
                  ...dropdownItem, color: showRelSchema ? '#0ea5e9' : '#18181b',
                }}>
                  Rel. Schema
                </button>
                <button onClick={() => { setShowConceptSchema(s => !s); setShowSchema(false); setShowRelSchema(false); setShowHamburger(false) }} style={{
                  ...dropdownItem, color: showConceptSchema ? '#a855f7' : '#18181b',
                }}>
                  Concepts
                </button>
                <button onClick={() => { setShowAssetIndex(s => !s); setShowHamburger(false) }} style={{
                  ...dropdownItem, color: showAssetIndex ? '#6366f1' : '#18181b',
                }}>
                  Assets
                </button>
              </div>
            )}
          </div>

          <span
            title={nodes.length > 20
              ? 'Large graphs can be hard to read. Consider breaking this into sub-worlds.'
              : 'Aim for a graph readable in 30–60 seconds'}
            style={{
              fontSize: 11,
              color: nodes.length > 20 ? '#f59e0b' : '#a1a1aa',
            }}
          >
            {nodes.length > 20 ? '! ' : ''}{nodes.length} {nodes.length === 1 ? 'entity' : 'entities'}
          </span>

          <button
            onClick={toggleMode}
            title={story ? 'Switch to System mode for schema controls' : 'Switch to Story mode'}
            style={{
              padding: '6px 10px',
              background: story ? 'transparent' : '#18181b',
              color: story ? '#c4c4c7' : '#fff',
              border: `1px solid ${story ? '#e4e4e7' : '#18181b'}`,
              borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11,
              transition: 'all 0.15s',
            }}
          >
            {story ? 'System' : 'System'}
          </button>
        </div>

        <ReactFlow
          nodes={nodes} edges={edges}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          edgesReconnectable
          onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu as any}
          onEdgeContextMenu={onEdgeContextMenu}
          zoomOnDoubleClick={false}
          fitView
        >
          <Background /><Controls /><MiniMap />
        </ReactFlow>
        {draggingImageId && (
          <div style={{
            position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, background: '#18181b', color: '#fff', padding: '6px 14px',
            borderRadius: 8, fontSize: 12, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontFamily: 'system-ui, sans-serif',
          }}>
            Dragging Canvas Image (ESC to cancel)
          </div>
        )}
      </div>

      {/* Inspector panel */}
      {(selectedNode || selectedEdge) && (
        <aside style={{
          width: inspectorWidth, padding: '22px 18px',
          borderLeft: '1px solid #e4e4e7', background: '#fafafa',
          display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto',
          flexShrink: 0, position: 'relative',
        }}>
          {/* Resize handle */}
          <div
            onPointerDown={onInspectorHandlePointerDown}
            onPointerMove={onInspectorHandlePointerMove}
            onPointerUp={onInspectorHandlePointerUp}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
              cursor: 'col-resize', zIndex: 10, userSelect: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          />
          {selectedNode && isCanvasImageNode && selectedCanvasImage && (
            <CanvasImageInspector
              image={selectedCanvasImage}
              onUpdate={updateCanvasImage}
              onDuplicate={duplicateCanvasImage}
              onDelete={deleteCanvasImage}
            />
          )}
          {selectedNode && isAssetNode && selectedAsset && (
            <AssetInspectorPanel
              asset={selectedAsset}
              nodes={nodes}
              onUpdate={updateAsset}
              onRemove={removeAsset}
              onTogglePin={toggleAssetPin}
              onLink={linkAssetToEntity}
              onUnlink={unlinkAssetFromEntity}
            />
          )}
          {selectedNode && !isAssetNode && !isCanvasImageNode && (story
            ? <StoryEntityPanel
                node={selectedNode} schemaTypes={schemaTypes} conceptSchemas={conceptSchema}
                resolvedFields={resolvedFields} relationships={selectedRelationships}
                onUpdate={updateNode}
                isRoot={selectedNode.id === rootNodeId}
                onToggleRoot={() => setRootNodeId(prev => prev === selectedNode.id ? null : selectedNode.id)}
                assets={assets} onAddAsset={addAsset} onUpdateAsset={updateAsset} onLinkAsset={linkAssetToEntity} onUnlinkAsset={unlinkAssetFromEntity} onToggleAssetPin={toggleAssetPin}
              />
            : <SystemEntityPanel
                node={selectedNode} schemaTypes={schemaTypes} conceptSchemas={conceptSchema}
                resolvedFields={resolvedFields} relationships={selectedRelationships}
                onUpdate={updateNode}
                isRoot={selectedNode.id === rootNodeId}
                onToggleRoot={() => setRootNodeId(prev => prev === selectedNode.id ? null : selectedNode.id)}
                assets={assets} onAddAsset={addAsset} onUpdateAsset={updateAsset} onLinkAsset={linkAssetToEntity} onUnlinkAsset={unlinkAssetFromEntity} onToggleAssetPin={toggleAssetPin}
              />
          )}
          {selectedEdge && (story
            ? <StoryEdgePanel
                edge={selectedEdge} nodes={nodes}
                onUpdateLabel={updateEdgeLabel}
                onUpdateDescription={updateEdgeDescription}
                onUpdateWhyItMatters={updateEdgeWhyItMatters}
                onUpdateColor={updateEdgeColor}
                onUpdateDirection={updateEdgeDirection}
              />
            : <SystemEdgePanel
                edge={selectedEdge} nodes={nodes} relTypes={relTypes}
                onUpdateLabel={updateEdgeLabel}
                onUpdateDescription={updateEdgeDescription}
                onUpdateColor={updateEdgeColor}
                onUpdateTypeId={updateEdgeTypeId}
                onClearTypeId={clearEdgeTypeId}
                onUpdateDirection={updateEdgeDirection}
              />
          )}
        </aside>
      )}

      {showSchema && (
        <SchemaEditorPanel
          schemaTypes={schemaTypes} conceptSchemas={conceptSchema}
          onChange={setSchemaTypes} onClose={() => setShowSchema(false)}
        />
      )}
      {showRelSchema && (
        <RelationshipSchemaEditorPanel relationshipTypes={relTypes} onChange={setRelTypes} onClose={() => setShowRelSchema(false)} />
      )}
      {showConceptSchema && (
        <ConceptSchemaEditorPanel
          conceptSchemas={conceptSchema}
          onChange={setConceptSchema}
          onClose={() => setShowConceptSchema(false)}
        />
      )}
      {showAssetIndex && (
        <AssetIndexPanel
          assets={assets} nodes={nodes}
          onUpdate={updateAsset}
          onRemove={removeAsset}
          onTogglePin={toggleAssetPin}
          onClose={() => setShowAssetIndex(false)}
        />
      )}
      {showIndex && (
        <WorldIndexPanel
          nodes={nodes} edges={edges} conceptSchemas={conceptSchema} assets={assets} canvasImages={canvasImages}
          onSelectNode={id => { setSelectedNodeId(id); setSelectedEdgeId(null) }}
          onSelectEdge={id => { setSelectedEdgeId(id); setSelectedNodeId(null) }}
          onToggleAssetPin={toggleAssetPin}
          onFocusCanvasImage={id => { setSelectedNodeId(`canvas-img-${id}`); setSelectedEdgeId(null) }}
          onClose={() => setShowIndex(false)}
        />
      )}
      {pendingConn && (
        <RelationshipModal
          sourceLabel={pendingSource} targetLabel={pendingTarget}
          relationshipTypes={relTypes} mode={mode}
          onSelect={confirmRelationship} onCancel={() => setPendingConn(null)}
        />
      )}
      {showImport && (
        <ImportModal
          currentProject={getActiveProject(storeRef.current)}
          onConfirm={handleImportAction}
          onCancel={() => setShowImport(false)}
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
      {showNewAsset && (
        <NewAssetModal
          onAdd={createStandaloneAsset}
          onCancel={() => setShowNewAsset(false)}
        />
      )}
      {showNewCanvasImage && (
        <NewCanvasImageModal
          position={newCanvasImagePos}
          onAdd={(ci) => { addCanvasImage(ci); setShowNewCanvasImage(false) }}
          onCancel={() => setShowNewCanvasImage(false)}
        />
      )}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          target={ctxMenu.target}
          items={getMenuItems(ctxMenu.target)}
          onExecute={executeCommand}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

// ── New Asset Modal ──────────────────────────────────────────────────────

const ASSET_TEMPLATES: { label: string; desc: string; entries: Omit<import('./types').AssetEntry, 'id'>[] }[] = [
  { label: 'Music Pack', desc: '3 music entries', entries: [
    { type: 'music', label: 'Theme', value: '', isLinkified: false },
    { type: 'music', label: 'Battle', value: '', isLinkified: false },
    { type: 'music', label: 'Ambient', value: '', isLinkified: false },
  ]},
  { label: 'Image Pack', desc: '3 image entries', entries: [
    { type: 'image', label: 'Portrait', value: '', isLinkified: false },
    { type: 'image', label: 'Scene', value: '', isLinkified: false },
    { type: 'image', label: 'Map', value: '', isLinkified: false },
  ]},
  { label: 'Document Pack', desc: '2 doc entries', entries: [
    { type: 'document', label: 'Lore', value: '', isLinkified: false },
    { type: 'document', label: 'Notes', value: '', isLinkified: false },
  ]},
  { label: 'Mixed', desc: 'image + link + notes', entries: [
    { type: 'image', label: 'Image', value: '', isLinkified: false },
    { type: 'link', label: 'Reference', value: '', isLinkified: false },
    { type: 'custom', label: 'Notes', value: '', isLinkified: false },
  ]},
  { label: 'Custom', desc: 'empty container', entries: [] },
]

function NewAssetModal({ onAdd, onCancel }: { onAdd: (a: AssetData) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(0)

  const handleCreate = () => {
    const tmpl = ASSET_TEMPLATES[selectedTemplate]
    const eid = () => `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    onAdd({
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim() || tmpl.label,
      linkedEntityIds: [],
      isPinnedOnCanvas: true,
      entries: tmpl.entries.map(e => ({ ...e, id: eid() })),
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: '24px 28px',
        width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#18181b' }}>New Asset Container</h2>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" style={{ ...inputStyle, marginBottom: 14 }} autoFocus />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Template
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {ASSET_TEMPLATES.map((tmpl, i) => (
            <button
              key={tmpl.label}
              onClick={() => setSelectedTemplate(i)}
              style={{
                padding: '8px 12px', borderRadius: 6, textAlign: 'left',
                border: `1.5px solid ${selectedTemplate === i ? '#6366f1' : '#e4e4e7'}`,
                background: selectedTemplate === i ? '#ede9fe' : '#fff',
                color: '#18181b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              {tmpl.label}
              <span style={{ color: '#a1a1aa', fontWeight: 400, marginLeft: 8, fontSize: 11 }}>{tmpl.desc}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onCancel} style={{
            padding: '7px 14px', borderRadius: 6, border: '1px solid #d4d4d8',
            background: '#fff', color: '#52525b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleCreate} style={{
            padding: '7px 14px', borderRadius: 6, border: 'none',
            background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Create</button>
        </div>
      </div>
    </div>
  )
}

// ── New Canvas Image Modal ────────────────────────────────────────────────

function NewCanvasImageModal({ position, onAdd, onCancel }: {
  position: { x: number; y: number }
  onAdd: (ci: CanvasImage) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('Untitled Image')
  const [imageUrl, setImageUrl] = useState('')
  const [width, setWidth] = useState(400)
  const [height, setHeight] = useState(300)

  const handleCreate = () => {
    if (!imageUrl.trim()) return
    onAdd({
      id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      x: position.x, y: position.y,
      width, height,
      rotation: 0, opacity: 1, locked: false, zIndex: 0,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#18181b' }}>Insert Canvas Image</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputStyle} autoFocus />
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL (https://...)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#52525b' }}>Width</span>
              <input type="number" value={width} onChange={e => setWidth(Number(e.target.value) || 400)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#52525b' }}>Height</span>
              <input type="number" value={height} onChange={e => setHeight(Number(e.target.value) || 300)} style={inputStyle} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d4d4d8', background: '#fff', color: '#52525b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleCreate} disabled={!imageUrl.trim()} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: imageUrl.trim() ? 1 : 0.5 }}>Insert</button>
        </div>
      </div>
    </div>
  )
}

// ── Canvas Image Inspector ───────────────────────────────────────────────

function CanvasImageInspector({ image, onUpdate, onDuplicate, onDelete }: {
  image: CanvasImage
  onUpdate: (ci: CanvasImage) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      <h2 style={panelHeading}>Canvas Image</h2>

      <PanelField label="Title">
        <input value={image.title} onChange={e => onUpdate({ ...image, title: e.target.value })} style={inputStyle} />
      </PanelField>

      <PanelField label="Image URL">
        <input value={image.imageUrl} onChange={e => onUpdate({ ...image, imageUrl: e.target.value })} style={inputStyle} placeholder="https://..." />
      </PanelField>

      <PanelField label="Dimensions">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 10, color: '#a1a1aa' }}>Width</span>
            <input type="number" value={image.width} onChange={e => onUpdate({ ...image, width: Number(e.target.value) || 100 })} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 10, color: '#a1a1aa' }}>Height</span>
            <input type="number" value={image.height} onChange={e => onUpdate({ ...image, height: Number(e.target.value) || 100 })} style={inputStyle} />
          </div>
        </div>
      </PanelField>

      <PanelField label={`Opacity (${Math.round(image.opacity * 100)}%)`}>
        <input
          type="range" min={0.05} max={1} step={0.05}
          value={image.opacity}
          onChange={e => onUpdate({ ...image, opacity: Number(e.target.value) })}
          style={{ width: '100%', accentColor: '#6366f1' }}
        />
      </PanelField>

      <PanelField label="Rotation">
        <input type="number" value={image.rotation} onChange={e => onUpdate({ ...image, rotation: Number(e.target.value) })} style={inputStyle} />
      </PanelField>

      <button onClick={() => onUpdate({ ...image, locked: !image.locked })} style={rootToggleBtn(image.locked)}>
        {image.locked ? 'Locked' : 'Unlocked'}
      </button>

      <button onClick={() => onDuplicate(image.id)} style={{
        padding: '6px 12px', background: '#fff', color: '#52525b',
        border: '1px solid #d4d4d8', borderRadius: 6, cursor: 'pointer',
        fontWeight: 600, fontSize: 12, width: '100%',
      }}>
        Duplicate
      </button>

      <button onClick={() => onDelete(image.id)} style={{
        padding: '6px 12px', background: '#fff', color: '#dc2626',
        border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer',
        fontWeight: 600, fontSize: 12, width: '100%',
      }}>
        Delete
      </button>
    </>
  )
}

// ── Panel prop types ──────────────────────────────────────────────────────

type RelationshipList = { outgoing: { label: string; peer: string }[]; incoming: { label: string; peer: string }[] }

type EntityPanelProps = {
  node: GraphNode
  schemaTypes: SchemaType[]
  conceptSchemas: ConceptSchemaType[]
  resolvedFields: ResolvedField[]
  relationships: RelationshipList
  onUpdate: (u: Partial<NodeData>) => void
  isRoot: boolean
  onToggleRoot: () => void
  assets: AssetData[]
  onAddAsset: (asset: AssetData) => void
  onUpdateAsset: (asset: AssetData) => void
  onLinkAsset: (assetId: string, entityId: string) => void
  onUnlinkAsset: (assetId: string, entityId: string) => void
  onToggleAssetPin: (assetId: string) => void
}

type StoryEdgePanelProps = {
  edge: Edge
  nodes: GraphNode[]
  onUpdateLabel: (l: string) => void
  onUpdateDescription: (d: string) => void
  onUpdateWhyItMatters?: (w: string) => void
  onUpdateColor: (c: string) => void
  onUpdateDirection: (d: RelationshipDirection) => void
}

type SystemEdgePanelProps = StoryEdgePanelProps & {
  relTypes: RelationshipType[]
  onUpdateTypeId: (id: string) => void
  onClearTypeId: () => void
}

// ── Story-mode entity panel ───────────────────────────────────────────────

function StoryEntityPanel({ node, schemaTypes, conceptSchemas, resolvedFields, relationships, onUpdate, isRoot, onToggleRoot, assets, onAddAsset, onUpdateAsset, onLinkAsset, onUnlinkAsset, onToggleAssetPin }: EntityPanelProps) {
  const entitySchemaType = schemaTypes.find(st => st.id === node.data.typeId)
  const allowedConceptIds = entitySchemaType?.conceptSchemaIds ?? []
  const existingConceptIds = Object.keys(node.data.concepts ?? {})
    .filter(k => (node.data.concepts?.[k]?.length ?? 0) > 0)
  const visibleConceptIds = [...new Set([...allowedConceptIds, ...existingConceptIds])]

  return (
    <>
      <PanelField label="Name">
        <input value={node.data.label} onChange={e => onUpdate({ label: e.target.value })} style={inputStyle} />
      </PanelField>

      <PanelField label="Role">
        <input
          value={node.data.entityType}
          onChange={e => {
            const match = schemaTypes.find(t => t.name.toLowerCase() === e.target.value.toLowerCase())
            onUpdate({ entityType: e.target.value, typeId: match?.id })
          }}
          placeholder="e.g. Deity, Faction, Artefact…"
          style={inputStyle}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          {schemaTypes.map(st => {
            const c = entityColors(st.name)
            const active = node.data.typeId === st.id
            return (
              <button key={st.id} onClick={() => onUpdate({ entityType: st.name, typeId: st.id })} style={{
                padding: '3px 9px', borderRadius: 999,
                border: `1.5px solid ${c.border}`,
                background: active ? c.bg : 'transparent', color: c.text,
                fontWeight: 600, fontSize: 11, cursor: 'pointer',
                opacity: active ? 1 : 0.5, transition: 'opacity 0.1s, background 0.1s',
              }}>{st.name}</button>
            )
          })}
        </div>
      </PanelField>

      <PanelField label="Description">
        <textarea
          value={node.data.description ?? ''}
          onChange={e => onUpdate({ description: e.target.value })}
          rows={4} placeholder="Who or what is this? What role do they play?"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>

      <PanelField label="Importance">
        <EmphasisPicker value={node.data.sizeLevel ?? 3} onChange={v => onUpdate({ sizeLevel: v })} showHint />
      </PanelField>

      <PanelField label="Color">
        <ColorPicker value={node.data.color} onChange={color => onUpdate({ color: color || undefined })} />
      </PanelField>

      <PanelField label="Appearance">
        <AppearanceField
          value={node.data.profileImageUrl}
          onChange={url => onUpdate({ profileImageUrl: url || undefined })}
          color={node.data.color}
          onChangeColor={color => onUpdate({ color: color || undefined })}
          labelColor={node.data.labelColor}
          onChangeLabelColor={color => onUpdate({ labelColor: color || undefined })}
        />
      </PanelField>

      {resolvedFields.length > 0 && (
        <PanelField label="Details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolvedFields.map(f => {
              const rawValue = (node.data.fields ?? {})[f.id]
              if (f.isBlock) {
                const blocks = Array.isArray(rawValue) ? (rawValue as FieldBlock[]) : []
                return (
                  <div key={f.id}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#52525b', display: 'block', marginBottom: 4 }}>
                      {f.name}
                    </span>
                    <FieldBlockEditor
                      fieldName={f.name}
                      blocks={blocks}
                      onChange={newBlocks => onUpdate({ fields: { ...(node.data.fields ?? {}), [f.id]: newBlocks } })}
                    />
                  </div>
                )
              }
              const strValue = typeof rawValue === 'string' ? rawValue : ''
              return (
                <div key={f.id}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#52525b', display: 'block', marginBottom: 4 }}>
                    {f.name}
                  </span>
                  <input
                    value={strValue}
                    onChange={e => onUpdate({ fields: { ...(node.data.fields ?? {}), [f.id]: e.target.value } })}
                    placeholder={f.description ?? f.defaultValue ?? ''}
                    style={inputStyle}
                  />
                </div>
              )
            })}
          </div>
        </PanelField>
      )}

      {visibleConceptIds.length > 0 && (
        <PanelField label="Concepts">
          <ConceptObjectEditor
            node={node}
            conceptSchemas={conceptSchemas}
            allowedConceptIds={visibleConceptIds}
            onUpdate={onUpdate}
          />
        </PanelField>
      )}

      <PanelField label="Connections">
        <ConnectionsList relationships={relationships} />
      </PanelField>

      <PanelField label="Assets">
        <AssetEditor
          assets={assets}
          entityId={node.id}
          onAdd={onAddAsset}
          onUpdate={onUpdateAsset}
          onLink={onLinkAsset}
          onUnlink={onUnlinkAsset}
          onTogglePin={onToggleAssetPin}
        />
      </PanelField>

      {isRoot && (
        <PanelField label="Glow Color">
          <ColorPicker
            value={node.data.rootGlowColor}
            onChange={color => onUpdate({ rootGlowColor: color || undefined })}
          />
        </PanelField>
      )}

      <button onClick={onToggleRoot} style={rootToggleBtn(isRoot)}>
        {isRoot ? '◆ Root Node' : '◇ Set as Root'}
      </button>
    </>
  )
}

// ── System-mode entity panel ──────────────────────────────────────────────

function SystemEntityPanel({ node, schemaTypes, conceptSchemas, resolvedFields, relationships, onUpdate, isRoot, onToggleRoot, assets, onAddAsset, onUpdateAsset, onLinkAsset, onUnlinkAsset, onToggleAssetPin }: EntityPanelProps) {
  const entitySchemaType = schemaTypes.find(st => st.id === node.data.typeId)
  const allowedConceptIds = entitySchemaType?.conceptSchemaIds ?? []
  const existingConceptIds = Object.keys(node.data.concepts ?? {})
    .filter(k => (node.data.concepts?.[k]?.length ?? 0) > 0)
  const visibleConceptIds = [...new Set([...allowedConceptIds, ...existingConceptIds])]

  return (
    <>
      <h2 style={panelHeading}>Entity</h2>

      <PanelField label="Name">
        <input value={node.data.label} onChange={e => onUpdate({ label: e.target.value })} style={inputStyle} />
      </PanelField>

      <PanelField label="Type">
        <input
          value={node.data.entityType}
          onChange={e => {
            const match = schemaTypes.find(t => t.name.toLowerCase() === e.target.value.toLowerCase())
            onUpdate({ entityType: e.target.value, typeId: match?.id })
          }}
          placeholder="e.g. Deity, Faction, Artefact…"
          style={inputStyle}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          {schemaTypes.map(st => {
            const c = entityColors(st.name)
            const active = node.data.typeId === st.id
            return (
              <button key={st.id} onClick={() => onUpdate({ entityType: st.name, typeId: st.id })} style={{
                padding: '3px 9px', borderRadius: 999,
                border: `1.5px solid ${c.border}`,
                background: active ? c.bg : 'transparent', color: c.text,
                fontWeight: 600, fontSize: 11, cursor: 'pointer',
                opacity: active ? 1 : 0.5, transition: 'opacity 0.1s, background 0.1s',
              }}>{st.name}</button>
            )
          })}
        </div>
      </PanelField>

      <PanelField label="Description">
        <textarea
          value={node.data.description ?? ''}
          onChange={e => onUpdate({ description: e.target.value })}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>

      <PanelField label="Emphasis">
        <EmphasisPicker value={node.data.sizeLevel ?? 3} onChange={v => onUpdate({ sizeLevel: v })} />
      </PanelField>

      <PanelField label="Color">
        <ColorPicker value={node.data.color} onChange={color => onUpdate({ color: color || undefined })} />
      </PanelField>

      <PanelField label="Appearance">
        <AppearanceField
          value={node.data.profileImageUrl}
          onChange={url => onUpdate({ profileImageUrl: url || undefined })}
          color={node.data.color}
          onChangeColor={color => onUpdate({ color: color || undefined })}
          labelColor={node.data.labelColor}
          onChangeLabelColor={color => onUpdate({ labelColor: color || undefined })}
        />
      </PanelField>

      {resolvedFields.length > 0 && (
        <PanelField label="Fields">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolvedFields.map(f => {
              const rawValue = (node.data.fields ?? {})[f.id]
              const header = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: f.inherited ? '#a1a1aa' : '#52525b' }}>
                    {f.name}
                  </span>
                  {f.inherited && (
                    <span style={{ fontSize: 10, color: '#a1a1aa', background: '#f4f4f5', padding: '1px 5px', borderRadius: 4 }}>
                      ↑ {f.fromTypeName}
                    </span>
                  )}
                  {f.isBlock && (
                    <span style={{ fontSize: 10, color: '#6366f1', background: '#ede9fe', padding: '1px 5px', borderRadius: 4 }}>
                      blocks
                    </span>
                  )}
                </div>
              )
              if (f.isBlock) {
                const blocks = Array.isArray(rawValue) ? (rawValue as FieldBlock[]) : []
                return (
                  <div key={f.id}>
                    {header}
                    <FieldBlockEditor
                      fieldName={f.name}
                      blocks={blocks}
                      onChange={newBlocks => onUpdate({ fields: { ...(node.data.fields ?? {}), [f.id]: newBlocks } })}
                    />
                  </div>
                )
              }
              const strValue = typeof rawValue === 'string' ? rawValue : ''
              return (
                <div key={f.id}>
                  {header}
                  <input
                    value={strValue}
                    onChange={e => onUpdate({ fields: { ...(node.data.fields ?? {}), [f.id]: e.target.value } })}
                    placeholder={f.description ?? f.defaultValue ?? ''}
                    style={inputStyle}
                  />
                </div>
              )
            })}
          </div>
        </PanelField>
      )}

      {visibleConceptIds.length > 0 && (
        <PanelField label="Concepts">
          <ConceptObjectEditor
            node={node}
            conceptSchemas={conceptSchemas}
            allowedConceptIds={visibleConceptIds}
            onUpdate={onUpdate}
          />
        </PanelField>
      )}

      <PanelField label="Relationships">
        <ConnectionsList relationships={relationships} />
      </PanelField>

      <PanelField label="Assets">
        <AssetEditor
          assets={assets}
          entityId={node.id}
          onAdd={onAddAsset}
          onUpdate={onUpdateAsset}
          onLink={onLinkAsset}
          onUnlink={onUnlinkAsset}
          onTogglePin={onToggleAssetPin}
        />
      </PanelField>

      {isRoot && (
        <PanelField label="Glow Color">
          <ColorPicker
            value={node.data.rootGlowColor}
            onChange={color => onUpdate({ rootGlowColor: color || undefined })}
          />
        </PanelField>
      )}

      <button onClick={onToggleRoot} style={rootToggleBtn(isRoot)}>
        {isRoot ? '◆ Root Node' : '◇ Set as Root'}
      </button>
    </>
  )
}

// ── Story-mode edge panel ─────────────────────────────────────────────────

function StoryEdgePanel({ edge, nodes, onUpdateLabel, onUpdateDescription, onUpdateWhyItMatters = () => {}, onUpdateColor, onUpdateDirection }: StoryEdgePanelProps) {
  const direction = (edge.data?.direction as RelationshipDirection | undefined) ?? 'undirected'
  const sourceName = nodes.find(n => n.id === edge.source)?.data.label ?? edge.source
  const targetName = nodes.find(n => n.id === edge.target)?.data.label ?? edge.target
  return (
    <>
      <h2 style={panelHeading}>Connection</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{sourceName}</span>
        <span style={{ color: '#a1a1aa' }}>→</span>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{targetName}</span>
      </div>
      <PanelField label="What connects them?">
        <input
          autoFocus
          value={typeof edge.label === 'string' ? edge.label : ''}
          onChange={e => onUpdateLabel(e.target.value)}
          placeholder="e.g. Opposes, Loves, Created…"
          style={inputStyle}
        />
      </PanelField>
      <PanelField label="Direction">
        <DirectionControl direction={direction} onChange={onUpdateDirection} />
      </PanelField>
      <PanelField label="Notes">
        <textarea
          value={(edge.data?.description as string | undefined) ?? ''}
          onChange={e => onUpdateDescription(e.target.value)}
          rows={3} placeholder="Any context about this connection…"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>
      <PanelField label="Why this matters">
        <textarea
          value={(edge.data?.whyItMatters as string | undefined) ?? ''}
          onChange={e => onUpdateWhyItMatters(e.target.value)}
          rows={2} placeholder="What does this connection mean for the story?"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>
      <PanelField label="Color">
        <ColorPicker value={edge.data?.color as string | undefined} onChange={onUpdateColor} />
      </PanelField>
    </>
  )
}

// ── System-mode edge panel ────────────────────────────────────────────────

function SystemEdgePanel({ edge, nodes, relTypes, onUpdateLabel, onUpdateDescription, onUpdateColor, onUpdateTypeId, onClearTypeId, onUpdateDirection }: SystemEdgePanelProps) {
  const direction = (edge.data?.direction as RelationshipDirection | undefined) ?? 'undirected'
  const edgeTypeId = edge.data?.relationshipTypeId as string | undefined
  const resolvedType = edgeTypeId ? resolveRelationshipType(edgeTypeId, relTypes) : null
  const sourceName = nodes.find(n => n.id === edge.source)?.data.label ?? edge.source
  const targetName = nodes.find(n => n.id === edge.target)?.data.label ?? edge.target
  return (
    <>
      <h2 style={panelHeading}>Relationship</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{sourceName}</span>
        <span style={{ color: '#a1a1aa' }}>→</span>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{targetName}</span>
      </div>
      <PanelField label="Label">
        <input
          autoFocus
          value={typeof edge.label === 'string' ? edge.label : ''}
          onChange={e => onUpdateLabel(e.target.value)}
          placeholder="e.g. Opposes, Loves…"
          style={inputStyle}
        />
      </PanelField>
      <PanelField label="Direction">
        <DirectionControl direction={direction} onChange={onUpdateDirection} />
      </PanelField>
      <PanelField label="Type">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button
            onClick={onClearTypeId}
            style={{
              padding: '3px 9px', borderRadius: 999, border: '1.5px solid #d4d4d8',
              background: !edgeTypeId ? '#f4f4f5' : 'transparent',
              color: '#71717a', fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}
          >Custom</button>
          {relTypes.map(rt => {
            const active = edgeTypeId === rt.id
            const color = resolveRelationshipType(rt.id, relTypes)?.defaultColor ?? '#a1a1aa'
            return (
              <button key={rt.id} onClick={() => onUpdateTypeId(rt.id)} title={rt.description} style={{
                padding: '3px 9px', borderRadius: 999,
                border: `1.5px solid ${color}`,
                background: active ? `${color}22` : 'transparent', color,
                fontWeight: 600, fontSize: 11, cursor: 'pointer', transition: 'background 0.1s',
              }}>{rt.name}</button>
            )
          })}
        </div>
        {resolvedType?.description && (
          <span style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>{resolvedType.description}</span>
        )}
      </PanelField>
      <PanelField label="Notes">
        <textarea
          value={(edge.data?.description as string | undefined) ?? ''}
          onChange={e => onUpdateDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </PanelField>
      <PanelField label="Color">
        <ColorPicker value={edge.data?.color as string | undefined} onChange={onUpdateColor} />
        {!edge.data?.color && resolvedType?.defaultColor && (
          <span style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
            Using schema color — set a color above to override
          </span>
        )}
      </PanelField>
    </>
  )
}

// ── Asset inspector panel ─────────────────────────────────────────────────

type AssetInspectorProps = {
  asset: AssetData
  nodes: GraphNode[]
  onUpdate: (a: AssetData) => void
  onRemove: (id: string) => void
  onTogglePin: (id: string) => void
  onLink: (assetId: string, entityId: string) => void
  onUnlink: (assetId: string, entityId: string) => void
}

const ENTRY_TYPES_LIST: { value: import('./types').AssetEntryType; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Image' },
  { value: 'music', label: 'Music' },
  { value: 'document', label: 'Doc' },
  { value: 'custom', label: 'Custom' },
]

function makeEntryId() {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function AssetInspectorPanel({ asset, nodes, onUpdate, onRemove, onTogglePin, onLink, onUnlink }: AssetInspectorProps) {
  const [showLinkPicker, setShowLinkPicker] = useState(false)

  const linkedEntities = nodes.filter(n => n.type === 'circle' && asset.linkedEntityIds.includes(n.id))
  const unlinkableEntities = nodes.filter(n => n.type === 'circle' && !asset.linkedEntityIds.includes(n.id))

  const addEntry = (type: import('./types').AssetEntryType) => {
    onUpdate({ ...asset, entries: [...asset.entries, { id: makeEntryId(), type, label: '', value: '', isLinkified: false }] })
  }

  const updateEntry = (eid: string, updates: Partial<import('./types').AssetEntry>) => {
    onUpdate({
      ...asset,
      entries: asset.entries.map(e => {
        if (e.id !== eid) return e
        const merged = { ...e, ...updates }
        if ('value' in updates) merged.isLinkified = isUrl(merged.value)
        return merged
      }),
    })
  }

  const removeEntry = (eid: string) => {
    onUpdate({ ...asset, entries: asset.entries.filter(e => e.id !== eid) })
  }

  return (
    <>
      <h2 style={panelHeading}>Asset Container</h2>

      <PanelField label="Title">
        <input value={asset.title} onChange={e => onUpdate({ ...asset, title: e.target.value })} style={inputStyle} />
      </PanelField>

      <PanelField label={`Entries (${asset.entries.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {asset.entries.map(entry => (
            <div key={entry.id} style={{
              padding: '6px 8px', background: '#fff',
              border: '1px solid #e4e4e7', borderRadius: 5,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <select
                  value={entry.type}
                  onChange={e => updateEntry(entry.id, { type: e.target.value as import('./types').AssetEntryType })}
                  style={{ padding: '2px 4px', fontSize: 10, border: '1px solid #d4d4d8', borderRadius: 4, background: '#fff', color: '#18181b', outline: 'none' }}
                >
                  {ENTRY_TYPES_LIST.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input
                  value={entry.label}
                  onChange={e => updateEntry(entry.id, { label: e.target.value })}
                  placeholder="Label"
                  style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '4px 7px' }}
                />
                <button
                  onClick={() => removeEntry(entry.id)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '0 2px' }}
                >x</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  value={entry.value}
                  onChange={e => updateEntry(entry.id, { value: e.target.value })}
                  placeholder="URL or text"
                  style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '4px 7px' }}
                />
                {entry.type === 'music' && entry.isLinkified && (
                  <PlayButton url={entry.value} title={entry.label || asset.title} />
                )}
                {entry.isLinkified && (
                  <a href={entry.value} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: '#6366f1', whiteSpace: 'nowrap', textDecoration: 'none' }}>Open</a>
                )}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {ENTRY_TYPES_LIST.map(t => (
              <button key={t.value} onClick={() => addEntry(t.value)} style={{
                padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                border: '1px solid #e4e4e7', background: '#fff', color: '#52525b', cursor: 'pointer',
              }}>+ {t.label}</button>
            ))}
          </div>
        </div>
      </PanelField>

      <PanelField label="Linked Entities">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {linkedEntities.length === 0 && <span style={{ fontSize: 13, color: '#a1a1aa' }}>None</span>}
          {linkedEntities.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b', flex: 1 }}>{n.data.label}</span>
              <button onClick={() => onUnlink(asset.id, n.id)} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Unlink</button>
            </div>
          ))}
          {showLinkPicker ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px', background: '#f9fafb', borderRadius: 5, border: '1px solid #e4e4e7' }}>
              {unlinkableEntities.length === 0
                ? <span style={{ fontSize: 12, color: '#a1a1aa' }}>All entities linked</span>
                : unlinkableEntities.slice(0, 10).map(n => (
                  <button key={n.id} onClick={() => { onLink(asset.id, n.id); setShowLinkPicker(false) }} style={{
                    padding: '4px 8px', borderRadius: 4, textAlign: 'left', border: '1px solid #e4e4e7',
                    background: '#fff', color: '#18181b', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  }}>{n.data.label}</button>
                ))
              }
              <button onClick={() => setShowLinkPicker(false)} style={{ fontSize: 11, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-end' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowLinkPicker(true)} style={{
              padding: '4px 8px', borderRadius: 5, border: '1px dashed #d4d4d8', background: '#fafafa',
              color: '#71717a', fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'center',
            }}>+ Link Entity</button>
          )}
        </div>
      </PanelField>

      <button onClick={() => onTogglePin(asset.id)} style={rootToggleBtn(asset.isPinnedOnCanvas)}>
        {asset.isPinnedOnCanvas ? 'Unpin from Canvas' : 'Pin to Canvas'}
      </button>

      <button onClick={() => onRemove(asset.id)} style={{
        padding: '6px 12px', background: '#fff', color: '#dc2626',
        border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer',
        fontWeight: 600, fontSize: 12, width: '100%', transition: 'all 0.15s',
      }}>
        Delete Asset
      </button>
    </>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────

function EmphasisPicker({ value, onChange, showHint }: { value: SizeLevel; onChange: (v: SizeLevel) => void; showHint?: boolean }) {
  const activeLevel = SIZE_LEVELS.find(l => l.level === value)
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {SIZE_LEVELS.map(({ level, label, hint }) => {
          const active = value === level
          return (
            <button key={level} onClick={() => onChange(level)} title={hint} style={{
              padding: '3px 8px', borderRadius: 999,
              border: `1.5px solid ${active ? '#18181b' : '#d4d4d8'}`,
              background: active ? '#18181b' : 'transparent',
              color: active ? '#fff' : '#52525b',
              fontWeight: 600, fontSize: 11, cursor: 'pointer',
              transition: 'background 0.1s, color 0.1s, border-color 0.1s',
            }}>{label}</button>
          )
        })}
      </div>
      {showHint && activeLevel && (
        <span style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4, display: 'block' }}>
          {activeLevel.hint}
        </span>
      )}
    </div>
  )
}

function ConnectionsList({ relationships }: { relationships: RelationshipList }) {
  const { outgoing, incoming } = relationships
  if (outgoing.length === 0 && incoming.length === 0)
    return <span style={{ fontSize: 13, color: '#a1a1aa' }}>None yet</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {outgoing.map((r, i) => <RelChip key={i} direction="out" peer={r.peer} label={r.label} />)}
      {incoming.map((r, i) => <RelChip key={i} direction="in"  peer={r.peer} label={r.label} />)}
    </div>
  )
}

function AppearanceField({
  value, onChange, color, onChangeColor, labelColor, onChangeLabelColor,
}: {
  value?: string
  onChange: (url: string) => void
  color?: string
  onChangeColor: (color: string) => void
  labelColor?: string
  onChangeLabelColor: (color: string) => void
}) {
  const [previewFailed, setPreviewFailed] = useState(false)
  useEffect(() => { setPreviewFailed(false) }, [value])
  const showPreview = Boolean(value) && !previewFailed
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>Label Color</span>
        <ColorPicker value={labelColor} onChange={onChangeLabelColor} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>Profile Image URL</span>
        <input
          value={value ?? ''}
          onChange={e => {
            const url = e.target.value
            onChange(url)
            if (url && !color) onChangeColor('#ffffff')
          }}
          placeholder="https://…"
          style={inputStyle}
        />
        {value && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid #e4e4e7', flexShrink: 0,
              background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {showPreview
                ? <img src={value} alt="" onError={() => setPreviewFailed(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <span style={{ fontSize: 9, color: '#a1a1aa', textAlign: 'center', padding: 4 }}>
                    {previewFailed ? 'Failed' : '…'}
                  </span>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <button onClick={() => window.open(value, '_blank', 'noopener')} style={appearanceBtn}>
                Open Link
              </button>
              <button onClick={() => onChange('')} style={{ ...appearanceBtn, color: '#ef4444' }}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DirectionControl({ direction, onChange }: { direction: RelationshipDirection; onChange: (d: RelationshipDirection) => void }) {
  const opts: { value: RelationshipDirection; label: string; title: string }[] = [
    { value: 'undirected',        label: '—',  title: 'Undirected' },
    { value: 'directed',          label: '→',  title: 'Directed (A → B)' },
    { value: 'directed-reversed', label: '←',  title: 'Directed (B → A)' },
    { value: 'bidirectional',     label: '⇄', title: 'Bidirectional (A ⇄ B)' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {opts.map(opt => (
        <button
          key={opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '5px 0', fontFamily: 'inherit',
            border: `1.5px solid ${direction === opt.value ? '#7c3aed' : '#d4d4d8'}`,
            borderRadius: 6,
            background: direction === opt.value ? '#f3f0ff' : 'transparent',
            color: direction === opt.value ? '#5b21b6' : '#52525b',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function RelChip({ direction, peer, label }: { direction: 'in' | 'out'; peer: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 8px', background: '#fff',
      border: '1px solid #e4e4e7', borderRadius: 6,
      fontSize: 13, color: '#18181b',
    }}>
      <span style={{ fontWeight: 700, color: direction === 'out' ? '#6366f1' : '#f59e0b' }}>
        {direction === 'out' ? '→' : '←'}
      </span>
      <span style={{ fontWeight: 600 }}>{peer}</span>
      {label && <span style={{ color: '#71717a', marginLeft: 'auto', fontSize: 12 }}>{label}</span>}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const panelHeading: React.CSSProperties = {
  margin: 0, fontSize: 15, fontWeight: 700, color: '#18181b',
}

const backBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: '#fff', color: '#52525b',
  border: '1px solid #e4e4e7', borderRadius: 6,
  cursor: 'pointer', fontWeight: 600, fontSize: 13,
  transition: 'all 0.15s',
}

const toolbarBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: '#18181b', color: '#fff',
  border: 'none', borderRadius: 6,
  cursor: 'pointer', fontWeight: 600, fontSize: 13,
}

const topRightBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: '#fff', color: '#52525b',
  border: '1px solid #e4e4e7',
  borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  transition: 'all 0.15s',
}

const rootToggleBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  background: active ? '#18181b' : '#fff',
  color: active ? '#fff' : '#71717a',
  border: `1px solid ${active ? '#18181b' : '#d4d4d8'}`,
  borderRadius: 6, cursor: 'pointer',
  fontWeight: 600, fontSize: 12,
  width: '100%',
  transition: 'all 0.15s',
})

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #d4d4d8', borderRadius: 6,
  fontSize: 14, color: '#18181b', background: '#fff',
  width: '100%', boxSizing: 'border-box', outline: 'none',
}

const appearanceBtn: React.CSSProperties = {
  padding: '5px 10px', background: '#fff',
  border: '1px solid #d4d4d8', borderRadius: 6,
  fontSize: 12, color: '#3f3f46', cursor: 'pointer',
  fontWeight: 600, textAlign: 'left', width: '100%',
}

const dropdownMenu: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, marginTop: 4,
  background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180,
  zIndex: 20, overflow: 'hidden',
}

const dropdownItem: React.CSSProperties = {
  display: 'block', width: '100%', padding: '9px 14px',
  background: 'none', border: 'none', textAlign: 'left',
  fontSize: 13, fontWeight: 600, color: '#18181b',
  cursor: 'pointer',
}

const dropdownDivider: React.CSSProperties = {
  height: 1, background: '#e4e4e7', margin: '2px 0',
}
