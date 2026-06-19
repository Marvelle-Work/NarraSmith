import { useState, useEffect, useCallback } from 'react'
import * as api from '../api/projects'
import { makeDefaultProject } from '../projectStore'

export type CloudProject = api.ProjectMeta

export function useCloudProjects() {
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const list = await api.listProjects()
      setProjects(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const create = useCallback(async (name: string): Promise<string> => {
    const meta = await api.createProject(name)
    const projectData = makeDefaultProject(meta.id, name)
    await api.saveProjectData(meta.id, projectData, 0)
    await refresh()
    return meta.id
  }, [refresh])

  const rename = useCallback(async (id: string, name: string) => {
    await api.updateProject(id, { name })
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await api.deleteProject(id)
    await refresh()
  }, [refresh])

  const duplicate = useCallback(async (id: string) => {
    const { projectData: sourceData } = await api.getProjectData(id)
    if (!sourceData) throw new Error('Project data not found')
    const meta = await api.createProject(`${sourceData.name} Copy`)
    const now = new Date().toISOString()
    const newData = { ...sourceData, id: meta.id, name: `${sourceData.name} Copy`, createdAt: now, updatedAt: now }
    await api.saveProjectData(meta.id, newData, 0)
    await refresh()
  }, [refresh])

  return { projects, loading, error, refresh, create, rename, remove, duplicate }
}
