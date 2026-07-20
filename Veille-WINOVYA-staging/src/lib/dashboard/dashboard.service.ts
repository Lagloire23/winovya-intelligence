// Sprint 9 — Service central du cockpit (Phase 8). Orchestration
// UNIQUEMENT : lit via DashboardRepository (I/O), calcule via
// dashboard.helpers.ts (pur), assemble les DTO publics
// (dashboard.dto.ts). Aucune règle métier de corrélation, d'enrichissement
// ou de cycle de vie n'est recalculée ici.
//
// `import type` uniquement pour DashboardRepository (comme
// OpportuniteQueryService/CommercialService aux Sprints 5/6) : ce fichier
// reste chargeable sous `tsx` pur (sans import.meta.env) pour les tests
// (scripts/sprint9-dashboard-tests.ts). Le vrai câblage (client Supabase
// réel) n'a lieu que dans index.ts, jamais ici.
//
// Phase 8 (règle absolue) : la méthode publique `getDashboard` détermine
// le rôle à afficher UNIQUEMENT depuis `actor.role`, lui-même fourni par
// l'appelant à partir du contexte d'authentification réel (AuthContext /
// profil chargé après connexion Supabase, protégé par RLS). Cette
// fonction n'accepte et ne peut jamais accepter un rôle "admin" fourni
// par une source non fiable (paramètre d'URL, prop libre, etc.).

import type { DashboardActivityRow, DashboardOpportuniteRow, DashboardRepository } from './dashboard.repository'
import {
  buildActionsRequises,
  buildDistributionParConfiance,
  buildDistributionParStatut,
  buildPipeline,
  buildPortfolioSynthesis,
  isActionableStatus,
  isWithinPeriod,
  kpi,
  mapActivityRow,
  rankPriorities,
  statutLabel,
} from './dashboard.helpers'
import type { AdminDashboardDto, RecentActivityItemDto, UserDashboardDto } from './dashboard.dto'
import { DEFAULT_DASHBOARD_PERIOD, type DashboardPeriodDays, type TrustedActor } from './dashboard.types'

const MAX_PRIORITES = 5
const MAX_ACTIONS = 5
const MAX_ACTIVITE_ADMIN = 10
const MAX_ACTIVITE_USER = 8

