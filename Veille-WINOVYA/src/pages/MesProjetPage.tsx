import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Calendar, FileText } from 'lucide-react'
import { projectService } from '../lib/projects/ProjectService'
import type { Project } from '../lib/projects/types'
import { CreateProjectModal } from '../components/Projects/CreateProjectModal'
import { useAuth } from '../contexts/AuthContext'

export function MesProjetPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [user?.id])

  const loadProjects = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)
      const data = await projectService.getUserProjects(user.id)
      setProjects(data)
    } catch (err) {
      console.error('Error loading projects:', err)
      setError('Erreur lors du chargement des projets')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectCreated = () => {
    setShowCreateModal(false)
    loadProjects()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy">Mes projets</h1>
          <p className="text-sm text-brand-navy/60 mt-1">
            Organisez et gérez vos projets et alertes
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition"
        >
          <Plus size={18} />
          Créer un projet
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-r-transparent mb-3"></div>
            <p className="text-brand-navy/60">Chargement des projets...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 border-2 border-dashed border-brand-neutral rounded-lg">
          <FolderOpen className="mx-auto mb-4 text-brand-navy/40" size={48} />
          <h3 className="text-lg font-semibold text-brand-navy mb-2">Aucun projet pour le moment</h3>
          <p className="text-sm text-brand-navy/60 mb-6">
            Créez votre premier projet pour commencer à organiser vos alertes
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition"
          >
            <Plus size={16} />
            Créer un projet
          </button>
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/dashboard/mes-projets/${project.id}`)}
              className="p-6 border border-brand-neutral rounded-lg hover:border-brand-primary hover:shadow-md transition text-left"
            >
              <div className="flex items-start justify-between mb-4">
                <FolderOpen size={24} className="text-brand-primary" />
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-primary/10 text-brand-primary">
                  Voir →
                </span>
              </div>

              <h3 className="font-semibold text-brand-navy mb-2 line-clamp-2">
                {project.name}
              </h3>

              {project.description && (
                <p className="text-sm text-brand-navy/60 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-brand-navy/60 pt-4 border-t border-brand-neutral/50">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(project.created_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
    </div>
  )
}
