import { useState, useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphEditor } from './GraphEditor'
import { ProjectDashboard } from './ProjectDashboard'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { SignupPage } from './auth/SignupPage'
import { SharedProjectViewer } from './SharedProjectViewer'
import { useLocalDataMigration } from './hooks/useLocalDataMigration'
import { AudioProvider } from './AudioContext'
import { MiniPlayer } from './MiniPlayer'

type View =
  | { kind: 'login' }
  | { kind: 'signup' }
  | { kind: 'dashboard' }
  | { kind: 'editor'; projectId: string }
  | { kind: 'shared'; shareId: string }

function AppInner() {
  const { user, loading } = useAuth()
  const [view, setView] = useState<View>({ kind: 'dashboard' })

  useLocalDataMigration(user?.id)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('share')
    if (shareId) setView({ kind: 'shared', shareId })
  }, [])

  if (view.kind === 'shared') {
    return (
      <SharedProjectViewer
        shareId={view.shareId}
        onBack={() => {
          window.history.replaceState({}, '', window.location.pathname)
          setView({ kind: 'dashboard' })
        }}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#71717a' }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    if (view.kind === 'signup') {
      return <SignupPage onSwitchToLogin={() => setView({ kind: 'login' })} />
    }
    return <LoginPage onSwitchToSignup={() => setView({ kind: 'signup' })} />
  }

  const handleOpenProject = (projectId: string) => setView({ kind: 'editor', projectId })
  const handleBackToDashboard = () => setView({ kind: 'dashboard' })

  if (view.kind === 'editor') {
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

  return <ProjectDashboard onOpenProject={handleOpenProject} />
}

export default function App() {
  return (
    <AudioProvider>
      <AuthProvider>
        <AppInner />
        <MiniPlayer />
      </AuthProvider>
    </AudioProvider>
  )
}
