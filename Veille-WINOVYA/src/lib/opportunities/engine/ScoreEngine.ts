// Sprint 2 / 2.1 — Calculateurs déterministes des 4 indicateurs du
// moteur d'opportunités. Fonctions pures, sans effet de bord, sans
// accès réseau/DB : entièrement testables hors ligne (voir scripts/
// sprint2-engine-tests.ts). Toutes les pondérations et tables de
// correspondance sont importées depuis ./scoringConfig (Phase 3,
// centralisation Sprint 2.1) — aucun poids n'est déclaré ici.

import type { AdequationSubScores, EtapeProjet } from './types'
import {
  SCORE_VERSION,
  ADEQUATION_WEIGHTS,
  CONVERGENCE_WEIGHTS,
  ANTICIPATION_TABLE,
  PRIORITE_WEIGHTS,
} from './scoringConfig'

export { SCORE_VERSION, ADEQUATION_WEIGHTS, CONVERGENCE_WEIGHTS, ANTICIPATION_TABLE, PRIORITE_WEIGHTS }

const ADEQUATION_KEYS = Object.keys(ADEQUATION_WEIGHTS) as (keyof AdequationSubScores)[]

/**
 * Règle d'arrondi documentée : arrondi standard à l'entier le plus
 * proche (Math.round). Tous les scores manipulés ici sont dans [0,100],
 * donc toujours positifs — pas d'ambiguïté "round half to even/away".
 */
export function roundScore(value: number): number {
  return Math.round(value)
}

function assertSubScoreInRange(key: string, value: number): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(
      `Sous-score manquant ou invalide pour "${key}" : aucune valeur par défaut n'est définie, ce sous-score est obligatoire.`
    )
  }
  if (value < 0 || value > 100) {
    throw new Error(`Sous-score "${key}" hors intervalle [0,100] : ${value}`)
  }
}

/**
 * Score d'adéquation = somme pondérée des 7 sous-scores. Rejette toute
 * valeur manquante ou hors intervalle [0,100] (pas de valeur par défaut
 * implicite : un sous-score manquant est une erreur d'appel).
 */
export function computeAdequationScore(subScores: AdequationSubScores): number {
  for (const key of ADEQUATION_KEYS) {
    assertSubScoreInRange(key, subScores[key])
  }
  const weighted = ADEQUATION_KEYS.reduce((sum, key) => sum + subScores[key] * ADEQUATION_WEIGHTS[key], 0)
  return roundScore(weighted)
}

// ---------------------------------------------------------------------------
// Convergence
// ---------------------------------------------------------------------------

export interface ConvergenceInputs {
  nombreSignaux: number
  distinctCategories: number
  spanDays: number
  entiteMatch: boolean
  geoMatch: boolean
}

/** Table fixe : la confirmation par plusieurs signaux augmente le score. */
export function signalCountComponent(nombreSignaux: number): number {
  if (nombreSignaux <= 1) return 0
  if (nombreSignaux === 2) return 40
  if (nombreSignaux === 3) return 70
  if (nombreSignaux === 4) return 90
  return 100
}

/** Ratio de catégories de veille distinctes rapporté au nombre total de signaux. */
export function sourceDiversityComponent(distinctCategories: number, nombreSignaux: number): number {
  if (nombreSignaux <= 1) return 0
  const ratio = Math.min(1, distinctCategories / nombreSignaux)
  return roundScore(ratio * 100)
}

/** Table fixe : signaux rapprochés dans le temps => convergence plus forte. */
export function temporalProximityComponent(spanDays: number): number {
  if (spanDays <= 7) return 100
  if (spanDays <= 30) return 70
  if (spanDays <= 90) return 40
  if (spanDays <= 180) return 20
  return 0
}

/** Cohérence entité cible + géographie entre le signal et l'opportunité existante. */
export function coherenceComponent(entiteMatch: boolean, geoMatch: boolean): number {
  if (entiteMatch && geoMatch) return 100
  if (entiteMatch || geoMatch) return 50
  return 0
}

export function computeConvergenceComponents(inputs: ConvergenceInputs) {
  return {
    signalCount: signalCountComponent(inputs.nombreSignaux),
    sourceDiversity: sourceDiversityComponent(inputs.distinctCategories, inputs.nombreSignaux),
    temporalProximity: temporalProximityComponent(inputs.spanDays),
    coherence: coherenceComponent(inputs.entiteMatch, inputs.geoMatch),
  }
}

/**
 * Score de convergence, calculé à partir des agrégats réels des signaux
 * liés à l'opportunité (recomptés depuis les relations réelles par
 * veille.process_alert_opportunity — jamais estimés ni incrémentés côté
 * application).
 */
export function computeConvergenceScore(inputs: ConvergenceInputs): number {
  const c = computeConvergenceComponents(inputs)
  const weighted =
    c.signalCount * CONVERGENCE_WEIGHTS.signalCount +
    c.sourceDiversity * CONVERGENCE_WEIGHTS.sourceDiversity +
    c.temporalProximity * CONVERGENCE_WEIGHTS.temporalProximity +
    c.coherence * CONVERGENCE_WEIGHTS.coherence
  return roundScore(weighted)
}

// ---------------------------------------------------------------------------
// Anticipation
// ---------------------------------------------------------------------------

export function computeAnticipationScore(etape: EtapeProjet): number {
  const value = ANTICIPATION_TABLE[etape]
  if (value === undefined) {
    throw new Error(`Étape de projet invalide : "${String(etape)}"`)
  }
  return value
}

// ---------------------------------------------------------------------------
// Priorité commerciale
// ---------------------------------------------------------------------------

/**
 * Combine uniquement adéquation + convergence + anticipation (jamais la
 * priorité elle-même : pas de circularité). Les 4 indicateurs restent
 * chacun séparément accessibles et persistés.
 */
export function computePrioriteScore(adequationScore: number, convergenceScore: number, anticipationScore: number): number {
  const weighted =
    adequationScore * PRIORITE_WEIGHTS.adequation +
    convergenceScore * PRIORITE_WEIGHTS.convergence +
    anticipationScore * PRIORITE_WEIGHTS.anticipation
  return roundScore(weighted)
}

/**
 * Espace de noms utilisé par OpportunityEngineService (Phase 4, revue
 * d'architecture Sprint 2.1) : le service appelle
 * `ScoreEngine.computeXxx(...)` plutôt que les fonctions nues, pour que
 * la dépendance soit explicite et nommée exactement comme dans le
 * diagramme d'architecture cible. ScoreEngine n'accède jamais à la base
 * (aucun import de Supabase dans ce fichier).
 */
export const ScoreEngine = {
  computeAdequationScore,
  computeConvergenceScore,
  computeConvergenceComponents,
  computeAnticipationScore,
  computePrioriteScore,
}
