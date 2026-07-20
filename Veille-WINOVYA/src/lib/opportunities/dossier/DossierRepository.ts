// Sprint 4 — Repository de lecture/écriture pour la consolidation du
// dossier d'opportunité. Pure I/O, aucun calcul (voir
// DossierEnrichmentService.ts pour toute la logique).
//
// Ce repository ne lit et n'écrit QUE dans veille.opportunites (colonnes
// Sprint 4 additives) ; il lit aussi opportunite_alertes/alertes pour
// reconstituer les signaux, et compte (sans jamais écrire)
// opportunite_preuves / opportunite_decideurs. Il n'insère et ne
// supprime jamais de ligne dans opportunite_preuves, opportunite_decideurs
// ou opportunite_alertes — aucun risque de duplication introduit par ce
// sprint (Phase 5/6).

import { supabase as defaultSupabase } from '../../supabase'
import { DossierEnrichmentService } from './DossierEnrichmentService'
import type {
  CorrelationConfidence,
  DossierConsolidationInput,
  DossierConsolidationResult,
  DossierSignalInput,
  PhaseProjet,
} from './types'

type AppSupabaseClient = typeof defaultSupabase

/** Ligne de lecture de la vue veille.opportunite_dossier (Sprint 4). */
export interface OpportuniteDossierRow {
  opportuniteId: string
  entrepriseId: string
  titre: string
  resumeMetier: string | null
  statutOpportunite: string
  typeOpportunite: string | null
  entiteCible: string | null
  geographie: string | null
  secteur: string | null
  phaseProjet: PhaseProjet | null
  budgetIdentifie: number | null
  budgetSource: string | null
  budgetFiabilite: string | null
  budgetEstime: number | null
  niveauConfiance: string | null
  statutEnrichissement: string
  raisons: string[]
  nombreSignaux: number
  datePremierSignal: string | null
  dateDernierSignal: string | null
  derniereConsolidationAt: string | null
  updatedAt: string
  nombrePreuves: number
  nombreDecideurs: number
}

/**
 * Défense en profondeur (correctif écran blanc, voir même fonction dans
 * OpportuniteQueryRepository.ts) : garantit un tableau de chaînes réel,
 * jamais un objet de traçabilité legacy qui ferait planter un rendu React
 * en aval.
 */
