import { supabase } from '../supabaseClient'
import type { Project, ProjectAlert, ProjectFile } from './types'

export const projectService = {
  // Create a new project
  async createProject(data: { name: string; description?: string; alertIds: string[] }, userId: string): Promise<Project> {
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Associate alerts
    if (data.alertIds.length > 0) {
      const alertAssociations = data.alertIds.map((alertId) => ({
        project_id: project.id,
        alert_id: alertId,
        created_at: new Date().toISOString(),
      }))

      const { error: alertError } = await supabase
        .from('project_alerts')
        .insert(alertAssociations)

      if (alertError) throw alertError
    }

    return project as Project
  },

  // Get user projects
  async getUserProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as Project[]
  },

  // Get project details
  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return (data || null) as Project | null
  },

  // Get project alerts
  async getProjectAlerts(projectId: string): Promise<ProjectAlert[]> {
    const { data, error } = await supabase
      .from('project_alerts')
      .select('*, alerts(*)')
      .eq('project_id', projectId)

    if (error) throw error
    return (data || []) as ProjectAlert[]
  },

  // Add alert to project
  async addAlertToProject(projectId: string, alertId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_alerts')
      .insert({
        project_id: projectId,
        alert_id: alertId,
        created_at: new Date().toISOString(),
      })

    if (error) throw error
  },

  // Remove alert from project
  async removeAlertFromProject(projectId: string, alertId: string): Promise<void> {
    const { error } = await supabase
      .from('project_alerts')
      .delete()
      .eq('project_id', projectId)
      .eq('alert_id', alertId)

    if (error) throw error
  },

  // Get available alerts for project
  async getAvailableAlerts(): Promise<any[]> {
    const { data, error } = await supabase
      .from('alerts')
      .select('id, name')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Add file to project
  async addFileToProject(projectId: string, file: File, userId: string): Promise<ProjectFile> {
    const fileExtension = file.name.split('.').pop()
    const fileName = `${projectId}/${Date.now()}.${fileExtension}`

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: fileRecord, error: dbError } = await supabase
      .from('project_files')
      .insert({
        project_id: projectId,
        file_name: file.name,
        storage_path: fileName,
        file_size: file.size,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) throw dbError
    return (fileRecord || {}) as ProjectFile
  },

  // Get project files
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as ProjectFile[]
  },

  // Delete project
  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) throw error
  },

  // Update project
  async updateProject(projectId: string, data: Partial<Project>): Promise<Project> {
    const { data: updated, error } = await supabase
      .from('projects')
      .update(data)
      .eq('id', projectId)
      .select()
      .single()

    if (error) throw error
    return (updated || {}) as Project
  },
}
