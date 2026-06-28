import { apiFetch, API_BASE } from './client'
import type { ProjectData } from '../projectStore'
import type { CanonicalProjectState } from '../lib/canonicalState'

export type ProjectMeta = {
  id: string
  owner_id: string
  name: string
  description: string | null
  created_at: string | null
  updated_at: string | null
  share_id: string | null
  visibility: string
}

export async function listProjects(): Promise<ProjectMeta[]> {
  return apiFetch<ProjectMeta[]>('/projects')
}

export async function createProject(name: string): Promise<ProjectMeta> {
  return apiFetch<ProjectMeta>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function updateProject(id: string, updates: { name?: string; description?: string }): Promise<ProjectMeta> {
  return apiFetch<ProjectMeta>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' })
}

export async function getProjectData(id: string): Promise<{ projectData: ProjectData | null; version: number }> {
  return apiFetch<{ projectData: ProjectData | null; version: number }>(`/projects/${id}/data`)
}

export async function saveProjectData(
  id: string,
  data: ProjectData,
  version: number,
): Promise<{ version: number }> {
  return apiFetch<{ version: number }>(`/projects/${id}/data`, {
    method: 'PUT',
    body: JSON.stringify({ projectData: data, version }),
  })
}

export async function saveCanonicalState(
  id: string,
  state: CanonicalProjectState,
  version: number,
): Promise<{ version: number }> {
  return apiFetch<{ version: number }>(`/projects/${id}/canonical`, {
    method: 'PUT',
    body: JSON.stringify({ state, version }),
  })
}

export async function shareProject(id: string): Promise<{ shareId: string }> {
  return apiFetch<{ shareId: string }>(`/projects/${id}/share`, { method: 'POST' })
}

export async function unshareProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}/unshare`, { method: 'POST' })
}

export type ImportStats = {
  projectId: string
  nodeTypesCreated: number
  relationshipTypesCreated: number
  conceptTypesCreated: number
  nodesCreated: number
  relationshipsCreated: number
}

export async function importProjectToCloud(jsonPayload: unknown): Promise<ImportStats> {
  return apiFetch<ImportStats>('/import-project', {
    method: 'POST',
    body: JSON.stringify(jsonPayload),
  })
}

export async function getSharedProject(shareId: string): Promise<ProjectData> {
  const res = await fetch(`${API_BASE}/shared/${shareId}`)
  if (!res.ok) throw new Error('Project not found or not shared')
  return res.json()
}
