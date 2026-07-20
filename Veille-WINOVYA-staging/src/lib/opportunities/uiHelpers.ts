// Sprint 7 — Aides de présentation pour le module Opportunités (Frontend
// uniquement). Purement cosmétique : libellés et couleurs d'affichage
// pour des valeurs déjà calculées par le backend (Sprint 4/5/6). Ne
// recalcule et ne redéfinit AUCUNE règle métier (niveau de confiance,
// statut d'enrichissement, statut commercial, transitions) — ces valeurs
// sont lues telles quelles depuis les DTO existants.

import type { NiveauConfiance, StatutEnrichissement, RoleCorrelation } from './query/types'
import type { StatutOpportunite } from './commercial/types'

export const STATUT_COMMERCIAL_LABELS: Record<StatutOpportunite, string> = {
  NEW: 'Nouveau',
  QUALIFYING: 'En qualification',
  QUALIFIED: 'Qualifié',
  PROPOSAL: 'Proposition',
  WON: 'Gagné',
  LOST: 'Perdu',
  ARCHIVED: 'Archivé',
}

export const STATUT_COMMERCIAL_BADGE_STYLE: Record<StatutOpportunite, string> = {
  NEW: 'bg-brand-green-light/20 text-brand-green-deep border-brand-green-light/40',
  QUALIFYING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  QUALIFIED: 'bg-brand-primary/15 text-brand-primary border-brand-primary/40',
  PROPOSAL: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
  WON: 'bg-brand-green-deep/10 text-brand-green-deep border-brand-green-deep/30',
  LOST: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
}

/** Toute valeur héritée hors cycle de vie Sprint 6 (ex. IN_PROGRESS) retombe sur ce style neutre — jamais une couleur inventée. */
export const STATUT_COMMERCIAL_FALLBACK_STYLE =
  'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'

export function statutCommercialLabel(statut: string): string {
  return STATUT_COMMERCIAL_LABELS[statut as StatutOpportunite] ?? statut
}

export function statutCommercialStyle(statut: string): string {
  return STATUT_COMMERCIAL_BADGE_STYLE[statut as StatutOpportunite] ?? STATUT_COMMERCIAL_FALLBACK_STYLE
}

export const CONFIANCE_BADGE_STYLE: Record<NiveauConfiance, string> = {
  'Élevé': 'bg-brand-green-deep/10 text-brand-green-deep border-brand-green-deep/20',
  Moyen: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  Faible: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
}

export const ENRICHISSEMENT_LABELS: Record<StatutEnrichissement, string> = {
  pending: 'En attente',
  partial: 'Partiel',
  ready: 'Complet',
  failed: 'Échec',
}

export const ENRICHISSEMENT_BADGE_STYLE: Record<StatutEnrichissement, string> = {
  pending: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
  partial: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  ready: 'bg-brand-green-deep/10 text-brand-green-deep border-brand-green-deep/20',
  failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
}

export function formatMontant(v: number | null): string | null {
  if (v === null || v === undefined) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

// Sprint 8 (Phase 5) : `toLocaleDateString`/`toLocaleString` ne lèvent
// jamais d'exception sur une date invalide — ils renvoient littéralement
// la chaîne "Invalid Date", que le try/catch seul ne peut pas intercepter.
// Garde explicite sur `Number.isNaN` avant tout formatage pour ne jamais
// laisser passer "Invalid Date" à l'écran (règle explicite Phase 5).
export function formatDate(d: string | null): string {
  if (!d) return '—'
  const t = new Date(d).getTime()
  if (Number.isNaN(t)) return '—'
  return new Date(t).toLocaleDateString('fr-FR')
}

export function formatDateTime(d: string | null): string {
  if (!d) return '—'
  const t = new Date(d).getTime()
  if (Number.isNaN(t)) return '—'
  return new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "il y a 3 jours" — pure présentation, calculée côté client à partir d'une date déjà fournie par le backend. */
export function formatRelative(d: string | null): string {
  if (!d) return '—'
  const then = new Date(d).getTime()
  if (Number.isNaN(then)) return d
  const diffMs = Date.now() - then
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffJ = Math.round(diffH / 24)
  if (diffJ < 30) return `il y a ${diffJ} j`
  return formatDate(d)
}

// Sprint 11A (P11.1 §5.3) : libellés et couleurs d'affichage du rôle
// d'une alerte dans la corrélation. `null` (jamais évalué) est géré à
// part par le composant (voir RoleCorrelationBadge, Badges.tsx) — cette
// table ne couvre que les valeurs réellement présentes en base.
export const ROLE_CORRELATION_LABELS: Record<RoleCorrelation, string> = {
  declencheur: 'Déclencheur',
  confirmant: 'Confirmant',
  contextuel: 'Contextuel',
  hors_sujet: 'Hors sujet',
  non_classe: 'Non classé',
}

export const ROLE_CORRELATION_BADGE_STYLE: Record<RoleCorrelation, string> = {
  declencheur: 'bg-brand-primary/15 text-brand-primary border-brand-primary/40',
  confirmant: 'bg-brand-green-deep/10 text-brand-green-deep border-brand-green-deep/20',
  contextuel: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  hors_sujet: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  non_classe: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
}

/** Libellé/style pour une alerte jamais évaluée (role_correlation = NULL en base) — distinct de 'non_classe' (évaluée, sans rôle clair). Les deux s'affichent identiquement ("Non classé") : la nuance est interne (voir P11.1 §3.2 bis / §6), pas encore utile à l'utilisateur au Sprint 11A. */
export const ROLE_CORRELATION_NON_EVALUE_LABEL = 'Non classé'
export const ROLE_CORRELATION_NON_EVALUE_STYLE =
  'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'

export const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  created: 'Opportunité créée',
  status_changed: 'Statut modifié',
  assigned: 'Assignée',
  unassigned: 'Désassignée',
  note_added: 'Note ajoutée',
  note_updated: 'Note modifiée',
  note_deleted: 'Note supprimée',
  // Sprint 11B — retrait/réintégration logique d'une alerte liée.
  alerte_retiree: 'Alerte retirée',
  alerte_reintegree: 'Alerte réintégrée',
}
