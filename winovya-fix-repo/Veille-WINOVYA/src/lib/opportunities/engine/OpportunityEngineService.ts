// Sprint 2 / 2.1 — Service de traitement (orchestration uniquement).
//
// Architecture cible (Phase 4, revue de stabilisation Sprint 2.1) :
//
//   Edge Function
//     -> OpportunityEngineService   (orchestration, aucun calcul, aucune
//                                     requête SQL directe)
//         -> CorrelationEngine      (pur : génère la correlation_key)
//         -> ScoreEngine            (pur : calcule les 4 indicateurs)
//         -> AlertContextRepository (lecture : alerte/entreprise/
//                                     pertinence/décideurs — hors
//                                     périmètre opportunités)
//         -> OpportunityRepository  (écriture : RPC idempotente +
//                                     persistance des scores)
//
// Ce fichier ne contient plus aucun `this.client.from(...)` : toute
// requête Supabase passe par l'un des deux repositories injectés.
// CorrelationEngine et ScoreEngine ne reçoivent jamais de client
// Supabase — ils sont strictement purs.
//
// Aucune IA. Les 7 sous-scores d'adéquation et l'étape de projet sont
// des ENTRÉES fournies par l'appelant (voir ProcessAlertOpportunityInput)
// — ce service ne les invente ni ne les devine.
//
// Sécurité : l'appel RPC et la mise à jour finale des scores nécessitent
// le rôle service_role (EXECUTE retiré à anon et authenticated sur la
// fonction Postgres). Ce service est donc conçu pour être invoqué
// server-side avec un client construit à partir de la clé service role
// (voir supabase/functions/process-alert-opportunity/index.ts) — un
// appel avec le client frontend (clé anon) échouera de façon sûre
// (permission refusée) au moment de l'appel RPC.

import { supabase as defaultSupabase } from '../../supabase'
import { OpportunityRepository } from '../OpportunityRepository'
import { AlertContextRepository } from './AlertContextRepository'
import { CorrelationEngine } from './CorrelationEngine'
import { ScoreEngine } from './ScoreEngine'
import { SCORE_VERSION } from './scoringConfig'
import type { ProcessAlertOpportunityInput, ProcessAlertOpportunityResult, OpportunityIndicators, ScoreDetails } from './types'

type AppSupabaseClient = typeof defaultSupabase

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (v && v.trim().length > 0) return v
  }
  return null
}

export class OpportunityEngineService {
  private readonly opportunityRepository: OpportunityRepository
  private readonly alertContextRepository: AlertContextRepository

  constructor(client: AppSupabaseClient = defaultSupabase) {
    this.opportunityRepository = new OpportunityRepository(client)
    this.alertContextRepository = new AlertContextRepository(client)
  }

