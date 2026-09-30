import { useState, useEffect } from 'react'
import { X, Upload, AlertCircle } from 'lucide-react'
import { projectService } from '../../lib/projects/ProjectService'
import type { Alert } from '../../lib/projects/types'
import { useAuth } from '../../contexts/AuthContext'

interface CreateProjectModalProps {
  onClose: () => void
  onProjectCreated: () => void
}

export function CreateProjectModal({ onClose, onProjectCreated }: CreateProjectModalProps) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAvailableAlerts()
  }, [])

  const loadAvailableAlerts = async () => {
    try {
      setAlertsLoading(true)
      const data = await projectService.getAvailableAlerts()
      setAlerts(data)
    } catch (err) {
      console.error('Error loading alerts:', err)
      setError('Erreur lors du chargement des alertes')
    } finally {
      setAlertsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles([...files, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Le nom du projet est requis')
      return
    }

    if (!user?.id) {
      setError('Utilisateur non identifié')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Create the project
      const project = await projectService.createProject(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          alertIds: selectedAlerts,
        },
        user.id
      )

      // Upload files if any
      if (files.length > 0) {
        for (const file of files) {
          try {
            await projectService.addFileToProject(project.id, file, user.id)
          } catch (err) {
            console.error(`Failed to upload file ${file.name}:`, err)
          }
        }
      }

      onProjectCreated()
    } catch (err) {
      console.error('Error creating project:', err)
      setError('Erreur lors de la création du projet')
    } finally {
      setLoading(false)
    }
  }

  const toggleAlert = (alertId: string) => {
    setSelectedAlerts((prev) =>
      prev.includes(alertId)
        ? prev.filter((id) => id !== alertId)
        : [...prev, alertId]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-brand-neutral">
          <h2 className="text-xl font-bold text-brand-navy">Créer un projet</h2>
          <button
            onClick={onClose}
            className="text-brand-navy/60 hover:text-brand-navy transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-sm font-semibold text-brand-navy mb-2">
              Nom du projet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entrez le nom du projet"
              className="w-full px-4 py-2 border border-brand-neutral rounded-lg text-brand-navy placeholder-brand-navy/40 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              required
              disabled={loading}
            />
          </div>

          {/* Project Description */}
          <div>
            <label className="block text-sm font-semibold text-brand-navy mb-2">
              Description <span className="text-brand-navy/40 text-xs font-normal">(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le projet..."
              rows={3}
              className="w-full px-4 py-2 border border-brand-neutral rounded-lg text-brand-navy placeholder-brand-navy/40 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
              disabled={loading}
            />
          </div>

          {/* Alerts Selection */}
          <div>
            <label className="block text-sm font-semibold text-brand-navy mb-2">
              Alertes à associer <span className="text-brand-navy/40 text-xs font-normal">(optionnel)</span>
            </label>
            {alertsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-primary border-r-transparent"></div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-4 bg-brand-neutral/30 rounded-lg text-brand-navy/60 text-sm">
                Aucune alerte disponible
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-brand-neutral rounded-lg p-3">
                {alerts.map((alert) => (
                  <label key={alert.id} className="flex items-center gap-3 cursor-pointer hover:bg-brand-neutral/20 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedAlerts.includes(alert.id)}
                      onChange={() => toggleAlert(alert.id)}
                      className="w-4 h-4 rounded border-brand-neutral text-brand-primary focus:ring-brand-primary cursor-pointer"
                      disabled={loading}
                    />
                    <span className="text-sm text-brand-navy">{alert.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-brand-navy mb-2">
              Pièces jointes <span className="text-brand-navy/40 text-xs font-normal">(optionnel)</span>
            </label>
            <div className="border-2 border-dashed border-brand-neutral rounded-lg p-6 text-center hover:border-brand-primary hover:bg-brand-primary/5 transition cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
                disabled={loading}
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <Upload size={24} className="mx-auto mb-2 text-brand-navy/60" />
                <p className="text-sm font-medium text-brand-navy">Cliquez pour télécharger des fichiers</p>
                <p className="text-xs text-brand-navy/60 mt-1">ou glissez-déposez vos fichiers</p>
              </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-brand-neutral/20 rounded-lg"
                  >
                    <span className="text-sm text-brand-navy truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-brand-navy/60 hover:text-red-500 transition"
                      disabled={loading}
                    >
                      <X size={16} />
                    </button>
                  </div>
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
              disabled={loading}
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-r-transparent"></div>}
              {loading ? 'Création...' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
