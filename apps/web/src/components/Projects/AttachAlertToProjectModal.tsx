import { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { projectService } from '../../lib/projects/ProjectService'
import type { Project } from '../../lib/projects/types'
import { useAuth } from '../../contexts/AuthContext'

interface AttachAlertToProjectModalProps {
  alertId: string
  onClose: () => void
  onSuccess: () => void
}

export function AttachAlertToProjectModal({
  alertId,
  onClose,
  onSuccess,
}: AttachAlertToProjectModalProps) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    if (!user?.id) return
    try {
      setProjectsLoading(true)
      const data = await projectService.getUserProjects(user.id)
      setProjects(data)
    } catch (err) {
      console.error('Error loading projects:', err)
      setError('Erreur lors du chargement des projets')
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) {
      setError('Veuillez sélectionner un projet')
      return
    }
    if (!user?.id) {
      setError('Utilisateur non identifié')
      return
    }
    try {
      setLoading(true)
      setError(null)
      await projectService.addAlertToProject(selectedProjectId, alertId, user.id)
      onSuccess()
    } catch (err) {
      console.error('Error attaching alert to project:', err)
      setError('Erreur lors de l\'association de l\'alerte au projet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Attacher à un projet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {projectsLoading ? (
            <div className="text-center py-4">
              <p className="text-gray-500">Chargement des projets...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500">Aucun projet disponible</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {projects.map(project => (
                <label key={project.id} className="flex items-start gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded">
                  <input
                    type="radio"
                    name="project"
                    value={project.id}
                    checked={selectedProjectId === project.id}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{project.name}</p>
                    {project.description && (
                      <p className="text-sm text-gray-600">{project.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProjectId}
              className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg font-medium transition"
            >
              {loading ? 'Attachement...' : 'Attacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}