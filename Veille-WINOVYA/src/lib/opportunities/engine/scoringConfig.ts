// Sprint 2.1 — Configuration centralisée de TOUTES les pondérations et
// tables de correspondance du moteur d'opportunités. Composant unique
// (Phase 3 de la revue de stabilisation) : aucune constante métier
// (pondération, table, version de formule) ne doit exister ailleurs
// que dans ce fichier. ScoreEngine.ts référence exclusivement cette
// configuration — il ne redéclare aucun poids lui-même.
//
// La version Deno de l'Edge Function
// (supabase/functions/process-alert-opportunity/index.ts) duplique ces
// mêmes valeurs à l'identique dans son propre bloc de configuration
// (contrainte du projet : Edge Functions = scripts Deno autonomes, non
// bundlés avec Vite — impossible d'importer ce fichier directement).
// Toute modification d'une valeur ci-dessous DOIT être répercutée dans
// le bloc de configuration correspondant de l'Edge Function, et
// revalidée par les tests (scripts/sprint2-engine-tests.ts).

import type { AdequationSubScoreKey, EtapeProjet } from './types'

/** Version des formules — persistée sur chaque opportunité scorée. */
export const SCORE_VERSION = 'sprint2-v1'

/** Poids du score d'adéquation. Somme = 1.00 exactement. */
export const ADEQUATION_WEIGHTS: Record<AdequationSubScoreKey, number> = {
  competences: 0.3,
  types_opportunite: 0.25,
  secteurs: 0.15,
  references: 0.1,
  geographie: 0.1,
  mots_cles: 0.05,
  compte_strategique: 0.05,
}

/** Poids du score de convergence. Somme = 1.00 exactement. */
export const CONVERGENCE_WEIGHTS = {
  signalCount: 0.4,
  sourceDiversity: 0.25,
  temporalProximity: 0.2,
  coherence: 0.15,
} as const

/**
 * Table de correspondance déterministe étape de projet -> valeur
 * d'anticipation. Échelle linéaire décroissante sur les 8 étapes
 * (100 -> 0) : les étapes précoces (INTENTION) obtiennent le score le
 * plus élevé (davantage de temps pour agir commercialement), les étapes
 * tardives (APPEL_OFFRES) le score le plus bas.
 */
export const ANTICIPATION_TABLE: Record<EtapeProjet, number> = {
  INTENTION: 100,
  ETUDE: 86,
  FONCIER: 71,
  AUTORISATION: 57,
  RECRUTEMENT: 43,
  CONSULTATION: 29,
  ANNONCE: 14,
  APPEL_OFFRES: 0,
}

/** Poids de la priorité commerciale. Somme = 1.00 exactement. */
export const PRIORITE_WEIGHTS = {
  adequation: 0.45,
  convergence: 0.35,
  anticipation: 0.2,
} as const
