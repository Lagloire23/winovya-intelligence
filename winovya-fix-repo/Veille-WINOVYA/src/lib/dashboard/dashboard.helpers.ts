// Sprint 9 — Calculs purs du cockpit (Phase 4/5/15). AUCUN accès réseau
// ici (voir dashboard.repository.ts pour l'I/O) : uniquement des
// fonctions déterministes prenant en entrée des lignes déjà lues depuis
// veille.opportunite_dossier / veille.opportunite_activity_log.
//
// Règle absolue de ce sprint : "intelligent" = déterministe. Aucune de
// ces fonctions n'appelle un modèle de langage, un service externe, ou
// ne fabrique une donnée qui ne soit pas directement dérivable des
// colonnes existantes (statut, dates, confiance, signaux, budget). Voir
// docs/dashboard-architecture.md pour la justification complète de
// chaque règle.

import { LIFECYCLE_STATES } from '../opportunities/commercial/lifecycle'
import { formatMontant } from '../opportunities/uiHelpers'
import type { DashboardOpportuniteRow } from './dashboard.repository'
import type {
  ActionRequiredItemDto,
  DistributionDto,
  KpiCardDto,
  PipelineStageDto,
  PortfolioSynthesisDto,
  PriorityOpportuniteDto,
  RecentActivityItemDto,
} from './dashboard.dto'
import type { DashboardPeriodDays } from './dashboard.types'

/** Statuts "fermés" — jamais candidats aux priorités/actions/synthèse (déjà gagnés/perdus/archivés). */
const CLOSED_STATUSES = new Set(['WON', 'LOST', 'ARCHIVED'])

/**
 * `IN_PROGRESS` est une valeur héritée hors cycle de vie Sprint 6 (voir
 * lifecycle.ts). Décision Sprint 9 (documentée) : elle est traitée comme
 * les statuts fermés pour les priorités/actions (aucune action pilotable
 * dessus), et regroupée séparément dans la vue pipeline (jamais mélangée
 * aux 7 états du cycle de vie).
 */
export function isActionableStatus(statut: string): boolean {
  return !CLOSED_STATUSES.has(statut) && statut !== 'IN_PROGRESS'
}

const STATUT_LABELS: Record<string, string> = {
  NEW: 'Nouveau',
  QUALIFYING: 'En qualification',
  QUALIFIED: 'Qualifié',
  PROPOSAL: 'Proposition',
  WON: 'Gagné',
  LOST: 'Perdu',
  ARCHIVED: 'Archivé',
}

export function statutLabel(statut: string): string {
  return STATUT_LABELS[statut] ?? statut
}

export function daysSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((now - t) / 86_400_000)
}

export function isWithinPeriod(iso: string | null, periodDays: DashboardPeriodDays, now: number = Date.now()): boolean {
  const d = daysSince(iso, now)
  return d !== null && d >= 0 && d <= periodDays
}

/** Fenêtre de "staleness" (aucune évolution récente) — seuil unique, documenté, réutilisé partout (KPI, actions, synthèse). */
export const STALE_THRESHOLD_DAYS = 30

export function isStale(row: DashboardOpportuniteRow, now: number = Date.now()): boolean {
  if (!isActionableStatus(row.statutOpportunite)) return false
  const d = daysSince(row.derniereEvolutionMetierAt, now)
  return d !== null && d > STALE_THRESHOLD_DAYS
}

/**
 * Score déterministe 0-100 (Phase 4/5). Règles simples et transparentes,
 * toutes dérivées de colonnes existantes :
 *   - confiance (niveauConfianceRang 0-3, déjà calculé par la vue Sprint 5/8) : jusqu'à 60 pts
 *   - budget identifié connu : +15 pts
 *   - signaux multiples (>=3) : +10 pts, (2) : +5 pts
 *   - signal récent (<=7 jours) : +10 pts, (<=30 jours) : +5 pts
 * Retourne aussi les raisons (libellés humains, jamais qualifiées "IA")
 * qui ont concrètement contribué au score, dans l'ordre de poids
 * décroissant.
 */
