// Sprint 9 — Contrats publics (DTO) du cockpit. Seule forme que le
// Frontend doit connaître (mêmes principes que query/types.ts au
// Sprint 5) : aucun composant ne doit lire directement
// veille.opportunite_dossier / veille.opportunite_activity_log — tout
// passe par DashboardService (dashboard.service.ts).

import type { ActionSeverity, DashboardPeriodDays, InsightSource } from './dashboard.types'

export interface KpiCardDto {
  key: string
  label: string
  /** Déjà formaté pour l'affichage (nombre entier ou montant), jamais une valeur brute à reformater côté composant. */
  value: string
  /** Aide contextuelle courte, optionnelle (ex. "sur les 30 derniers jours"). */
  hint?: string
}

export interface PipelineStageDto {
  statut: string
  label: string
  count: number
}

export interface PriorityOpportuniteDto {
  id: string
  titre: string
  statutOpportunite: string
  statutLabel: string
  /** Score déterministe 0-100 (Phase 4/5, voir dashboard.helpers.ts:computePriorityScore). Jamais un score IA dans ce sprint. */
  score: number
  /** Raisons explicables, en français, jamais libellées "IA" (Phase 4 : "raisons explicites, non qualifiées d'IA"). */
  reasons: string[]
  source: InsightSource
}

export interface RecentActivityItemDto {
  id: string
  opportuniteId: string
  opportuniteTitre: string
  eventType: string
  /** Libellé déjà sûr à afficher — ne contient JAMAIS le contenu d'une note (Phase 4 : "jamais le contenu complet d'une note"). */
  label: string
  createdAt: string
}

export interface ActionRequiredItemDto {
  id: string
  opportuniteId: string
  opportuniteTitre: string
  reason: string
  severity: ActionSeverity
}

export interface DistributionBucketDto {
  label: string
  count: number
}

export interface DistributionDto {
  title: string
  buckets: DistributionBucketDto[]
}

export interface PortfolioSynthesisDto {
  text: string
  source: InsightSource
}

export interface AdminDashboardDto {
  period: DashboardPeriodDays
  generatedAt: string
  kpis: KpiCardDto[]
  pipeline: PipelineStageDto[]
  priorites: PriorityOpportuniteDto[]
  activiteRecente: RecentActivityItemDto[]
  actionsRequises: ActionRequiredItemDto[]
  distributions: DistributionDto[]
  synthese: PortfolioSynthesisDto
}

/** Élément compact pour la sous-section "Mes opportunités" (Phase 5) — jamais un nom/email d'un autre utilisateur, uniquement les dossiers de l'utilisateur courant. */
export interface MyOpportuniteItemDto {
  id: string
  titre: string
  statutOpportunite: string
  statutLabel: string
  updatedAt: string
}

export interface UserDashboardDto {
  period: DashboardPeriodDays
  generatedAt: string
  mesOpportunitesTotal: number
  mesOpportunites: MyOpportuniteItemDto[]
  kpis: KpiCardDto[]
  pipelinePersonnel: PipelineStageDto[]
  mesPriorites: PriorityOpportuniteDto[]
  mesActions: ActionRequiredItemDto[]
  activiteDeMesDossiers: RecentActivityItemDto[]
}
