// Sprint 4 — Calculs purs de consolidation du dossier d'opportunité.
//
// Aucune IA, aucun accès Supabase. Chaque fonction est déterministe et
// testable isolément (voir scripts/sprint4-dossier-tests.ts), sur le même
// modèle que ScoreEngine / CorrelationEngine (Sprint 2 / 2.1) : la
// logique métier vit ici, l'I/O vit dans DossierRepository /
// OpportunityDossierService.
//
// Principe directeur (Phase 3 du Sprint 4) : toute information exposée
// est soit OBSERVÉE (déjà écrite par le pipeline existant, jamais
// recalculée : alertes.montant, categorie_veille...), soit DÉDUITE par
// une règle explicite et documentée ci-dessous, soit INDISPONIBLE
// (valeur null, jamais une fabrication).

import type {
  BudgetFiabilite,
  ComputedStatutEnrichissement,
  CorrelationConfidence,
  DossierConsolidationInput,
  DossierConsolidationResult,
  DossierSignalInput,
  NiveauConfiance,
  PhaseProjet,
} from './types'

// ---------------------------------------------------------------------
// Budget : donnée OBSERVÉE (alertes.montant), jamais estimée.
//
// Règle de sélection quand plusieurs alertes rattachées portent un
// montant : on retient celui de l'alerte détectée le plus récemment
// (une mise à jour ultérieure du projet est jugée plus fiable qu'un
// premier chiffrage ancien) ; en cas d'égalité de date, le montant le
// plus élevé.
// ---------------------------------------------------------------------

function pickBudgetSignal(signaux: DossierSignalInput[]): DossierSignalInput | null {
  const withMontant = signaux.filter((s) => s.montant !== null && s.montant >= 0)
  if (withMontant.length === 0) return null
  return withMontant.reduce((best, current) => {
    const bestDate = new Date(best.dateDetection).getTime()
    const currentDate = new Date(current.dateDetection).getTime()
    if (currentDate > bestDate) return current
    if (currentDate < bestDate) return best
    return (current.montant as number) > (best.montant as number) ? current : best
  })
}

// ---------------------------------------------------------------------
// Fiabilité du budget : DÉDUITE de categorie_veille de l'alerte source.
// Règle documentée (docs/opportunity-dossier.md §3) — catégories
// correspondant à un acte administratif officiel déjà publié =>
// "Officiel" ; catégories décrivant un état de fait technique mais pas
// nécessairement un acte chiffré formel => "Probable" ; catégories de
// reporting tiers / actualité => "À vérifier".
// ---------------------------------------------------------------------

const CATEGORIE_VEILLE_TO_BUDGET_FIABILITE: Record<string, BudgetFiabilite> = {
  '1. Documents administratifs': 'Officiel',
  '2. Presse locale': 'À vérifier',
  '3. Maîtrise foncière': 'Probable',
  '4. Urbanisme (compatibilité)': 'Probable',
  '5. Marchés publics & renouvellements': 'Officiel',
  '6. Délibérations': 'Officiel',
  '7. ICPE': 'Probable',
  '8. Actualisation de données': 'À vérifier',
  '9. Arrêtés préfectoraux': 'Officiel',
  '10. Articles associations': 'À vérifier',
  '11. Élus locaux': 'À vérifier',
  '12. Budgets collectivités / investissements': 'Officiel',
}

function computeBudgetFiabilite(categorieVeille: string | null): BudgetFiabilite | null {
  if (!categorieVeille) return null
  return CATEGORIE_VEILLE_TO_BUDGET_FIABILITE[categorieVeille] ?? null
}

function computeBudgetSource(signal: DossierSignalInput): string {
  return signal.referenceOfficielle?.trim() || signal.lienSourceUrl?.trim() || signal.name
}

// ---------------------------------------------------------------------
// Niveau de confiance global : DÉDUIT de la confiance de corrélation
// (Sprint 2.1 CorrelationEngine, disponible uniquement si un scoring
// manuel a déjà eu lieu) et, à défaut, du seul nombre de signaux
// (cas courant : opportunité créée uniquement par le chemin automatique
// Sprint 3, jamais encore scorée manuellement).
// ---------------------------------------------------------------------