function sanitizeRaisons(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export class DossierRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  /**
   * Rassemble tout ce dont DossierEnrichmentService.consolidate() a
   * besoin, sans rien calculer ici. Lève une erreur si l'opportunité
   * n'existe pas.
   */
  async getConsolidationInput(opportuniteId: string): Promise<DossierConsolidationInput> {
    const { data: opp, error: oppError } = await this.client
      .from('opportunites')
      .select(
        'id, titre, entite_cible, type_opportunite, geographie, nombre_signaux, date_premier_signal, date_dernier_signal, score_details'
      )
      .eq('id', opportuniteId)
      .maybeSingle()
    if (oppError) throw oppError
    if (!opp) throw new Error(`OPPORTUNITE_NOT_FOUND: ${opportuniteId}`)

    const { data: links, error: linksError } = await this.client
      .from('opportunite_alertes')
      .select('alerte_id')
      .eq('opportunite_id', opportuniteId)
    if (linksError) throw linksError
    const alerteIds = (links ?? []).map((l) => l.alerte_id as string)

    let signaux: DossierSignalInput[] = []
    if (alerteIds.length > 0) {
      const { data: alertes, error: alertesError } = await this.client
        .from('alertes')
        .select('id, montant, categorie_veille, date_detection, reference_officielle, lien_source_url, name')
        .in('id', alerteIds)
      if (alertesError) throw alertesError
      signaux = (alertes ?? []).map((a) => ({
        alerteId: String(a.id),
        montant: (a.montant as number | null) ?? null,
        categorieVeille: (a.categorie_veille as string | null) ?? null,
        dateDetection: String(a.date_detection),
        referenceOfficielle: (a.reference_officielle as string | null) ?? null,
        lienSourceUrl: (a.lien_source_url as string | null) ?? null,
        name: String(a.name ?? ''),
      }))
    }

    const { count: nombrePreuves, error: preuvesError } = await this.client
      .from('opportunite_preuves')
      .select('id', { count: 'exact', head: true })
      .eq('opportunite_id', opportuniteId)
    if (preuvesError) throw preuvesError

    const { count: nombreDecideurs, error: decideursError } = await this.client
      .from('opportunite_decideurs')
      .select('opportunite_id', { count: 'exact', head: true })
      .eq('opportunite_id', opportuniteId)
    if (decideursError) throw decideursError

    const scoreDetails = (opp.score_details as Record<string, unknown> | null) ?? null
    const correlation = scoreDetails?.correlation as { confidence?: CorrelationConfidence } | undefined
    const anticipation = scoreDetails?.anticipation as { etapeProjet?: PhaseProjet } | undefined

    return {
      opportuniteId: String(opp.id),
      titre: String(opp.titre),
      entiteCible: (opp.entite_cible as string | null) ?? null,
      typeOpportunite: (opp.type_opportunite as string | null) ?? null,
      geographie: (opp.geographie as string | null) ?? null,
      nombreSignaux: Number(opp.nombre_signaux ?? signaux.length),
      nombrePreuves: nombrePreuves ?? 0,
      nombreDecideurs: nombreDecideurs ?? 0,
      datePremierSignal: (opp.date_premier_signal as string | null) ?? null,
      dateDernierSignal: (opp.date_dernier_signal as string | null) ?? null,
      correlationConfidence: correlation?.confidence ?? null,
      etapeProjet: anticipation?.etapeProjet ?? null,
      signaux,
    }
  }

  /** Écrit le résultat de consolidation calculé par DossierEnrichmentService. */
  async saveConsolidation(opportuniteId: string, result: DossierConsolidationResult): Promise<void> {
    const { error } = await this.client
      .from('opportunites')
      .update({
        phase_projet: result.phaseProjet,
        budget_identifie: result.budgetIdentifie,
        budget_source: result.budgetSource,
        budget_fiabilite: result.budgetFiabilite,
        niveau_confiance: result.niveauConfiance,
        raisons: result.raisons,
        resume: result.resumeMetier,
        statut_enrichissement: result.statutEnrichissement,
        derniere_consolidation_at: new Date().toISOString(),
      })
      .eq('id', opportuniteId)
    if (error) throw error
  }

  /**
   * Ne touche à rien d'autre : en cas d'échec de consolidation (Phase 6),
   * on marque uniquement le statut, on ne perd et on n'invente aucune
   * donnée existante.
   */
  async markConsolidationFailed(opportuniteId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunites')
      .update({
        statut_enrichissement: 'failed',
        derniere_consolidation_at: new Date().toISOString(),
      })
      .eq('id', opportuniteId)
    if (error) throw error
  }

  /** Lecture pratique de la vue veille.opportunite_dossier (démonstration, tests, futur frontend). */
  async getDossier(opportuniteId: string): Promise<OpportuniteDossierRow | null> {
    const { data, error } = await this.client
      .from('opportunite_dossier')
      .select('*')
      .eq('opportunite_id', opportuniteId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      opportuniteId: String(data.opportunite_id),
      entrepriseId: String(data.entreprise_id),
      titre: String(data.titre),
      resumeMetier: (data.resume_metier as string | null) ?? null,
      statutOpportunite: String(data.statut_opportunite),
      typeOpportunite: (data.type_opportunite as string | null) ?? null,
      entiteCible: (data.entite_cible as string | null) ?? null,
      geographie: (data.geographie as string | null) ?? null,
      secteur: (data.secteur as string | null) ?? null,
      phaseProjet: (data.phase_projet as PhaseProjet | null) ?? null,
      budgetIdentifie: (data.budget_identifie as number | null) ?? null,
      budgetSource: (data.budget_source as string | null) ?? null,
      budgetFiabilite: (data.budget_fiabilite as string | null) ?? null,
      budgetEstime: (data.budget_estime as number | null) ?? null,
      niveauConfiance: (data.niveau_confiance as string | null) ?? null,
      statutEnrichissement: String(data.statut_enrichissement),
      raisons: Array.isArray(data.raisons) ? (data.raisons as string[]) : [],
      nombreSignaux: Number(data.nombre_signaux ?? 0),
      datePremierSignal: (data.date_premier_signal as string | null) ?? null,
      dateDernierSignal: (data.date_dernier_signal as string | null) ?? null,
      derniereConsolidationAt: (data.derniere_consolidation_at as string | null) ?? null,
      updatedAt: String(data.updated_at),
      nombrePreuves: Number(data.nombre_preuves ?? 0),
      nombreDecideurs: Number(data.nombre_decideurs ?? 0),
    }
  }
}

/**
 * Orchestration (lecture -> calcul pur -> écriture), séparée de
 * process_alert_opportunity / OpportunityEngineService (Sprint 2/2.1,
 * non modifiés). Appel manuel/à la demande dans ce sprint — pas de
 * nouveau trigger automatique (voir docs/opportunity-dossier.md §9 :
 * aucune nécessité démontrée pour l'automatiser dès maintenant).
 */
export class OpportunityDossierService {
  constructor(private readonly repository: DossierRepository = new DossierRepository()) {}

  async consolidateDossier(opportuniteId: string): Promise<DossierConsolidationResult> {
    try {
      const input = await this.repository.getConsolidationInput(opportuniteId)
      const result = DossierEnrichmentService.consolidate(input)
      await this.repository.saveConsolidation(opportuniteId, result)
      return result
    } catch (err) {
      // Phase 6 (même principe que Sprint 3) : ne jamais perdre l'opportunité
      // existante. On marque l'échec et on relève l'erreur pour que
      // l'appelant sache que la consolidation n'a pas abouti.
      await this.repository.markConsolidationFailed(opportuniteId)
      throw err
    }
  }
}
