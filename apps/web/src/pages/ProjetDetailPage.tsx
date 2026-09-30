import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus, Upload, Calendar, AlertCircle } from 'lucide-react'
import { projectService } from '../lib/projects/ProjectService'
import type { ProjectWithDetails } from '../lib/projects/types'
import { useAuth } from '../contexts/AuthContext'

export function ProjetDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (id) {
      loadProjectDetails()
    }
  }, [id])

  const loadProjectDetails = async () => {
    if (!id) return

    try {
      setLoading(true)
      setError(null)
      const data = await projectService.getProjectDetails(id)
      if (data) {
        setProject(data)
      } else {
        setError('Projet non trouvé')
      }
    } catch (err) {
      console.error('Error loading project details:', err)
      setError('Erreur lors du chargement du projet')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!project || !user?.id) return

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      return
    }

    try {
      setDeleting(true)
      await projectService.deleteProject(project.id, user.id)
      navigate('/dashboard/mes-projets')
    } catch (err) {
      console.error('Error deleting project:', err)
      setError('Erreur lors de la suppression du projet')
      setDeleting(false)
    }
  }

  const handleRemoveAlert = async (alertId: string) => {
    if (!project || !user?.id) return

    try {
      await projectService.removeAlertFromProject(project.id, alertId, user.id)
      await loadProjectDetails()
    } catch (err) {
      console.error('Error removing alert:', err)
      setError('Erreur lors du retrait de l\'alerte')
    }
  }

  const handleRemoveFile = async (attachmentId: string, filePath: string) => {
    if (!project || !user?.id) return

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce fichier ?')) {
      return
    }

    try {
      await projectService.removeFileFromProject(project.id, attachmentId, filePath, user.id)
      await loadProjectDetails()
    } catch (err) {
      console.error('Error removing file:', err)
      setError('Erreur lors de la suppression du fichier')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-r-transparent mb-3"></div>
          <p className="text-brand-navy/60">Chargement du projet...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/dashboard/mes-projets')}
          className="flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 transition"
        >
          <ArrowLeft size={18} />
          Retour aux projets
        </button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || 'Projet non trouvé'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <button
            onClick={() => navigate('/dashboard/mes-projets')}
            className="flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 transition mb-4"
          >
            <ArrowLeft size={18} />
            Retour aux projets
          </button>
          <h1 className="text-3xl font-bold text-brand-navy">{project.name}</h1>
          {project.description && (
            <p className="text-brand-navy/60 mt-2">{project.description}</p>
          )}
          <p className="text-sm text-brand-navy/50 mt-2">
            <Calendar size={14} className="inline mr-1" />
            Créé le {formatDate(project.created_at)}
          </p>
        </div>
        <button
          onClick={handleDeleteProject}
          disabled={deleting}
          className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-2"
        >
          <Trash2 size={16} />
          Supprimer
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Alerts Section */}
      <div className="bg-white rounded-lg border border-brand-neutral p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-navy">
            Alertes associées ({project.alertCount})
          </h2>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition">
            <Plus size={14} />
            Ajouter une alerte
          </button>
        </div>

        {project.alerts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-brand-navy/60">Aucune alerte associée à ce projet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {project.alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 border border-brand-neutral/50 rounded-lg hover:bg-brand-neutral/10 transition"
              >
                <div>
                  <p className="text-sm font-medium text-brand-navy">Alerte ID: {alert.alert_id}</p>
                  <p className="text-xs text-brand-navy/50">
                    Ajoutée par {alert.added_by} le {formatDate(alert.added_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveAlert(alert.alert_id)}
                  className="text-brand-navy/60 hover:text-red-500 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachments Section */}
      <div className="bg-white rounded-lg border border-brand-neutral p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-navy">
            Pièces jointes ({project.fileCount})
          </h2>
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition cursor-pointer">
            <Upload size={14} />
            Ajouter un fichier
            <input type="file" className="hidden" />
          </label>
        </div>

        {project.attachments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-brand-navy/60">Aucun fichier attaché à ce projet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {project.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border border-brand-neutral/50 rounded-lg hover:bg-brand-neutral/10 transition"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-primary hover:underline truncate block"
                  >
                    {attachment.file_name}
                  </a>
                  <p className="text-xs text-brand-navy/50 mt-1">
                    {formatFileSize(attachment.file_size)} • Ajouté par {attachment.uploaded_by} le{' '}
                    {formatDate(attachment.uploaded_at)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleRemoveFile(attachment.id, `${project.id}/${attachment.file_name}`)
                  }
                  className="text-brand-navy/60 hover:text-red-500 transition ml-4 flex-shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Log Section */}
      {project.auditLog.length > 0 && (
        <div className="bg-white rounded-lg border border-brand-neutral p-6">
          <h2 className="text-lg font-semibold text-brand-navy mb-4">Historique des activités</h2>
          <div className="space-y-3">
            {project.auditLog.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm border-b border-brand-neutral/30 pb-3 last:border-b-0">
                <div className="flex-1">
                  <p className="font-medium text-brand-navy capitalize">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-brand-navy/50">
                    Par {log.action_by} • {formatDate(log.action_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
