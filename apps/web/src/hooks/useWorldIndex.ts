import { useMemo } from 'react'
import type { ProjectData } from '../projectStore'
import { buildWorldIndex, type WorldIndex } from '../worldIndex'

export function useWorldIndex(project: ProjectData): WorldIndex {
  const { nodes, edges } = project.graph
  const { assets } = project
  return useMemo(
    () => buildWorldIndex(project),
    // Rebuild when the underlying data changes, not on every project object re-creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges, assets],
  )
}
