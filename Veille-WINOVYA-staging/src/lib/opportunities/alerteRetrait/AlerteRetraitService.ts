// Sprint 11B — Service métier : retrait et réintégration logique d'une
// alerte liée à une opportunité (P11.1 §retrait). Suit le même patron
// que CommercialService.ts (Sprint 6) : validations de domaine
// explicites avant tout appel au repository, jamais de mutation
// générique exposée au Frontend.
//
// Autorisation : déléguée entièrement à la RLS existante ("admin write
// opportunite_alertes", Sprint 1, inchangée) — voir docs/sprint-11b-
// alerte-retrait.md pour la justification (veille.profile_role n'a que
// deux valeurs, admin/member ; aucune notion d'"utilisateur autorisé"
// plus fine n'existe aujourd'hui dans ce schéma). Ce service ne
// duplique donc AUCUNE vérification isAdmin/entreprise : si la RLS
// refuse l'écriture, AlerteRetraitRepository la détecte (0 ligne
// affectée) et ce service lève RetraitNonAppliqueError.

import type { AlerteRetraitRepository } from './AlerteRetraitRepository'
import type { RecalculationRepository } from '../recalculation/RecalculationRepository'
import {
  assertRetraitInputValide,
  AlerteDejaActiveError,
  AlerteDejaRetireeError,
  LienAlerteOpportuniteIntrouvableError,
  OpportuniteIntrouvableError,
  RetraitNonAppliqueError,
  type RetraitInput,
} from './types'

export class AlerteRetraitService {
  /**
   * Dépendances toujours explicites (aucune valeur par défaut) — voir
   * index.ts pour la construction avec les vraies classes I/O.
   */
  constructor(
    private readonly repository: AlerteRetraitRepository,
    private readonly recalculationRepository: RecalculationRepository
  ) {}

  /**
   * Retire logiquement une alerte d'une opportunité. L'alerte globale
   * (veille.alertes) n'est jamais touchée : seule la ligne de liaison
   * opportunite_alertes passe à is_active=false, avec motif obligatoire.
   */
  async retirerAlerteDeOpportunite(
    opportuniteId: string,
    alerteId: string,
    actorId: string,
    input: RetraitInput
  ): Promise<void> {
    assertRetraitInputValide(input)

    const existe = await this.repository.opportuniteExiste(opportuniteId)
    if (!existe) throw new OpportuniteIntrouvableError(opportuniteId)

    const lien = await this.repository.getLien(opportuniteId, alerteId)
    if (!lien) throw new LienAlerteOpportuniteIntrouvableError(opportuniteId, alerteId)
    if (!lien.isActive) throw new AlerteDejaRetireeError(opportuniteId, alerteId)

    const commentaire = input.commentaire?.trim() || null
    const modifiees = await this.repository.retirer(opportuniteId, alerteId, actorId, input.motif, commentaire)
    if (modifiees === 0) {
      throw new RetraitNonAppliqueError(opportuniteId, alerteId)
    }

    // Sprint 11C préparation : ne recalcule rien ici, marque seulement
    // l'opportunité comme à reconsolider (voir RecalculationRepository).
    await this.recalculationRepository.requestOpportunityRecalculation(opportuniteId)
  }

  /**
   * Réintègre une alerte précédemment retirée. Le rôle de corrélation
   * (Sprint 11A) n'a jamais été modifié par le retrait : il est donc
   * "restauré" trivialement (il n'a jamais changé). L'historique du
   * retrait original reste intégralement dans
   * veille.opportunite_activity_log (append-only) — jamais effacé ici.
   */
  async reintegrerAlerteDansOpportunite(opportuniteId: string, alerteId: string): Promise<void> {
    const existe = await this.repository.opportuniteExiste(opportuniteId)
    if (!existe) throw new OpportuniteIntrouvableError(opportuniteId)

    const lien = await this.repository.getLien(opportuniteId, alerteId)
    if (!lien) throw new LienAlerteOpportuniteIntrouvableError(opportuniteId, alerteId)
    if (lien.isActive) throw new AlerteDejaActiveError(opportuniteId, alerteId)

    const modifiees = await this.repository.reintegrer(opportuniteId, alerteId)
    if (modifiees === 0) {
      throw new RetraitNonAppliqueError(opportuniteId, alerteId)
    }

    await this.recalculationRepository.requestOpportunityRecalculation(opportuniteId)
  }
}
