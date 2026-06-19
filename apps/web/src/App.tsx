import { useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphEditor } from './GraphEditor'
import { ProjectDashboard } from './ProjectDashboard'
import { loadProjectStore, saveProjectStore, type ProjectStore } from './projectStore'

type View = { kind: 'dashboard' } | { kind: 'editor'; projectId: string }

export default function App() {
  const [store, setStore] = useState<ProjectStore>(() => loadProjectStore())
  const [view, setView] = useState<View>({ kind: 'dashboard' })

  const handleStoreChange = useCallback((next: ProjectStore) => {
    setStore(next)
    saveProjectStore(next)
  }, [])

  const handleOpenProject = useCallback((projectId: string) => {
    setView({ kind: 'editor', projectId })
  }, [])

  const handleBackToDashboard = useCallback(() => {
    setStore(loadProjectStore())
    setView({ kind: 'dashboard' })
  }, [])

  if (view.kind === 'dashboard') {
    return (
      <ProjectDashboard
        store={store}
        onStoreChange={handleStoreChange}
        onOpenProject={handleOpenProject}
      />
    )
  }

  return (
    <ReactFlowProvider>
      <GraphEditor
        key={view.projectId}
        projectId={view.projectId}
        onBackToDashboard={handleBackToDashboard}
      />
    </ReactFlowProvider>
  )
}