export function computeNiveauConfiance(
  correlationConfidence: CorrelationConfidence | null,
  nombreSignaux: number
): NiveauConfiance {
  if (correlationConfidence === 'low') return 'Faible'
  if (correlationConfidence === 'high') return nombreSignaux >= 2 ? 'Élevé' : 'Moyen'
  // Pas encore scoré manuellement : la seule donnée réelle disponible est le nombre de signaux.
  return nombreSignaux >= 2 ? 'Moyen' : 'Faible'
}

// ---------------------------------------------------------------------
// Statut d'enrichissement (fonction pure : ne renvoie jamais "pending"
// ni "failed", réservés à l'orchestration — voir
// OpportunityDossierService.ts). "ready" exige des décideurs ET des
// preuves ET un niveau de confiance non "Faible" : un dossier sans
// aucun décideur ou sans aucune preuve n'est pas jugé exploitable tel
// quel par un commercial, quel que soit le budget.
// ---------------------------------------------------------------------

export function computeStatutEnrichissement(
  nombrePreuves: number,
  nombreDecideurs: number,
  niveauConfiance: NiveauConfiance
): ComputedStatutEnrichissement {
  const pret = nombrePreuves >= 1 && nombreDecideurs >= 1 && niveauConfiance !== 'Faible'
  return pret ? 'ready' : 'partial'
}

// ---------------------------------------------------------------------
// Raisons factuelles (Phase 7) : phrases courtes, exclusivement
// factuelles, construites à partir de données déjà connues. Jamais de
// texte marketing, jamais de génération par un modèle de langage.
// ---------------------------------------------------------------------

export function buildRaisons(input: {
  nombreSignaux: number
  nombreDecideurs: number
  nombrePreuves: number
  budgetIdentifie: number | null
  budgetFiabilite: BudgetFiabilite | null
  correlationConfidence: CorrelationConfidence | null
  etapeProjet: PhaseProjet | null
}): string[] {
  const raisons: string[] = []

  raisons.push(
    input.nombreSignaux > 1
      ? `${input.nombreSignaux} signaux rattachés à cette opportunité.`
      : `1 signal rattaché à cette opportunité.`
  )

  if (input.nombreSignaux >= 2) {
    raisons.push('Plusieurs signaux convergents sur la même entité, le même type et la même géographie.')
  }

  if (input.budgetIdentifie !== null) {
    const fiabiliteNote = input.budgetFiabilite ? ` (fiabilité : ${input.budgetFiabilite})` : ''
    raisons.push(`Budget identifié : ${formatMontant(input.budgetIdentifie)} €${fiabiliteNote}.`)
  }

  raisons.push(
    input.nombreDecideurs >= 1
      ? `${input.nombreDecideurs} décideur(s) identifié(s).`
      : 'Aucun décideur identifié à ce jour.'
  )

  raisons.push(
    input.nombrePreuves >= 1
      ? `${input.nombrePreuves} preuve(s) documentaire(s) rattachée(s).`
      : 'Aucune preuve documentaire rattachée à ce jour.'
  )

  if (input.correlationConfidence === 'high') {
    raisons.push('Corrélation entre signaux jugée fiable (Sprint 2.1).')
  } else if (input.correlationConfidence === 'low') {
    raisons.push('Corrélation fondée sur un signal isolé (confiance limitée).')
  } else {
    raisons.push('Scoring de convergence pas encore calculé (traitement automatique uniquement).')
  }

  if (input.etapeProjet) {
    raisons.push(`Projet en phase ${input.etapeProjet}.`)
  }

  return raisons
}

// ---------------------------------------------------------------------
// Résumé métier (Phase 8) : gabarit déterministe, aucune donnée
// inventée. Chaque clause n'apparaît que si la donnée sous-jacente
// existe réellement ; sinon, la clause dit explicitement que
// l'information manque, plutôt que de l'omettre silencieusement ou de
// la deviner.
// ---------------------------------------------------------------------

