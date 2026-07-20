// Sprint 4 — Contrats TypeScript du dossier métier d'opportunité.
//
// Aucune IA : toute valeur ci-dessous est soit une donnée OBSERVÉE (déjà
// écrite en base par le pipeline existant, ex. alertes.montant), soit
// DÉDUITE par une règle déterministe et documentée (voir
// DossierEnrichmentService.ts), soit explicitement INDISPONIBLE (null).
// Jamais de valeur inventée ou générée par un modèle de langage.

export type BudgetFiabilite = 'Officiel' | 'Probable' | 'À vérifier'

export type NiveauConfiance = 'Élevé' | 'Moyen' | 'Faible'

export type StatutEnrichissement = 'pending' | 'partial' | 'ready' | 'failed'

/** Même vocabulaire que EtapeProjet (engine/types.ts) — un seul concept, deux endroits où il apparaît. */
export type PhaseProjet =
  | 'INTENTION'
  | 'ETUDE'
  | 'FONCIER'
  | 'AUTORISATION'
  | 'RECRUTEMENT'
  | 'CONSULTATION'
  | 'ANNONCE'
  | 'APPEL_OFFRES'

export type CorrelationConfidence = 'high' | 'low'

/**
 * Un signal (alerte) rattaché à l'opportunité, réduit aux seuls champs
 * dont la consolidation du dossier a besoin. Vient de AlertContextRepository
 * / la table alertes — jamais recalculé, toujours lu tel quel.
 */
export interface DossierSignalInput {
  alerteId: string
  montant: number | null
  categorieVeille: string | null
  dateDetection: string
  referenceOfficielle: string | null
  lienSourceUrl: string | null
  name: string
}

/** Tout ce dont DossierEnrichmentService a besoin pour consolider un dossier. Aucun accès Supabase ici : lecture faite en amont par DossierRepository. */
export interface DossierConsolidationInput {
  opportuniteId: string
  titre: string
  entiteCible: string | null
  typeOpportunite: string | null
  geographie: string | null
  nombreSignaux: number
  nombrePreuves: number
  nombreDecideurs: number
  datePremierSignal: string | null
  dateDernierSignal: string | null
  correlationConfidence: CorrelationConfidence | null
  etapeProjet: PhaseProjet | null
  signaux: DossierSignalInput[]
}

/** Résultat pur du calcul, avant écriture. */
export interface DossierConsolidationResult {
  phaseProjet: PhaseProjet | null
  budgetIdentifie: number | null
  budgetSource: string | null
  budgetFiabilite: BudgetFiabilite | null
  niveauConfiance: NiveauConfiance
  raisons: string[]
  resumeMetier: string
  statutEnrichissement: StatutEnrichissement
}

/** Ce que la fonction pure peut réellement juger : jamais "pending" (état initial, avant toute consolidation) ni "failed" (réservé à l'orchestration I/O en cas d'erreur inattendue). */
export type ComputedStatutEnrichissement = 'partial' | 'ready'
