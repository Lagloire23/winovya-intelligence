// Sprint 9 (Phase 4/5) — Flux d'activité récente (max 8-10, imposé par
// l'appelant). Réutilise le même libellé sûr que ActivityTimeline
// (Sprint 7/8) : jamais le contenu complet d'une note.
import { useNavigate } from 'react-router-dom'
import { History } from 'lucide-react'
import type { RecentActivityItemDto } from '../../lib/dashboard'
import { formatRelative } from '../../lib/opportunities/uiHelpers'
import { EmptyState } from '../common/States'

export function RecentActivityFeed({ items }: { items: RecentActivityItemDto[] }) {
  const navigate = useNavigate()
  if (items.length === 0) {
    return <EmptyState icon={History} title="Aucune activité récente" description="Aucun évènement enregistré pour le moment." />
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/opportunites/${item.opportuniteId}`)}
            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-md hover:bg-brand-neutral/60 dark:hover:bg-white/5 transition text-left focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <span className="min-w-0 flex-1 text-xs text-[hsl(217,10%,25%)] dark:text-gray-300 truncate">
              <span className="font-medium text-brand-navy dark:text-white">{item.label}</span>{' '}
              <span className="text-[hsl(217,4%,46%)]">— {item.opportuniteTitre}</span>
            </span>
            <span className="shrink-0 text-[11px] text-[hsl(217,4%,55%)]">{formatRelative(item.createdAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
