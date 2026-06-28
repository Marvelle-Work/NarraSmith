import { useRef, useCallback, useEffect } from 'react'
import { syncProjectData } from '../api/projects'
import { saveProjectStore } from '../projectStore'
import type { ProjectData, ProjectStore } from '../projectStore'
import { logger } from '../lib/logger'

export function useAutoSave(projectId: string, delay = 2000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<ProjectData | null>(null)
  const versionRef = useRef(0)
  const savingRef = useRef(false)

  const setVersion = useCallback((v: number) => { versionRef.current = v }, [])

  const save = useCallback((store: ProjectStore) => {
    saveProjectStore(store)

    const project = store.projects[projectId]
    if (!project) return

    pendingRef.current = project

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const data = pendingRef.current
      if (!data || savingRef.current) return

      savingRef.current = true
      try {
        const { version } = await syncProjectData(
          projectId,
          {
            graph: data.graph,
            entitySchema: data.entitySchema,
            relSchema: data.relSchema,
            conceptSchema: data.conceptSchema ?? [],
            assets: data.assets,
          },
          versionRef.current,
        )
        versionRef.current = version
        logger.debug('SYNC', 'Cloud sync completed', { projectId, version })
      } catch (err) {
        logger.warn('SYNC', 'Cloud sync failed — data preserved in localStorage', { err: String(err) })
      } finally {
        savingRef.current = false
      }
    }, delay)
  }, [projectId, delay])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const data = pendingRef.current
      if (data) {
        syncProjectData(
          projectId,
          {
            graph: data.graph,
            entitySchema: data.entitySchema,
            relSchema: data.relSchema,
            conceptSchema: data.conceptSchema ?? [],
            assets: data.assets,
          },
          versionRef.current,
        ).catch(() => {})
      }
    }
  }, [projectId])

  return { save, setVersion }
}
