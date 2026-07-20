// Sprint 9 (Phase 4/5) — Vue pipeline (les 7 états du cycle de vie
// Sprint 6, IN_PROGRESS légataire volontairement exclu — voir
// dashboard.helpers.ts:buildPipeline). Barres CSS simples, aucune
// bibliothèque de graphiques (règle absolue de ce sprint).
import { statutCommercialStyle } from '../../lib/opportunities/uiHelpers'
import type { PipelineStageDto } from '../../lib/dashboard'
import { EmptyState } from '../common/States'
import { Target } from 'lucide-react'

export function PipelineOverview({ stages }: { stages: PipelineStageDto[] }) {
  const total = stages.reduce((s, x) => s + x.count, 0)
  if (total === 0) {
    return <EmptyState icon={Target} title="Aucune opportunité active" description="Le pipeline commercial est vide pour le moment." />
  }
  const max = Math.max(1, ...stages.map((s) => s.count))
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <div key={s.statut} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-medium text-[hsl(217,10%,25%)] dark:text-gray-300">{s.label}</span>
          <div className="flex-1 h-5 rounded-md bg-brand-neutral/60 dark:bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-md border ${statutCommercialStyle(s.statut)}`}
              style={{ width: `${(s.count / max) * 100}%`, minWidth: s.count > 0 ? '1.25rem' : 0 }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold text-brand-navy dark:text-white">{s.count}</span>
        </div>
      ))}
    </div>
  )
}
