import { ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const nodes = [
  {
    id: '1',
    position: { x: 100, y: 100 },
    data: { label: 'Ignia' },
  },
  {
    id: '2',
    position: { x: 400, y: 100 },
    data: { label: 'Abraxas' },
  },
]

const edges = [
  {
    id: 'e1',
    source: '1',
    target: '2',
    label: 'Opposes',
  },
]

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView />
    </div>
  )
}
