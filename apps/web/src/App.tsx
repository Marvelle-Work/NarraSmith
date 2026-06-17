import { ReactFlowProvider } from '@xyflow/react'
import { GraphEditor } from './GraphEditor'

export default function App() {
  return (
    <ReactFlowProvider>
      <GraphEditor />
    </ReactFlowProvider>
  )
}
