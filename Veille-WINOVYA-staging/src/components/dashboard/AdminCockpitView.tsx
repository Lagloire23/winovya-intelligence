// Sprint 9 (Phase 4) — Cockpit administrateur : vue organisationnelle
// globale, 8 sous-sections nommées par la spécification. Purement de
// composition : chaque section délègue son rendu à un composant dédié,
// déjà testé indépendamment (voir docs/dashboard-architecture.md).
import type { AdminDashboardDto } from '../../lib/dashboard'
import { CockpitSectionHeader } from './CockpitSectionHeader'
import { KpiCardGrid } from './KpiCardGrid'
import { PipelineOverview } from './PipelineOverview'
import { PriorityList } from './PriorityList'
import { RecentActivityFeed } from './RecentActivityFeed'
import { ActionRequiredList } from './ActionRequiredList'
import { DistributionBars } from './DistributionBars'
import { PortfolioSynthesisBlock } from './PortfolioSynthesisBlock'

export function AdminCockpitView({ data }: { data: AdminDashboardDto }) {
  return (
    <div className="space-y-6">
      <KpiCardGrid items={data.kpis} />

      <PortfolioSynthesisBlock synthese={data.synthese} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-winovya p-4">
          <CockpitSectionHeader title="Pipeline commercial" subtitle="Répartition par statut (cycle de vie Sprint 6)" />
          <PipelineOverview stages={data.pipeline} />
        </div>
        <div className="card-winovya p-4">
          <CockpitSectionHeader title="Opportunités prioritaires" subtitle="Score déterministe, raisons explicables" />
          <PriorityList items={data.priorites} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-winovya p-4">
          <CockpitSectionHeader title="Actions requises" subtitle="Vue calculée, jamais enregistrée" />
          <ActionRequiredList items={data.actionsRequises} />
        </div>
        <div className="card-winovya p-4">
          <CockpitSectionHeader title="Activité récente" subtitle="Tous dossiers confondus" />
          <RecentActivityFeed items={data.activiteRecente} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.distributions.map((d) => (
          <div key={d.title} className="card-winovya p-4">
            <DistributionBars distribution={d} />
          </div>
        ))}
      </div>
    </div>
  )
}