function joinActivityWithTitres(
  rows: DashboardActivityRow[],
  titresParId: Map<string, string>,
  limit: number
): RecentActivityItemDto[] {
  return rows
    .map((r) =>
      mapActivityRow({
        id: r.id,
        opportuniteId: r.opportuniteId,
        opportuniteTitre: titresParId.get(r.opportuniteId) ?? 'Opportunité',
        eventType: r.eventType,
        details: r.details,
        createdAt: r.createdAt,
      })
    )
    .slice(0, limit)
}

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getAdminDashboard(period: DashboardPeriodDays = DEFAULT_DASHBOARD_PERIOD): Promise<AdminDashboardDto> {
    const [allRows, activityRows] = await Promise.all([
      this.repository.fetchAllDossiers(),
      this.repository.fetchRecentActivity(MAX_ACTIVITE_ADMIN * 4),
    ])

    const active = allRows.filter((r) => isActionableStatus(r.statutOpportunite))
    const now = Date.now()

    const nouvellesSurPeriode = allRows.filter((r) => isWithinPeriod(r.createdAt, period, now)).length
    const gagneesSurPeriode = allRows.filter(
      (r) => r.statutOpportunite === 'WON' && isWithinPeriod(r.updatedAt, period, now)
    ).length
    const confianceElevee = active.filter((r) => r.niveauConfianceRang === 3).length
    const nonAssignees = active.filter((r) => !r.assignedTo).length
    const avecBudget = active.filter((r) => r.budgetIdentifie !== null)
    const obsoletes = active.filter((r) => {
      const d = r.derniereEvolutionMetierAt
      return d !== null && !isWithinPeriod(d, 30, now)
    }).length

    const kpis = [
      kpi('total_actives', 'Opportunités actives', active.length),
      kpi(
        'nouvelles_periode',
        'Opportunités détectées',
        nouvellesSurPeriode,
        `Créées sur les ${period} derniers jours, tous statuts confondus`
      ),
      kpi('confiance_elevee', 'Confiance élevée', confianceElevee),
      kpi('non_assignees', 'Non assignées', nonAssignees),
      kpi('budget_identifie', 'Avec budget identifié', avecBudget.length),
      kpi('gagnees_periode', 'Gagnées', gagneesSurPeriode, `sur les ${period} derniers jours`),
    ]

    const titresParId = new Map(allRows.map((r) => [r.id, r.titre] as const))

    return {
      period,
      generatedAt: new Date().toISOString(),
      kpis,
      pipeline: buildPipeline(allRows),
      priorites: rankPriorities(active, MAX_PRIORITES, now),
      activiteRecente: joinActivityWithTitres(activityRows, titresParId, MAX_ACTIVITE_ADMIN),
      actionsRequises: buildActionsRequises(active, MAX_ACTIONS, now),
      distributions: [buildDistributionParStatut(active), buildDistributionParConfiance(active)],
      synthese: buildPortfolioSynthesis({
        total: active.length,
        confianceElevee,
        budgetIdentifie: avecBudget.length,
        nonAssignees,
        obsoletes,
        periodDays: period,
      }),
    }
  }

  async getUserDashboard(
    actor: TrustedActor,
    period: DashboardPeriodDays = DEFAULT_DASHBOARD_PERIOD
  ): Promise<UserDashboardDto> {
    const mine: DashboardOpportuniteRow[] = await this.repository.fetchDossiersForUser(actor.userId)
    const now = Date.now()
    const active = mine.filter((r) => isActionableStatus(r.statutOpportunite))

    const activityRows = await this.repository.fetchRecentActivityForOpportunites(
      mine.map((r) => r.id),
      MAX_ACTIVITE_USER * 4
    )
    const titresParId = new Map(mine.map((r) => [r.id, r.titre] as const))

    const confianceElevee = active.filter((r) => r.niveauConfianceRang === 3).length
    const avecBudget = active.filter((r) => r.budgetIdentifie !== null).length

    const kpis = [
      kpi('mes_actives', 'Mes opportunités actives', active.length),
      kpi('mes_confiance_elevee', 'Confiance élevée', confianceElevee),
      kpi('mes_budget', 'Avec budget identifié', avecBudget),
    ]

    const mesOpportunites = mine.slice(0, 8).map((r) => ({
      id: r.id,
      titre: r.titre,
      statutOpportunite: r.statutOpportunite,
      statutLabel: statutLabel(r.statutOpportunite),
      updatedAt: r.updatedAt,
    }))

    return {
      period,
      generatedAt: new Date().toISOString(),
      mesOpportunitesTotal: mine.length,
      mesOpportunites,
      kpis,
      pipelinePersonnel: buildPipeline(mine),
      mesPriorites: rankPriorities(active, MAX_PRIORITES, now),
      mesActions: buildActionsRequises(active, MAX_ACTIONS, now),
      activiteDeMesDossiers: joinActivityWithTitres(activityRows, titresParId, MAX_ACTIVITE_USER),
    }
  }

  /**
   * Point d'entrée préféré (Phase 8) : dispatch UNIQUEMENT sur
   * `actor.role`, jamais sur une donnée fournie séparément par
   * l'appelant. `actor` doit provenir du profil authentifié réel (voir
   * en-tête de fichier).
   */
  async getDashboard(
    actor: TrustedActor,
    period: DashboardPeriodDays = DEFAULT_DASHBOARD_PERIOD
  ): Promise<{ role: 'admin'; data: AdminDashboardDto } | { role: 'member'; data: UserDashboardDto }> {
    if (actor.role === 'admin') {
      return { role: 'admin', data: await this.getAdminDashboard(period) }
    }
    return { role: 'member', data: await this.getUserDashboard(actor, period) }
  }
}
