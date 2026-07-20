// Sprint 9 (Phase 5) — Cockpit utilisateur : vue personnelle centrée sur
// assigned_to = utilisateur courant, 5 sous-sections nommées par la
// spécification. Le contrôle d'écriture réel (changement de statut)
// reste porté par StatusControl (Sprint 7/8), jamais réimplémenté ici —
// la RLS `admin write opportunites` (Sprint 1) demeure la seule source
// d'autorisation.
import type { UserDashboardDto } from '../../lib/dashboard'
import { CockpitSectionHeader } from './CockpitSectionHeader'
import { KpiCardGrid } from './KpiCardGrid'
import { MyOpportunitesList } from './MyOpportunitesList'
import { PipelineOverview } from './PipelineOverview'
import { PriorityList } from './PriorityList'
import { ActionRequiredList } from './ActionRequiredList'
import { RecentActivityFeed } from './RecentActivityFeed'

export function UserCockpitView({ data }: { data: UserDashboardDto }) {
  return (
    <div className="space-y-6">
      <KpiCardGrid items={data.kpis} />

      <div className="card-winovya p-4">
        <CockpitSectionHeader title="Mes opportunités" subtitle="Dossiers qui vous sont assignés" />
        <MyOpportunitesList total={data.mesOpportunitesTotal} items={data.mesOpportunites} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-winovya p-4">
          <CockpitSectionHeader title="Mes priorités" subtitle="Score déterministe, raisons explicables" />
          <PriorityList items={data.mesPriorites} />
        </div>
        <div className="card-winovya p-4">
          <CockpitSectionHeader title="Mes actions attendues" subtitle="Vue calculée, jamais enregistrée" />
          <ActionRequiredList items={data.mesActions} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-winovya p-4">
          <CockpitSectionHeader title="Activité de mes dossiers" />
          <RecentActivityFeed items={data.activiteDeMesDossiers} />
        </div>
        <div className="card-winovya p-4">
          <CockpitSectionHeader
            title="Mon pipeline personnel"
            subtitle="Les actions de statut restent soumises à vos droits réels"
          />
          <PipelineOverview stages={data.pipelinePersonnel} />
        </div>
      </div>
    </div>
  )
}
