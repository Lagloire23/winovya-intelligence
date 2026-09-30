import { supabase } from '../supabaseClient'

export const projectRepository = {
  async create(project: { user_id: string; name: string; description?: string }) {
    return supabase.from('projects').insert(project).select().single()
  },

  async findById(id: string) {
    return supabase.from('projects').select('*').eq('id', id).single()
  },

  async findByUserId(userId: string) {
    return supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  },

  async update(id: string, updates: any) {
    return supabase.from('projects').update(updates).eq('id', id).select().single()
  },

  async delete(id: string) {
    return supabase.from('projects').delete().eq('id', id)
  },

  async addAlert(projectId: string, alertId: string) {
    return supabase
      .from('project_alerts')
      .insert({ project_id: projectId, alert_id: alertId, created_at: new Date().toISOString() })
      .select()
      .single()
  },

  async removeAlert(projectId: string, alertId: string) {
    return supabase.from('project_alerts').delete().eq('project_id', projectId).eq('alert_id', alertId)
  },

  async getAlerts(projectId: string) {
    return supabase.from('project_alerts').select('*, alerts(id, name)').eq('project_id', projectId)
  },

  async getFiles(projectId: string) {
    return supabase.from('project_files').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  },

  async addFile(file: { project_id: string; file_name: string; storage_path: string; file_size: number }) {
    return supabase.from('project_files').insert(file).select().single()
  },
}