// Séparateur de milliers manuel (espace ASCII ordinaire), plutôt que
// Intl.NumberFormat('fr-FR') qui insère U+202F (espace fine insécable) :
// évite toute dépendance à la version d'ICU disponible selon
// l'environnement d'exécution (Node ici, potentiellement Deno plus
// tard) et tout caractère invisible surprenant dans un export CSV/UI.
function formatMontant(montant: number): string {
  const rounded = Math.round(montant)
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

export function buildResumeMetier(input: {
  titre: string
  entiteCible: string | null
  typeOpportunite: string | null
  geographie: string | null
  nombreSignaux: number
  nombreDecideurs: number
  nombrePreuves: number
  budgetIdentifie: number | null
  datePremierSignal: string | null
  dateDernierSignal: string | null
}): string {
  const entite = input.entiteCible || 'entité non identifiée'
  const type = input.typeOpportunite || 'type non précisé'
  const geo = input.geographie || 'géographie non précisée'

  let dateClause = ''
  if (input.datePremierSignal && input.dateDernierSignal) {
    dateClause =
      input.datePremierSignal === input.dateDernierSignal
        ? ` le ${formatDate(input.datePremierSignal)}`
        : ` entre le ${formatDate(input.datePremierSignal)} et le ${formatDate(input.dateDernierSignal)}`
  }

  const budgetClause =
    input.budgetIdentifie !== null ? ` Budget identifié : ${formatMontant(input.budgetIdentifie)} €.` : ''

  const decideursClause =
    input.nombreDecideurs >= 1
      ? ` ${input.nombreDecideurs} décideur(s) identifié(s).`
      : ' Aucun décideur identifié à ce jour.'

  const preuvesClause =
    input.nombrePreuves >= 1
      ? ` ${input.nombrePreuves} preuve(s) documentaire(s) rattachée(s).`
      : ' Aucune preuve documentaire rattachée à ce jour.'

  return (
    `Opportunité ${type} chez ${entite} (${geo}). ` +
    `${input.nombreSignaux} signal(aux) détecté(s)${dateClause}.` +
    `${budgetClause}${decideursClause}${preuvesClause}`
  )
}

// ---------------------------------------------------------------------
// Orchestration pure : compose toutes les règles ci-dessus à partir
// d'un DossierConsolidationInput déjà chargé (lecture faite par
// DossierRepository). Ne fait aucune I/O.
// ---------------------------------------------------------------------

export function consolidate(input: DossierConsolidationInput): DossierConsolidationResult {
  const budgetSignal = pickBudgetSignal(input.signaux)
  const budgetIdentifie = budgetSignal ? (budgetSignal.montant as number) : null
  const budgetSource = budgetSignal ? computeBudgetSource(budgetSignal) : null
  const budgetFiabilite = budgetSignal ? computeBudgetFiabilite(budgetSignal.categorieVeille) : null

  const niveauConfiance = computeNiveauConfiance(input.correlationConfidence, input.nombreSignaux)

  const raisons = buildRaisons({
    nombreSignaux: input.nombreSignaux,
    nombreDecideurs: input.nombreDecideurs,
    nombrePreuves: input.nombrePreuves,
    budgetIdentifie,
    budgetFiabilite,
    correlationConfidence: input.correlationConfidence,
    etapeProjet: input.etapeProjet,
  })

  const resumeMetier = buildResumeMetier({
    titre: input.titre,
    entiteCible: input.entiteCible,
    typeOpportunite: input.typeOpportunite,
    geographie: input.geographie,
    nombreSignaux: input.nombreSignaux,
    nombreDecideurs: input.nombreDecideurs,
    nombrePreuves: input.nombrePreuves,
    budgetIdentifie,
    datePremierSignal: input.datePremierSignal,
    dateDernierSignal: input.dateDernierSignal,
  })

  const statutEnrichissement = computeStatutEnrichissement(input.nombrePreuves, input.nombreDecideurs, niveauConfiance)

  return {
    phaseProjet: input.etapeProjet,
    budgetIdentifie,
    budgetSource,
    budgetFiabilite,
    niveauConfiance,
    raisons,
    resumeMetier,
    statutEnrichissement,
  }
}

export const DossierEnrichmentService = {
  computeNiveauConfiance,
  computeStatutEnrichissement,
  buildRaisons,
  buildResumeMetier,
  consolidate,
}