export function computePriorityScore(
  row: DashboardOpportuniteRow,
  now: number = Date.now()
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  const rank = row.niveauConfianceRang ?? 0
  if (rank > 0) {
    score += rank * 20
    if (rank === 3) reasons.push('Confiance élevée')
    else if (rank === 2) reasons.push('Confiance moyenne')
  }

  if (row.budgetIdentifie !== null) {
    score += 15
    const formatted = formatMontant(row.budgetIdentifie)
    reasons.push(formatted ? `Budget identifié (${formatted})` : 'Budget identifié')
  }

  if (row.nombreSignaux >= 3) {
    score += 10
    reasons.push(`${row.nombreSignaux} signaux corrélés`)
  } else if (row.nombreSignaux === 2) {
    score += 5
    reasons.push('Signaux multiples')
  }

  const dSignal = daysSince(row.dateDernierSignal, now)
  if (dSignal !== null && dSignal <= 7) {
    score += 10
    reasons.push('Signal récent (moins de 7 jours)')
  } else if (dSignal !== null && dSignal <= 30) {
    score += 5
  }

  return { score: Math.min(100, score), reasons: reasons.slice(0, 3) }
}

/** Classe les opportunités "actionnables" par score décroissant, plafonné à `limit` (Phase 4/5 : max 5). */
export function rankPriorities(
  rows: DashboardOpportuniteRow[],
  limit: number,
  now: number = Date.now()
): PriorityOpportuniteDto[] {
  return rows
    .filter((r) => isActionableStatus(r.statutOpportunite))
    .map((r) => {
      const { score, reasons } = computePriorityScore(r, now)
      return { r, score, reasons }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ r, score, reasons }) => ({
      id: r.id,
      titre: r.titre,
      statutOpportunite: r.statutOpportunite,
      statutLabel: statutLabel(r.statutOpportunite),
      score,
      reasons,
      source: 'deterministic',
    }))
}

/** Vue pipeline (Phase 4) — les 7 états du cycle de vie Sprint 6 UNIQUEMENT (IN_PROGRESS légataire exclu, décision documentée ci-dessus). */
export function buildPipeline(rows: DashboardOpportuniteRow[]): PipelineStageDto[] {
  const counts = new Map<string, number>()
  for (const s of LIFECYCLE_STATES) counts.set(s, 0)
  for (const r of rows) {
    if (counts.has(r.statutOpportunite)) counts.set(r.statutOpportunite, (counts.get(r.statutOpportunite) ?? 0) + 1)
  }
  return LIFECYCLE_STATES.map((s) => ({ statut: s, label: statutLabel(s), count: counts.get(s) ?? 0 }))
}

export function buildDistributionParStatut(rows: DashboardOpportuniteRow[]): DistributionDto {
  const active = rows.filter((r) => r.statutOpportunite !== 'IN_PROGRESS')
  const buckets = LIFECYCLE_STATES.map((s) => ({
    label: statutLabel(s),
    count: active.filter((r) => r.statutOpportunite === s).length,
  })).filter((b) => b.count > 0)
  return { title: 'Répartition par statut commercial', buckets }
}

export function buildDistributionParConfiance(rows: DashboardOpportuniteRow[]): DistributionDto {
  const order: Array<{ key: string | null; label: string }> = [
    { key: 'Élevé', label: 'Élevé' },
    { key: 'Moyen', label: 'Moyen' },
    { key: 'Faible', label: 'Faible' },
    { key: null, label: 'Non renseigné' },
  ]
  const buckets = order
    .map(({ key, label }) => ({ label, count: rows.filter((r) => (r.niveauConfiance ?? null) === key).length }))
    .filter((b) => b.count > 0)
  return { title: 'Répartition par niveau de confiance', buckets }
}

/**
 * Actions requises (Phase 4/5) — vue CALCULÉE, jamais persistée. Deux
 * règles, toutes deux dérivées de colonnes existantes uniquement :
 *   1. Opportunité NEW non assignée (besoin de triage).
 *   2. Opportunité active sans évolution depuis plus de STALE_THRESHOLD_DAYS jours (besoin de relance).
 * Une même opportunité ne peut apparaître qu'une fois (règle la plus
 * prioritaire retenue : non-assignation avant staleness).
 */
