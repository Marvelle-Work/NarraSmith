import { useRef, useCallback, useEffect } from 'react'
import { saveCanonicalState } from '../api/projects'
import { saveProjectStore } from '../projectStore'
import type { ProjectData, ProjectStore } from '../projectStore'
import { buildCanonicalState } from '../lib/canonicalState'
import { logger } from '../lib/logger'

export function useAutoSave(projectId: string, delay = 2000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<ProjectData | null>(null)
  const versionRef = useRef(0)
  const savingRef = useRef(false)

  const setVersion = useCallback((v: number) => { versionRef.current = v }, [])

  const doSave = useCallback(async (data: ProjectData) => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const canonical = buildCanonicalState(data)
      const notebooks = canonical.assets.filter(a => a.kind === 'notebook')

      logger.info('SYNC', 'Sending canonical save', {
        projectId,
        totalAssets: canonical.assets.length,
        notebookCount: notebooks.length,
        notebookIds: notebooks.map(n => n.id),
        version: versionRef.current,
      })

      const { version } = await saveCanonicalState(projectId, canonical, versionRef.current)
      versionRef.current = version
      logger.debug('SYNC', 'Canonical save completed', { projectId, version, notebookCount: notebooks.length })
    } catch (err) {
      logger.warn('SYNC', 'Canonical save failed — data preserved in localStorage', { err: String(err) })
    } finally {
      savingRef.current = false
    }
  }, [projectId])

  const save = useCallback((store: ProjectStore) => {
    saveProjectStore(store)

    const project = store.projects[projectId]
    if (!project) return

    pendingRef.current = project

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const data = pendingRef.current
      if (!data) return
      void doSave(data)
    }, delay)
  }, [projectId, delay, doSave])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const data = pendingRef.current
      if (data) {
        const canonical = buildCanonicalState(data)
        saveCanonicalState(projectId, canonical, versionRef.current).catch(() => {})
      }
    }
  }, [projectId])

  return { save, setVersion }
}
