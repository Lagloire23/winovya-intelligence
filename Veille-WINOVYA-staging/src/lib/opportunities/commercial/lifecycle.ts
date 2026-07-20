// Sprint 6 — Règles métier centralisées du cycle de vie commercial
// (Phase 2/7). Module PUR (aucun accès Supabase, aucune donnée
// fabriquée) : toute décision de transition ou de modification passe
// EXCLUSIVEMENT par les fonctions ci-dessous — jamais recopiées ailleurs
// (CommercialService.ts les appelle, ne les réimplémente jamais).

import type { StatutOpportunite } from './types'

/**
 * Graphe de transitions autorisées (Phase 2). Choix documentés
 * (docs/opportunity-commercial-domain.md §3) :
 *   - ARCHIVED est un puits (aucune sortie) : "une opportunité archivée
 *     ne peut plus être modifiée" (Phase 7) s'applique aussi bien au
 *     statut qu'aux notes/assignation (voir canModify ci-dessous).
 *   - WON ne peut aller que vers ARCHIVED : "une opportunité gagnée ne
 *     peut plus redevenir NEW" (Phase 7), généralisé à tout retour en
 *     arrière.
 *   - LOST, symétriquement, ne peut aller que vers ARCHIVED (pas de
 *     réouverture automatique dans ce MVP — limitation assumée,
 *     documentée).
 *   - ARCHIVED est atteignable depuis N'IMPORTE quel état (échappatoire
 *     toujours disponible), sauf depuis lui-même.
 */
const ALLOWED_TRANSITIONS: Record<StatutOpportunite, readonly StatutOpportunite[]> = {
  NEW: ['QUALIFYING', 'LOST', 'ARCHIVED'],
  QUALIFYING: ['QUALIFIED', 'LOST', 'ARCHIVED'],
  QUALIFIED: ['PROPOSAL', 'LOST', 'ARCHIVED'],
  PROPOSAL: ['WON', 'LOST', 'ARCHIVED'],
  WON: ['ARCHIVED'],
  LOST: ['ARCHIVED'],
  ARCHIVED: [],
}

/** Les 7 états du cycle de vie Sprint 6, dans un ordre stable (utile pour l'UI future / les tests). */
export const LIFECYCLE_STATES: readonly StatutOpportunite[] = [
  'NEW', 'QUALIFYING', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST', 'ARCHIVED',
]

export function isKnownLifecycleState(value: string): value is StatutOpportunite {
  return (LIFECYCLE_STATES as readonly string[]).includes(value)
}

/** Erreur métier dédiée (jamais une Error générique) pour que l'appelant distingue une transition invalide d'une erreur technique. */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
    reason: string
  ) {
    super(`Transition invalide de "${from}" vers "${to}" : ${reason}`)
    this.name = 'InvalidTransitionError'
  }
}

/**
 * Décision pure (Phase 2/7). Ne lève jamais d'exception : retourne
 * true/false. `current` est typé `string` (pas `StatutOpportunite`) car
 * il peut légitimement contenir une valeur héritée hors cycle de vie
 * Sprint 6 (ex. `IN_PROGRESS`) — voir isValidTransition ci-dessous pour
 * le traitement de ce cas.
 */
export function isValidTransition(current: string, target: StatutOpportunite): boolean {
  if (!isKnownLifecycleState(current)) return false
  if (current === target) return false
  return ALLOWED_TRANSITIONS[current].includes(target)
}

/** Variante qui lève une InvalidTransitionError explicite (message précis pour chaque cas, jamais un message générique). */
export function assertValidTransition(current: string, target: StatutOpportunite): void {
  if (!isKnownLifecycleState(current)) {
    throw new InvalidTransitionError(
      current,
      target,
      'l\'état courant n\'appartient pas au cycle de vie Sprint 6 (valeur héritée, ex. IN_PROGRESS) — transition refusée par sécurité, intervention manuelle requise'
    )
  }
  if (current === target) {
    throw new InvalidTransitionError(current, target, 'transition vers le même état, aucune opération à effectuer')
  }
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new InvalidTransitionError(
      current,
      target,
      `transitions autorisées depuis "${current}" : ${ALLOWED_TRANSITIONS[current].join(', ') || '(aucune, état terminal)'}`
    )
  }
}

/**
 * Phase 7 : "une opportunité archivée ne peut plus être modifiée".
 * Généralisé à toute modification (statut, assignation, notes) — pas
 * seulement au statut lui-même. Utilisé par CommercialService avant
 * toute écriture.
 */
export function canModify(current: string): boolean {
  return current !== 'ARCHIVED'
}