export function buildActionsRequises(
  rows: DashboardOpportuniteRow[],
  limit: number,
  now: number = Date.now()
): ActionRequiredItemDto[] {
  const items: ActionRequiredItemDto[] = []
  const seen = new Set<string>()

  for (const r of rows) {
    if (r.statutOpportunite === 'NEW' && !r.assignedTo) {
      items.push({
        id: `${r.id}-unassigned`,
        opportuniteId: r.id,
        opportuniteTitre: r.titre,
        reason: 'Nouvelle opportunité non assignée',
        severity: 'info',
      })
      seen.add(r.id)
    }
  }
  for (const r of rows) {
    if (seen.has(r.id)) continue
    if (isStale(r, now)) {
      const d = daysSince(r.derniereEvolutionMetierAt, now)
      items.push({
        id: `${r.id}-stale`,
        opportuniteId: r.id,
        opportuniteTitre: r.titre,
        reason: `Aucune activité depuis ${d} jours`,
        severity: 'warning',
      })
      seen.add(r.id)
    }
  }

  return items
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1))
    .slice(0, limit)
}

/**
 * Synthèse de portefeuille (Phase 4/15) — texte 100% déterministe,
 * construit uniquement à partir des agrégats déjà calculés. C'EST le
 * point d'extension prévu pour le Sprint 10 : une future
 * `buildPortfolioSynthesisAI(aggregates)` pourrait produire le même DTO
 * (`PortfolioSynthesisDto`, `source: 'ai'`) sans que le Frontend n'ait à
 * changer — voir InsightSource (dashboard.types.ts). Aucun appel externe
 * ici, aucune préparation de prompt, aucune dépendance ajoutée.
 */
export function buildPortfolioSynthesis(aggregates: {
  total: number
  confianceElevee: number
  budgetIdentifie: number
  nonAssignees: number
  obsoletes: number
  periodDays: DashboardPeriodDays
}): PortfolioSynthesisDto {
  const parts: string[] = []
  parts.push(
    `${aggregates.total} opportunité${aggregates.total > 1 ? 's' : ''} active${aggregates.total > 1 ? 's' : ''} suivie${aggregates.total > 1 ? 's' : ''}.`
  )
  if (aggregates.confianceElevee > 0) {
    parts.push(`${aggregates.confianceElevee} à confiance élevée.`)
  }
  if (aggregates.budgetIdentifie > 0) {
    parts.push(`${aggregates.budgetIdentifie} avec budget identifié.`)
  }
  if (aggregates.nonAssignees > 0) {
    parts.push(`${aggregates.nonAssignees} en attente d'assignation.`)
  }
  if (aggregates.obsoletes > 0) {
    parts.push(`${aggregates.obsoletes} sans activité depuis plus de ${STALE_THRESHOLD_DAYS} jours.`)
  }
  return { text: parts.join(' '), source: 'deterministic' }
}

export function kpi(key: string, label: string, value: number | string, hint?: string): KpiCardDto {
  return { key, label, value: String(value), hint }
}

/**
 * Libellé sûr pour une entrée du journal d'activité (Phase 4 : "jamais le
 * contenu complet d'une note"). Réutilise les mêmes libellés d'événement
 * que le module Opportunités (Sprint 6/7) sans jamais lire `details`
 * (qui peut contenir le texte d'une note) au-delà de ce qui est déjà
 * whitelisté ci-dessous.
 */
const EVENT_LABELS: Record<string, string> = {
  created: 'Opportunité créée',
  status_changed: 'Statut modifié',
  assigned: 'Assignée',
  unassigned: 'Désassignée',
  note_added: 'Note ajoutée',
  note_updated: 'Note modifiée',
  note_deleted: 'Note supprimée',
}

export function activityEventLabel(eventType: string, details: Record<string, unknown>): string {
  const base = EVENT_LABELS[eventType] ?? eventType
  if (eventType === 'status_changed') {
    const from = details && typeof details.from === 'string' ? details.from : null
    const to = details && typeof details.to === 'string' ? details.to : null
    if (from && to) return `${base} : ${statutLabel(from)} → ${statutLabel(to)}`
  }
  return base
}

export function mapActivityRow(row: {
  id: string
  opportuniteId: string
  opportuniteTitre: string
  eventType: string
  details: Record<string, unknown>
  createdAt: string
}): RecentActivityItemDto {
  return {
    id: row.id,
    opportuniteId: row.opportuniteId,
    opportuniteTitre: row.opportuniteTitre,
    eventType: row.eventType,
    label: activityEventLabel(row.eventType, row.details),
    createdAt: row.createdAt,
  }
}
