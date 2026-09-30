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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-brand-neutral">
          <h2 className="text-lg font-bold text-brand-navy">Rattacher à un projet</h2>
          <button
            onClick={onClose}
            className="text-brand-navy/60 hover:text-brand-navy transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Projects List */}
          <div>
            <label className="block text-sm font-semibold text-brand-navy mb-3">
              Sélectionner un projet
            </label>

            {projectsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-primary border-r-transparent"></div>
              </div>
            ) : projects.length === 0 ? (
              <div className="p-4 bg-brand-neutral/30 rounded-lg text-brand-navy/60 text-sm text-center">
                Aucun projet disponible. <br />
                <a href="/dashboard/mes-projets" className="text-brand-primary hover:underline">
                  Créez-en un d'abord
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-start gap-3 p-3 border border-brand-neutral rounded-lg cursor-pointer hover:bg-brand-neutral/10 transition"
                  >
                    <input
                      type="radio"
                      name="project"
                      value={project.id}
                      checked={selectedProjectId === project.id}
                      onChange={() => setSelectedProjectId(project.id)}
                      className="mt-1"
                      disabled={loading}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-navy">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-brand-navy/60 mt-0.5 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-brand-neutral">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-brand-neutral text-brand-navy font-medium hover:bg-brand-neutral/30 transition disabled:opacity-50"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={loading || projects.length === 0}
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-r-transparent"></div>}
              {loading ? 'Rattachement...' : 'Rattacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
