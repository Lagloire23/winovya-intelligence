// Sprint 2 — Contrats TypeScript du backend déterministe du moteur
// d'opportunités. Aucune IA : toutes les valeurs ci-dessous sont soit
// fournies explicitement par l'appelant (sous-scores, étape de projet,
// métadonnées de corrélation), soit calculées par des fonctions pures
// et déterministes (voir scoring.ts / correlationKey.ts).

/** Les 7 sous-scores d'adéquation, chacun dans l'intervalle [0, 100]. */
export type AdequationSubScoreKey =
  | 'competences'
  | 'types_opportunite'
  | 'secteurs'
  | 'references'
  | 'geographie'
  | 'mots_cles'
  | 'compte_strategique'

export interface AdequationSubScores {
  competences: number
  types_opportunite: number
  secteurs: number
  references: number
  geographie: number
  mots_cles: number
  compte_strategique: number
}

/**
 * Étape du cycle de vie d'un projet, utilisée pour le calcul de la
 * valeur d'anticipation. Ordre du plus précoce (INTENTION) au plus
 * tardif (APPEL_OFFRES).
 */
export type EtapeProjet =
  | 'INTENTION'
  | 'ETUDE'
  | 'FONCIER'
  | 'AUTORISATION'
  | 'RECRUTEMENT'
  | 'CONSULTATION'
  | 'ANNONCE'
  | 'APPEL_OFFRES'

/** Métadonnées de corrélation explicitement fournies par l'appelant. */
export interface CorrelationMetadataInput {
  entiteCible?: string | null
  typeOpportunite?: string | null
  secteur?: string | null
  geographie?: string | null
}

export type ProcessAlertOpportunityAction = 'created' | 'updated' | 'already_processed'

export interface ConvergenceScoreDetails {
  components: {
    signalCount: number
    sourceDiversity: number
    temporalProximity: number
    coherence: number
  }
  inputs: {
    nombreSignaux: number
    distinctCategories: number
    spanDays: number
    entiteMatch: boolean
    geoMatch: boolean
  }
}

export interface ScoreDetails {
  adequation: {
    subScores: AdequationSubScores
  }
  convergence: ConvergenceScoreDetails
  anticipation: {
    etapeProjet: EtapeProjet
  }
  correlation: {
    key: string
    confidence: 'high' | 'low'
  }
}

export interface OpportunityIndicators {
  adequationScore: number
  convergenceScore: number
  anticipationScore: number
  prioriteScore: number
  scoreDetails: ScoreDetails
  scoreVersion: string
}

export interface ProcessAlertOpportunityInput {
  alerteId: string
  entrepriseId: string
  subScores: AdequationSubScores
  etapeProjet: EtapeProjet
  correlationMetadata?: CorrelationMetadataInput
  titre?: string
}

export interface ProcessAlertOpportunityResult {
  opportuniteId: string
  action: ProcessAlertOpportunityAction
  indicators: OpportunityIndicators
  explanation: string
}
