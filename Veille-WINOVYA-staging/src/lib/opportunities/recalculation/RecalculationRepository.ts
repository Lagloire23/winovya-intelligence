// Sprint 11B — Point d'entrée UNIQUE de demande de recalcul d'une
// opportunité (préparation Sprint 11C, P11.1 §7 du prompt Sprint 11B).
//
// Ce module ne calcule RIEN : il se contente de marquer l'opportunité
// comme nécessitant un nouveau passage de consolidation, en réutilisant
// le drapeau existant `statut_enrichissement = 'pending'` (Sprint 4,
// inchangé) déjà lu par OpportuniteQueryService.needsConsolidation()
// (Sprint 5, inchangé) lors de la prochaine lecture du dossier. Aucune
// nouvelle colonne, aucune nouvelle table : on réutilise strictement le
// mécanisme de fraîcheur déjà en place.
//
// Sprint 11C branchera ici sa vraie logique de recalcul (nouveaux
// niveaux de confiance P11.1, nouveau résumé, nouveaux besoins/offres) :
// le point d'entrée `requestOpportunityRecalculation` restera le même
// nom/signature, seul son contenu interne évoluera.

import { supabase as defaultSupabase } from '../../supabase'

type AppSupabaseClient = typeof defaultSupabase

export class RecalculationRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  /**
   * Marque l'opportunité comme à reconsolider. Idempotent : si déjà
   * 'pending', l'UPDATE ne modifie aucune ligne (aucune erreur pour
   * autant — un no-op silencieux est le comportement attendu ici).
   * Ne modifie jamais niveau_confiance, raisons, résumé, budget : ces
   * champs restent inchangés tant que la consolidation paresseuse
   * (Sprint 4/5, inchangée) ne les recalcule pas réellement à la
   * prochaine lecture.
   */
  async requestOpportunityRecalculation(opportuniteId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunites')
      .update({ statut_enrichissement: 'pending' })
      .eq('id', opportuniteId)
      .neq('statut_enrichissement', 'pending')
    if (error) throw error
  }
}
