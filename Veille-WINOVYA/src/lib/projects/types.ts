export interface Project {
  id: string
  user_id: string
  name: string
  description?: string | null
  created_at: string
  updated_at?: string
}

export interface ProjectAlert {
  id: string
  project_id: string
  alert_id: string
  created_at: string
  alerts?: Alert
}

export interface ProjectFile {
  id: string
  project_id: string
  file_name: string
  storage_path: string
  file_size: number
  created_at: string
}

export interface Alert {
  id: string
  name: string
  [key: string]: any
}
