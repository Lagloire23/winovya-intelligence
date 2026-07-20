// Sprint 9 (Phase 4/5) — "Actions requises" : vue CALCULÉE (jamais
// persistée), max 5. Deux règles déterministes (voir
// dashboard.helpers.ts:buildActionsRequises) : non-assignation, staleness.
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import type { ActionRequiredItemDto } from '../../lib/dashboard'
import { EmptyState } from '../common/States'

export function ActionRequiredList({ items }: { items: ActionRequiredItemDto[] }) {
  const navigate = useNavigate()
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Rien à signaler"
        description="Aucune opportunité ne nécessite d'action immédiate d'après les règles en vigueur."
      />
    )
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.severity === 'warning' ? AlertTriangle : Info
        const color = item.severity === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-brand-primary'
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => navigate(`/dashboard/opportunites/${item.opportuniteId}`)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-brand-neutral/60 dark:hover:bg-white/5 transition text-left focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <Icon size={16} className={`shrink-0 ${color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-navy dark:text-white truncate" title={item.opportuniteTitre}>
                  {item.opportuniteTitre}
                </p>
                <p className="text-[11px] text-[hsl(217,4%,46%)] truncate">{item.reason}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