  async processAlertOpportunity(input: ProcessAlertOpportunityInput): Promise<ProcessAlertOpportunityResult> {
    // 1-2. Charger l'alerte et vérifier son existence + celle de l'entreprise.
    const alerte = await this.alertContextRepository.getAlerte(input.alerteId)
    if (!alerte) throw new Error(`ALERTE_NOT_FOUND: ${input.alerteId}`)

    const entrepriseExists = await this.alertContextRepository.entrepriseExists(input.entrepriseId)
    if (!entrepriseExists) throw new Error(`ENTREPRISE_NOT_FOUND: ${input.entrepriseId}`)

    // 3. Vérifier la pertinence pour l'entreprise concernée.
    const isRelevant = await this.alertContextRepository.isAlerteRelevantForEntreprise(input.alerteId, input.entrepriseId)
    if (!isRelevant) {
      throw new Error(`ALERTE_NOT_RELEVANT_FOR_ENTREPRISE: alerte=${input.alerteId} entreprise=${input.entrepriseId}`)
    }

    // Décideurs déjà liés à l'alerte (lecture pure, idempotente en aval).
    const decideurIds = await this.alertContextRepository.listDecideurIdsForAlerte(input.alerteId)

    // 4. Métadonnées de corrélation : priorité à ce qui est explicitement
    // fourni par l'appelant, puis dérivation depuis les champs réels de
    // l'alerte (adapté au schéma réel — aucune colonne inventée).
    const entiteCible = firstNonEmpty(input.correlationMetadata?.entiteCible, alerte.acteurEntite)
    const typeOpportunite = firstNonEmpty(input.correlationMetadata?.typeOpportunite, alerte.typeOpportunite[0] ?? null)
    const secteur = firstNonEmpty(input.correlationMetadata?.secteur, null)
    const geographie = firstNonEmpty(
      input.correlationMetadata?.geographie,
      alerte.communeCollectivite,
      alerte.departement,
      alerte.region[0] ?? null,
      alerte.pays
    )

    const correlation = CorrelationEngine.generateCorrelationKey({
      entrepriseId: input.entrepriseId,
      alerteId: input.alerteId,
      entiteCible,
      typeOpportunite,
      geographie,
    })

    // Score d'adéquation et valeur d'anticipation : calculs purs, sans
    // dépendance à l'état existant de l'opportunité, donc calculables
    // avant tout accès concurrent à la base.
    const adequationScore = ScoreEngine.computeAdequationScore(input.subScores)
    const anticipationScore = ScoreEngine.computeAnticipationScore(input.etapeProjet)

    const titre = input.titre ?? firstNonEmpty(alerte.name, alerte.resume, alerte.referenceOfficielle) ?? `Opportunité — ${input.alerteId}`

    // 5-11. Find-or-create atomique + liaisons + recalcul des agrégats
    // réels, délégués à la fonction Postgres transactionnelle (via
    // OpportunityRepository — aucun accès direct à Supabase ici).
    const rpcResult = await this.opportunityRepository.processAlertOpportunityRpc({
      alerteId: input.alerteId,
      entrepriseId: input.entrepriseId,
      correlationKey: correlation.key,
      titre,
      entiteCible,
      typeOpportunite,
      secteur,
      geographie,
      decideurIds,
      preuveSource: alerte.referenceOfficielle,
      preuveCitation: alerte.resume,
      preuveUrl: alerte.lienSourceUrl,
    })

    const dateSignal = new Date(alerte.dateDetection)
    const datePremier = rpcResult.datePremierSignal ? new Date(rpcResult.datePremierSignal) : dateSignal
    const dateDernier = rpcResult.dateDernierSignal ? new Date(rpcResult.dateDernierSignal) : dateSignal
    const spanDays = Math.max(0, Math.round((dateDernier.getTime() - datePremier.getTime()) / (1000 * 60 * 60 * 24)))

    // Cohérence : comparer l'entité/géographie du signal courant à celles
    // désormais enregistrées sur l'opportunité (peuvent différer si
    // l'opportunité existait déjà avec d'autres valeurs).
    const opp = await this.alertContextRepository.getOpportuniteCorrelationFields(rpcResult.opportuniteId)
    const entiteMatch = Boolean(entiteCible) && opp?.entiteCible === entiteCible
    const geoMatch = Boolean(geographie) && opp?.geographie === geographie

    const convergenceInputs = {
      nombreSignaux: rpcResult.nombreSignaux,
      distinctCategories: rpcResult.distinctCategories,
      spanDays,
      entiteMatch,
      geoMatch,
    }
    const convergenceScore = ScoreEngine.computeConvergenceScore(convergenceInputs)
    const prioriteScore = ScoreEngine.computePrioriteScore(adequationScore, convergenceScore, anticipationScore)

    const scoreDetails: ScoreDetails = {
      adequation: { subScores: input.subScores },
      convergence: {
        components: ScoreEngine.computeConvergenceComponents(convergenceInputs),
        inputs: convergenceInputs,
      },
      anticipation: { etapeProjet: input.etapeProjet },
      correlation: { key: correlation.key, confidence: correlation.confidence },
    }

    const indicators: OpportunityIndicators = {
      adequationScore,
      convergenceScore,
      anticipationScore,
      prioriteScore,
      scoreDetails,
      scoreVersion: SCORE_VERSION,
    }

    // 12. Persister les 4 indicateurs + score_details (via OpportunityRepository).
    await this.opportunityRepository.updateOpportunityScores(rpcResult.opportuniteId, indicators)

    // 13. Résultat explicite avec explication synthétique.
    const explanation = this.buildExplanation(rpcResult.action, indicators, rpcResult.nombreSignaux, correlation.confidence)

    return { opportuniteId: rpcResult.opportuniteId, action: rpcResult.action, indicators, explanation }
  }

  private buildExplanation(
    action: ProcessAlertOpportunityResult['action'],
    indicators: OpportunityIndicators,
    nombreSignaux: number,
    confidence: 'high' | 'low'
  ): string {
    const actionLabel =
      action === 'created' ? 'Nouvelle opportunité créée' : action === 'updated' ? 'Opportunité existante mise à jour' : 'Alerte déjà traitée (idempotent)'
    const confidenceNote = confidence === 'low' ? ' (corrélation à faible confiance : dossier isolé par alerte)' : ''
    return `${actionLabel}${confidenceNote}. ${nombreSignaux} signal(aux) rattaché(s). Adéquation ${indicators.adequationScore}/100, convergence ${indicators.convergenceScore}/100, anticipation ${indicators.anticipationScore}/100, priorité ${indicators.prioriteScore}/100.`
  }
}
