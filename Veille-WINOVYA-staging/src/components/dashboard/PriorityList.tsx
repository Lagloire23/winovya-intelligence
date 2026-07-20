// Sprint 9 (Phase 4/5) — Liste des opportunités prioritaires (max 5,
// imposé par l'appelant). Score + raisons explicables, jamais qualifiées
// "IA" (Phase 4/15 : source déterministe uniquement dans ce sprint).
import { useNavigate } from 'react-router-dom'
import { Target } from 'lucide-react'
import type { PriorityOpportuniteDto } from '../../lib/dashboard'
import { EmptyState } from '../common/States'
import { ScoreBadge } from './ScoreBadge'

export function PriorityList({ items }: { items: PriorityOpportuniteDto[] }) {
  const navigate = useNavigate()
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Aucune priorité identifiée"
        description="Aucune opportunité active ne ressort des règles de priorisation pour le moment."
      />
    )
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/opportunites/${item.id}`)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-brand-neutral/60 dark:hover:bg-white/5 transition text-left focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <ScoreBadge score={item.score} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-brand-navy dark:text-white truncate" title={item.titre}>
                {item.titre}
              </p>
              <p className="text-[11px] text-[hsl(217,4%,46%)] truncate">
                {item.reasons.length > 0 ? item.reasons.join(' · ') : item.statutLabel}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
