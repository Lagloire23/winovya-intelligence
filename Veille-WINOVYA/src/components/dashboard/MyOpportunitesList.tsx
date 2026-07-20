// Sprint 9 (Phase 5) — "Mes opportunités" : uniquement les dossiers avec
// assigned_to = utilisateur courant (jamais un filtre par nom/email).
// Réutilise StatutCommercialBadge (Sprint 7) sans le redéfinir.
import { useNavigate } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import type { MyOpportuniteItemDto } from '../../lib/dashboard'
import { formatDate } from '../../lib/opportunities/uiHelpers'
import { StatutCommercialBadge } from '../opportunites/Badges'
import { EmptyState } from '../common/States'

export function MyOpportunitesList({ total, items }: { total: number; items: MyOpportuniteItemDto[] }) {
  if (total === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Aucune opportunité assignée"
        description="Aucune opportunité ne vous est actuellement assignée. Un administrateur peut vous en assigner depuis un dossier."
      />
    )
  }
  return (
    <div>
      <p className="text-xs text-[hsl(217,4%,46%)] mb-2">
        {total} opportunité{total > 1 ? 's' : ''} qui vous {total > 1 ? 'sont assignées' : 'est assignée'}
        {items.length < total ? ` (${items.length} affichée${items.length > 1 ? 's' : ''})` : ''}.
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <MyOpportuniteRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  )
}

function MyOpportuniteRow({ item }: { item: MyOpportuniteItemDto }) {
  const navigate = useNavigate()
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/dashboard/opportunites/${item.id}`)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-brand-neutral/60 dark:hover:bg-white/5 transition text-left focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <span className="min-w-0 flex-1 text-sm font-medium text-brand-navy dark:text-white truncate" title={item.titre}>
          {item.titre}
        </span>
        <StatutCommercialBadge statut={item.statutOpportunite} />
        <span className="shrink-0 text-[11px] text-[hsl(217,4%,55%)]">{formatDate(item.updatedAt)}</span>
      </button>
    </li>
  )
}
