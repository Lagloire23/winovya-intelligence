// Sprint 7 — Panneau Notes (Phase 4/5). CRUD complet exclusivement via
// createOpportuniteCommercialService() (Sprint 6) — aucune écriture SQL
// directe, aucune règle métier recopiée ici (l'autorisation fine
// auteur/admin reste appliquée par la RLS existante ; ce composant ne
// fait qu'appeler le service et afficher son résultat ou son erreur).

import { FormEvent, useEffect, useState } from 'react'
import { Loader2, Pencil, Send, StickyNote, Trash2 } from 'lucide-react'
import type { CommercialService } from '../../lib/opportunities/commercial'
import type { NoteDto } from '../../lib/opportunities/commercial/types'
import { formatDateTime } from '../../lib/opportunities/uiHelpers'
import { translateError } from '../../lib/opportunities/errorMessages'
import { logDevError } from '../../lib/opportunities/devLog'
import { EmptyState } from '../common/States'

interface Props {
  opportuniteId: string
  commercialService: CommercialService
  currentUserId: string | null
  isAdmin: boolean
  canModify: boolean
  onActivity: () => void
}

export function NotesPanel({ opportuniteId, commercialService, currentUserId, isAdmin, canModify, onActivity }: Props) {
  const [notes, setNotes] = useState<NoteDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null)

  async function reload() {
    try {
      const list = await commercialService.listNotes(opportuniteId)
      setNotes(list)
    } catch (e) {
      logDevError({ screen: 'NotesPanel', operation: 'listNotes' }, e)
      setError(translateError(e, 'Erreur lors du chargement des notes.'))
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportuniteId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newContent.trim() || !currentUserId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await commercialService.createNote(opportuniteId, currentUserId, newContent.trim())
      setNewContent('')
      await reload()
      onActivity()
    } catch (e) {
      logDevError({ screen: 'NotesPanel', operation: 'createNote' }, e)
      setError(translateError(e, 'La création de la note a échoué.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(noteId: string) {
    if (!editContent.trim()) return
    setBusyNoteId(noteId)
    setError(null)
    try {
      await commercialService.updateNote(opportuniteId, noteId, editContent.trim())
      setEditingId(null)
      await reload()
      onActivity()
    } catch (e) {
      logDevError({ screen: 'NotesPanel', operation: 'updateNote' }, e)
      setError(translateError(e, 'La modification de la note a échoué.'))
    } finally {
      setBusyNoteId(null)
    }
  }

  async function handleDelete(noteId: string) {
    setBusyNoteId(noteId)
    setError(null)
    try {
      await commercialService.deleteNote(opportuniteId, noteId)
      await reload()
      onActivity()
    } catch (e) {
      logDevError({ screen: 'NotesPanel', operation: 'deleteNote' }, e)
      setError(translateError(e, 'La suppression de la note a échoué.'))
    } finally {
      setBusyNoteId(null)
    }
  }

  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-4 flex items-center gap-2">
        <StickyNote size={15} className="text-brand-primary" /> Notes internes
      </h2>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {canModify ? (
        <form onSubmit={handleCreate} className="flex items-start gap-2 mb-4">
          <label htmlFor="new-note-content" className="sr-only">
            Ajouter une note interne
          </label>
          <textarea
            id="new-note-content"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Ajouter une note interne…"
            rows={2}
            className="input-winovya flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={!newContent.trim() || submitting}
            aria-label="Envoyer la note"
            className="btn-primary h-fit px-3 py-2.5"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      ) : (
        <p className="text-xs text-[hsl(217,4%,46%)] mb-4">Opportunité archivée : ajout de notes désactivé.</p>
      )}

      {notes === null ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="Aucune note pour cette opportunité" />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => {
            const isOwn = note.auteurId === currentUserId
            const isEditing = editingId === note.id
            const isBusy = busyNoteId === note.id
            return (
              <li key={note.id} className="border border-[hsl(217,6%,90%)] dark:border-white/10 rounded-lg p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <label htmlFor={`edit-note-${note.id}`} className="sr-only">
                      Modifier le contenu de la note
                    </label>
                    <textarea
                      id={`edit-note-${note.id}`}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="input-winovya resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdate(note.id)}
                        disabled={isBusy || !editContent.trim()}
                        className="btn-secondary py-1 px-2.5 text-xs"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : 'Enregistrer'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-[hsl(217,4%,46%)] hover:text-brand-navy dark:hover:text-white">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-[hsl(217,10%,25%)] dark:text-gray-200 whitespace-pre-wrap">{note.contenu}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-[hsl(217,4%,55%)]">
                        {formatDateTime(note.createdAt)}
                        {note.updatedAt !== note.createdAt ? ' · modifiée' : ''}
                      </p>
                      {canModify && (isOwn || isAdmin) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingId(note.id)
                              setEditContent(note.contenu)
                            }}
                            className="text-[hsl(217,4%,55%)] hover:text-brand-primary transition focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none rounded"
                            title="Modifier"
                            aria-label="Modifier la note"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            disabled={isBusy}
                            className="text-[hsl(217,4%,55%)] hover:text-red-600 transition focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none rounded"
                            title="Supprimer"
                            aria-label="Supprimer la note"
                          >
                            {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
