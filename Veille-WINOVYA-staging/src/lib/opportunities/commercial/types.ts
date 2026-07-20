// Sprint 6 — Contrats TypeScript du domaine métier commercial des
// opportunités (états, assignation, notes, journal d'activité).
//
// Aucune IA, aucune donnée fabriquée : tout ici est soit lu tel quel
// (statut, assignation, notes, journal), soit une décision de transition
// pure et déterministe (lifecycle.ts). N'étend et ne modifie AUCUN type
// du Sprint 5 (query/types.ts) : le domaine commercial est un module
// frère, indépendant, jamais un remplacement.

/**
 * Cycle de vie Sprint 6 (Phase 2). Le type SQL `veille.statut_opportunite`
 * (Sprint 1) contient aussi la valeur historique `IN_PROGRESS`, conservée
 * pour compatibilité mais volontairement ABSENTE de cette union : elle
 * n'appartient pas au cycle de vie Sprint 6 (voir lifecycle.ts et
 * docs/opportunity-commercial-domain.md §2 pour la justification
 * complète). Aucun code Sprint 6 ne produit ni n'attend cette valeur.
 */
export type StatutOpportunite =
  | 'NEW'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST'
  | 'ARCHIVED'

/** Assignation d'une opportunité à un utilisateur (Phase 3). Volontairement minimal : pas de rôle, pas de notion d'équipe. */
export interface AssignmentDto {
  assignedTo: string | null
  assignedAt: string | null
}

/** Note interne (Phase 4). `deletedAt` non-null = suppression logique ; jamais supprimée physiquement. */
export interface NoteDto {
  id: string
  opportuniteId: string
  auteurId: string
  contenu: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ActivityEventType =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'

/** Entrée du journal d'activité (Phase 5). `details` a une forme libre par `eventType` (voir migration). */
export interface ActivityLogEntryDto {
  id: string
  opportuniteId: string
  eventType: ActivityEventType
  acteurId: string | null
  details: Record<string, unknown>
  createdAt: string
}

/** Résultat d'une tentative de changement de statut (Phase 2/7) : jamais une exception silencieuse. */
export interface StatutChangeResult {
  from: StatutOpportunite | null
  to: StatutOpportunite
  changedAt: string
}
