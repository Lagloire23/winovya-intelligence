// Sprint 6 — Service d'orchestration du domaine commercial (Phase 6/7).
// Compose lifecycle.ts (règles pures, jamais recopiées) + CommercialRepository
// (I/O pur). Point d'entrée métier unique pour : lecture/changement de
// statut, assignation/désassignation, CRUD des notes, lecture du journal.
//
// Comme OpportuniteQueryService (Sprint 5), les dépendances I/O ne sont
// importées qu'en TYPE (`import type`) et sont toujours explicites
// (aucune valeur par défaut de constructeur) : ce fichier reste testable
// sans environnement Supabase réel. La construction réelle se fait
// exclusivement via createOpportuniteCommercialService() (index.ts).

import type { StatutOpportunite } from './types'
import { assertValidTransition, canModify } from './lifecycle'
import type { CommercialRepository } from './CommercialRepository'
import type { ActivityLogEntryDto, AssignmentDto, NoteDto, StatutChangeResult } from './types'

/** Erreur métier dédiée : une opportunité archivée (Phase 7) ne peut plus être modifiée, quelle que soit l'opération tentée. */
export class OpportuniteArchivedError extends Error {
  constructor(public readonly opportuniteId: string) {
    super(`Opportunité ${opportuniteId} archivée : aucune modification (statut, assignation, note) n'est autorisée.`)
    this.name = 'OpportuniteArchivedError'
  }
}

export class OpportuniteNotFoundError extends Error {
  constructor(public readonly opportuniteId: string) {
    super(`Opportunité ${opportuniteId} introuvable.`)
    this.name = 'OpportuniteNotFoundError'
  }
}

export class NoteNotFoundError extends Error {
  constructor(public readonly noteId: string) {
    super(`Note ${noteId} introuvable.`)
    this.name = 'NoteNotFoundError'
  }
}

export class CommercialService {
  constructor(private readonly repository: CommercialRepository) {}

  // --- Statut (Phase 2/6) -------------------------------------------------

  /** Lecture du statut (Phase 6). Ne duplique pas les DTO Sprint 5 : lecture minimale dédiée au domaine commercial. */
  async getStatut(opportuniteId: string): Promise<string> {
    const statut = await this.repository.getStatut(opportuniteId)
    if (statut === null) throw new OpportuniteNotFoundError(opportuniteId)
    return statut
  }

  /**
   * Changement de statut contrôlé (Phase 2/6/7) : lit le statut courant,
   * valide la transition via lifecycle.assertValidTransition (jamais
   * recopiée), écrit uniquement si valide. La règle "opportunité
   * archivée non modifiable" est un cas particulier du graphe de
   * transitions lui-même (ARCHIVED n'a aucune sortie) : aucune
   * vérification redondante nécessaire ici pour le statut.
   */
  async changeStatut(opportuniteId: string, target: StatutOpportunite): Promise<StatutChangeResult> {
    const current = await this.repository.getStatut(opportuniteId)
    if (current === null) throw new OpportuniteNotFoundError(opportuniteId)
    assertValidTransition(current, target)
    await this.repository.updateStatut(opportuniteId, target)
    return { from: current as StatutOpportunite, to: target, changedAt: new Date().toISOString() }
  }

  // --- Assignation (Phase 3/6/7) ------------------------------------------

  async getAssignment(opportuniteId: string): Promise<AssignmentDto> {
    const assignment = await this.repository.getAssignment(opportuniteId)
    if (assignment === null) throw new OpportuniteNotFoundError(opportuniteId)
    return assignment
  }

  async assign(opportuniteId: string, profileId: string): Promise<AssignmentDto> {
    await this.assertModifiable(opportuniteId)
    await this.repository.assign(opportuniteId, profileId)
    return this.getAssignment(opportuniteId)
  }

  async unassign(opportuniteId: string): Promise<AssignmentDto> {
    await this.assertModifiable(opportuniteId)
    await this.repository.unassign(opportuniteId)
    return this.getAssignment(opportuniteId)
  }

  // --- Notes (Phase 4/6/7) -------------------------------------------------

  async listNotes(opportuniteId: string): Promise<NoteDto[]> {
    return this.repository.listNotes(opportuniteId)
  }

  async createNote(opportuniteId: string, auteurId: string, contenu: string): Promise<NoteDto> {
    await this.assertModifiable(opportuniteId)
    return this.repository.createNote(opportuniteId, auteurId, contenu)
  }

  async updateNote(opportuniteId: string, noteId: string, contenu: string): Promise<NoteDto> {
    await this.assertModifiable(opportuniteId)
    const existing = await this.repository.getNote(noteId)
    if (!existing || existing.opportuniteId !== opportuniteId) throw new NoteNotFoundError(noteId)
    return this.repository.updateNote(noteId, contenu)
  }

  /** Suppression logique (Phase 4/5) : jamais physique. Autorisation fine (auteur/admin) déléguée à la policy RLS existante, jamais recopiée ici. */
  async deleteNote(opportuniteId: string, noteId: string): Promise<NoteDto> {
    await this.assertModifiable(opportuniteId)
    const existing = await this.repository.getNote(noteId)
    if (!existing || existing.opportuniteId !== opportuniteId) throw new NoteNotFoundError(noteId)
    return this.repository.softDeleteNote(noteId)
  }

  // --- Journal (Phase 5/6) --------------------------------------------------

  /** Lecture seule : ce service n'écrit jamais dans le journal (alimenté uniquement par les triggers SQL, voir CommercialRepository). */
  async getActivityLog(opportuniteId: string): Promise<ActivityLogEntryDto[]> {
    return this.repository.getActivityLog(opportuniteId)
  }

  // --- Interne ---------------------------------------------------------------

  private async assertModifiable(opportuniteId: string): Promise<void> {
    const statut = await this.repository.getStatut(opportuniteId)
    if (statut === null) throw new OpportuniteNotFoundError(opportuniteId)
    if (!canModify(statut)) throw new OpportuniteArchivedError(opportuniteId)
  }
}
