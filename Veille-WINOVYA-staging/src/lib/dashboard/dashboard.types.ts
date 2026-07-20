// Sprint 9 — Cockpit & Dashboard Intelligent.
//
// Types transverses du module dashboard. Module PUR (aucun accès
// Supabase). Aucune règle métier de corrélation/enrichissement/cycle de
// vie n'est redéfinie ici : ce fichier ne fait que nommer des concepts
// d'AGRÉGATION (période, rôle de confiance, source d'un "insight") qui
// n'existaient pas avant ce sprint.

/** Fenêtre d'observation du cockpit (Phase 2). Défaut : 30 jours (Phase 2). */
export type DashboardPeriodDays = 7 | 30 | 90

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriodDays = 30

export const DASHBOARD_PERIODS: readonly DashboardPeriodDays[] = [7, 30, 90]

/**
 * Rôle de confiance (Phase 8) : déterminé UNIQUEMENT à partir du contexte
 * d'authentification réel (profil chargé par AuthContext après connexion
 * Supabase, protégé par la RLS `read own profile` / `admin manage
 * profiles`). Ce type ne doit JAMAIS être construit à partir d'une valeur
 * fournie par le client (paramètre d'URL, prop non fiable, etc.) — voir
 * dashboard.service.ts, seul point d'entrée, qui exige un `TrustedActor`
 * complet en paramètre plutôt qu'un simple rôle.
 */
export type CockpitRole = 'admin' | 'member'

export interface TrustedActor {
  userId: string
  role: CockpitRole
}

/**
 * Phase 15 — abstraction de préparation (PAS d'IA implémentée dans ce
 * sprint). Indique uniquement la PROVENANCE d'un texte ou d'un score déjà
 * calculé : 'deterministic' (100% des cas dans ce sprint, calculé par
 * dashboard.helpers.ts à partir de règles simples et transparentes) ou
 * 'ai' (réservé au Sprint 10, jamais produit ici). Aucun appel réseau,
 * aucune table, aucune colonne IA n'est ajouté par ce type : c'est un
 * simple marqueur de type pour que le Sprint 10 puisse remplacer la
 * fonction qui produit un `PortfolioSynthesisDto`/`PriorityOpportuniteDto`
 * sans changer la forme consommée par le Frontend.
 */
export type InsightSource = 'deterministic' | 'ai'

/** Sévérité d'un élément "action requise" — purement présentational (couleur/icône), aucune donnée fabriquée. */
export type ActionSeverity = 'info' | 'warning'
