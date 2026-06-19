import { useEffect, useRef } from 'react'
import { loadProjectStore } from '../projectStore'
import * as api from '../api/projects'

const MIGRATION_KEY = 'narrasmith-cloud-migrated'

export function useLocalDataMigration(userId: string | undefined) {
  const ranRef = useRef(false)

  useEffect(() => {
    if (!userId || ranRef.current) return
    if (localStorage.getItem(MIGRATION_KEY)) return
    ranRef.current = true

    async function migrate() {
      const store = loadProjectStore()
      const localProjects = Object.values(store.projects)
      if (localProjects.length === 0) {
        localStorage.setItem(MIGRATION_KEY, 'true')
        return
      }

      const cloudProjects = await api.listProjects()
      if (cloudProjects.length > 0) {
        localStorage.setItem(MIGRATION_KEY, 'true')
        return
      }

      for (const project of localProjects) {
        try {
          const meta = await api.createProject(project.name)
          const migrated = { ...project, id: meta.id }
          await api.saveProjectData(meta.id, migrated, 0)
        } catch (err) {
          console.error(`Failed to migrate project "${project.name}":`, err)
        }
      }

      localStorage.setItem(MIGRATION_KEY, 'true')
    }

    migrate().catch(console.error)
  }, [userId])
}
